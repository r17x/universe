use std::net::{Ipv4Addr, SocketAddrV4};
use std::time::Duration;

use dhcproto::v4::{self, Decodable, Decoder, Encodable, Encoder};
use types::{
    AddressBindingState, AddressLease, InterfaceIdentity, ResolverConfiguration,
    channel::{AddressBindingStateSender, InterfaceIdentityWatch, ResolverConfigSender},
};
use socket2::{Domain, Protocol, SockAddr, Socket, Type};
use tokio::time::{sleep, timeout};
use tracing::{debug, info, warn};

const DHCP_SERVER_PORT: u16 = 67;
const DHCP_CLIENT_PORT: u16 = 68;
const DISCOVER_TIMEOUT: Duration = Duration::from_secs(4);
const DISCOVER_RETRIES: u32 = 3;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(4);
const REQUEST_RETRIES: u32 = 3;
#[cfg(target_os = "linux")]
const ARP_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
#[cfg(target_os = "linux")]
const ARP_PROBE_RETRIES: u32 = 1;
const RENEW_RETRIES: u32 = 3;

#[derive(Debug, thiserror::Error)]
pub enum AddressError {
    #[error("socket error: {0}")]
    SocketError(#[from] std::io::Error),
    #[error("dhcp encode error: {0}")]
    DhcpEncodeError(#[from] dhcproto::error::EncodeError),
    #[error("dhcp decode error: {0}")]
    DhcpDecodeError(#[from] dhcproto::error::DecodeError),
    #[error("dhcp operation timed out")]
    Timeout,
    #[error("interface lost")]
    InterfaceLost,
    #[error("arp conflict: offered address already in use")]
    ArpConflict,
}

pub struct Address {
    iface_watch: InterfaceIdentityWatch,
    binding_state_tx: AddressBindingStateSender,
    resolver_tx: ResolverConfigSender,
}

impl Address {
    pub fn new(
        iface_watch: InterfaceIdentityWatch,
        binding_state_tx: AddressBindingStateSender,
        resolver_tx: ResolverConfigSender,
    ) -> Self {
        Self {
            iface_watch,
            binding_state_tx,
            resolver_tx,
        }
    }

    pub async fn run(mut self) -> Result<(), AddressError> {
        loop {
            let iface = self.wait_for_interface().await?;
            info!(iface = %iface.name, "interface ready, starting dhcp");

            match self.dhcp_cycle(&iface).await {
                Ok(()) => {}
                Err(AddressError::InterfaceLost) => {
                    info!(iface = %iface.name, "interface lost, restarting");
                    let _ = self.binding_state_tx.send(AddressBindingState::Unbound);
                    let _ = self.resolver_tx.send(None);
                }
                Err(AddressError::ArpConflict) => {
                    warn!(iface = %iface.name, "arp conflict detected, restarting");
                    let _ = self.binding_state_tx.send(AddressBindingState::Unbound);
                    let _ = self.resolver_tx.send(None);
                    sleep(Duration::from_secs(10)).await;
                }
                Err(e) => {
                    warn!(iface = %iface.name, error = %e, "dhcp cycle error, restarting");
                    let _ = self.binding_state_tx.send(AddressBindingState::Lost);
                    let _ = self.resolver_tx.send(None);
                    sleep(Duration::from_secs(5)).await;
                }
            }
        }
    }

    async fn wait_for_interface(&mut self) -> Result<InterfaceIdentity, AddressError> {
        loop {
            if let Some(iface) = self.iface_watch.borrow_and_update().clone() {
                return Ok(iface);
            }
            self.iface_watch
                .changed()
                .await
                .map_err(|_| AddressError::InterfaceLost)?;
            if let Some(iface) = self.iface_watch.borrow_and_update().clone() {
                return Ok(iface);
            }
        }
    }

    fn interface_alive(&mut self) -> bool {
        self.iface_watch.borrow().is_some()
    }

    async fn dhcp_cycle(&mut self, iface: &InterfaceIdentity) -> Result<(), AddressError> {
        let _ = self.binding_state_tx.send(AddressBindingState::Unbound);

        let sock = open_dhcp_socket(iface)?;
        let xid: u32 = rand_xid();

        let _ = self.binding_state_tx.send(AddressBindingState::Discovering);
        let offer = do_discover(&sock, iface, xid).await?;

        let offered_ip = offer.yiaddr();
        let server_id = extract_server_id(&offer);
        debug!(offered_ip = %offered_ip, server_id = ?server_id, "received dhcp offer");

        let conflict = arp_probe(iface, offered_ip).await;
        if conflict {
            let decline = build_decline(xid, &iface.mac, offered_ip, server_id)?;
            let dest = SocketAddrV4::new(Ipv4Addr::BROADCAST, DHCP_SERVER_PORT);
            sock.send_to(&decline, dest).await?;
            return Err(AddressError::ArpConflict);
        }

        let _ = self.binding_state_tx.send(AddressBindingState::Requesting);
        let ack = do_request(&sock, iface, xid, offered_ip, server_id).await?;
        debug!(ip = %ack.yiaddr(), "received dhcp ack");

        let lease = extract_lease(&ack)?;
        let resolver = build_resolver(&ack);

        info!(
            ip = %lease.address,
            gateway = %lease.gateway,
            lease_secs = lease.lease_duration_secs,
            "dhcp bound"
        );

        let _ = self
            .binding_state_tx
            .send(AddressBindingState::Bound(lease.clone()));
        let _ = self.resolver_tx.send(resolver);

        self.manage_lease(iface, &sock, xid, lease).await
    }

    async fn manage_lease(
        &mut self,
        iface: &InterfaceIdentity,
        sock: &tokio::net::UdpSocket,
        xid: u32,
        initial_lease: AddressLease,
    ) -> Result<(), AddressError> {
        let mut current_lease = initial_lease;

        loop {
            let t1 = Duration::from_secs(current_lease.t1_secs as u64);
            let t2 = Duration::from_secs(current_lease.t2_secs as u64);
            let expire = Duration::from_secs(current_lease.lease_duration_secs as u64);

            let start = tokio::time::Instant::now();
            let t2_deadline = start + t2;
            let expire_deadline = start + expire;

            tokio::select! {
                _ = sleep(t1) => {}
                _ = self.iface_watch.changed() => {
                    if !self.interface_alive() {
                        return Err(AddressError::InterfaceLost);
                    }
                }
            }

            if !self.interface_alive() {
                return Err(AddressError::InterfaceLost);
            }

            let server = extract_server_id_from_lease(&current_lease);
            let _ = self
                .binding_state_tx
                .send(AddressBindingState::Renewing(current_lease.clone()));

            let renewed = self
                .renew_unicast(iface, sock, xid, &current_lease, server, t2_deadline)
                .await;

            if let Ok(new_lease) = renewed {
                info!(ip = %new_lease.address, "dhcp renewed at t1");
                let _ = self
                    .binding_state_tx
                    .send(AddressBindingState::Bound(new_lease.clone()));
                current_lease = new_lease;
                continue;
            }

            debug!("t1 renewal failed, rebinding at t2");

            let now = tokio::time::Instant::now();
            if now < t2_deadline {
                tokio::select! {
                    _ = sleep(t2_deadline - now) => {}
                    _ = self.iface_watch.changed() => {
                        if !self.interface_alive() {
                            return Err(AddressError::InterfaceLost);
                        }
                    }
                }
            }

            if !self.interface_alive() {
                return Err(AddressError::InterfaceLost);
            }

            let _ = self
                .binding_state_tx
                .send(AddressBindingState::Rebinding(current_lease.clone()));

            let rebound = self
                .rebind_broadcast(iface, sock, xid, &current_lease, expire_deadline)
                .await;

            match rebound {
                Ok(new_lease) => {
                    info!(ip = %new_lease.address, "dhcp rebound at t2");
                    let _ = self
                        .binding_state_tx
                        .send(AddressBindingState::Bound(new_lease.clone()));
                    current_lease = new_lease;
                    continue;
                }
                Err(_) => {
                    warn!("rebinding failed, lease expired");
                    break;
                }
            }
        }

        let _ = self.binding_state_tx.send(AddressBindingState::Lost);
        let _ = self.resolver_tx.send(None);
        Ok(())
    }

    async fn renew_unicast(
        &mut self,
        iface: &InterfaceIdentity,
        sock: &tokio::net::UdpSocket,
        xid: u32,
        lease: &AddressLease,
        server: Ipv4Addr,
        deadline: tokio::time::Instant,
    ) -> Result<AddressLease, AddressError> {
        for _ in 0..RENEW_RETRIES {
            if tokio::time::Instant::now() >= deadline {
                break;
            }
            if !self.interface_alive() {
                return Err(AddressError::InterfaceLost);
            }
            let msg = build_request(
                xid,
                &iface.mac,
                lease.address,
                server,
                Some(lease.address),
            )?;
            let dest = SocketAddrV4::new(server, DHCP_SERVER_PORT);
            sock.send_to(&msg, dest).await?;

            match timeout(REQUEST_TIMEOUT, recv_dhcp(sock, xid)).await {
                Ok(Ok(resp)) if is_ack(&resp) => {
                    return extract_lease(&resp);
                }
                Ok(Ok(resp)) if is_nak(&resp) => {
                    return Err(AddressError::Timeout);
                }
                _ => {
                    debug!("renew attempt timed out");
                }
            }
        }
        Err(AddressError::Timeout)
    }

    async fn rebind_broadcast(
        &mut self,
        iface: &InterfaceIdentity,
        sock: &tokio::net::UdpSocket,
        xid: u32,
        lease: &AddressLease,
        deadline: tokio::time::Instant,
    ) -> Result<AddressLease, AddressError> {
        for _ in 0..RENEW_RETRIES {
            if tokio::time::Instant::now() >= deadline {
                break;
            }
            if !self.interface_alive() {
                return Err(AddressError::InterfaceLost);
            }
            let msg = build_request(
                xid,
                &iface.mac,
                lease.address,
                Ipv4Addr::BROADCAST,
                Some(lease.address),
            )?;
            let dest = SocketAddrV4::new(Ipv4Addr::BROADCAST, DHCP_SERVER_PORT);
            sock.send_to(&msg, dest).await?;

            match timeout(REQUEST_TIMEOUT, recv_dhcp(sock, xid)).await {
                Ok(Ok(resp)) if is_ack(&resp) => {
                    return extract_lease(&resp);
                }
                Ok(Ok(resp)) if is_nak(&resp) => {
                    return Err(AddressError::Timeout);
                }
                _ => {}
            }
        }
        Err(AddressError::Timeout)
    }
}

fn extract_server_id_from_lease(lease: &AddressLease) -> Ipv4Addr {
    lease.gateway
}

fn open_dhcp_socket(iface: &InterfaceIdentity) -> Result<tokio::net::UdpSocket, AddressError> {
    let sock = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP))?;
    sock.set_broadcast(true)?;
    sock.set_reuse_address(true)?;

    bind_socket_to_iface(&sock, iface)?;

    let bind_addr = SockAddr::from(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, DHCP_CLIENT_PORT));
    sock.bind(&bind_addr)?;
    sock.set_nonblocking(true)?;

    let std_sock: std::net::UdpSocket = sock.into();
    let tokio_sock = tokio::net::UdpSocket::from_std(std_sock)?;
    Ok(tokio_sock)
}

#[cfg(target_os = "linux")]
fn bind_socket_to_iface(sock: &Socket, iface: &InterfaceIdentity) -> Result<(), AddressError> {
    nix::sys::socket::setsockopt(
        sock,
        nix::sys::socket::sockopt::BindToDevice,
        &std::ffi::OsString::from(iface.name.as_str()),
    )
    .map_err(|e| AddressError::SocketError(std::io::Error::from_raw_os_error(e as i32)))
}

#[cfg(not(target_os = "linux"))]
fn bind_socket_to_iface(_sock: &Socket, _iface: &InterfaceIdentity) -> Result<(), AddressError> {
    Ok(())
}

fn rand_xid() -> u32 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::time::SystemTime;

    let mut h = DefaultHasher::new();
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos()
        .hash(&mut h);
    std::thread::current().id().hash(&mut h);
    h.finish() as u32 ^ ((h.finish() >> 32) as u32)
}

pub(crate) fn build_discover(xid: u32, mac: &[u8; 6]) -> Result<Vec<u8>, AddressError> {
    let mut msg = v4::Message::default();
    msg.set_flags(v4::Flags::default().set_broadcast());
    msg.set_opcode(v4::Opcode::BootRequest);
    msg.set_htype(v4::HType::Eth);
    msg.set_chaddr(mac);
    msg.set_xid(xid);
    msg.opts_mut()
        .insert(v4::DhcpOption::MessageType(v4::MessageType::Discover));
    msg.opts_mut()
        .insert(v4::DhcpOption::ParameterRequestList(vec![
            v4::OptionCode::SubnetMask,
            v4::OptionCode::Router,
            v4::OptionCode::DomainNameServer,
            v4::OptionCode::DomainName,
            v4::OptionCode::AddressLeaseTime,
            v4::OptionCode::Renewal,
            v4::OptionCode::Rebinding,
        ]));
    msg.opts_mut()
        .insert(v4::DhcpOption::ClientIdentifier(mac.to_vec()));
    encode_msg(&msg)
}

pub(crate) fn build_request(
    xid: u32,
    mac: &[u8; 6],
    requested_ip: Ipv4Addr,
    server_id: Ipv4Addr,
    ciaddr: Option<Ipv4Addr>,
) -> Result<Vec<u8>, AddressError> {
    let mut msg = v4::Message::default();
    msg.set_flags(v4::Flags::default().set_broadcast());
    msg.set_opcode(v4::Opcode::BootRequest);
    msg.set_htype(v4::HType::Eth);
    msg.set_chaddr(mac);
    msg.set_xid(xid);
    if let Some(ci) = ciaddr {
        msg.set_ciaddr(ci);
    }
    msg.opts_mut()
        .insert(v4::DhcpOption::MessageType(v4::MessageType::Request));
    msg.opts_mut()
        .insert(v4::DhcpOption::RequestedIpAddress(requested_ip));
    if server_id != Ipv4Addr::BROADCAST {
        msg.opts_mut()
            .insert(v4::DhcpOption::ServerIdentifier(server_id));
    }
    msg.opts_mut()
        .insert(v4::DhcpOption::ParameterRequestList(vec![
            v4::OptionCode::SubnetMask,
            v4::OptionCode::Router,
            v4::OptionCode::DomainNameServer,
            v4::OptionCode::DomainName,
            v4::OptionCode::AddressLeaseTime,
            v4::OptionCode::Renewal,
            v4::OptionCode::Rebinding,
        ]));
    msg.opts_mut()
        .insert(v4::DhcpOption::ClientIdentifier(mac.to_vec()));
    encode_msg(&msg)
}

fn build_decline(
    xid: u32,
    mac: &[u8; 6],
    offered_ip: Ipv4Addr,
    server_id: Ipv4Addr,
) -> Result<Vec<u8>, AddressError> {
    let mut msg = v4::Message::default();
    msg.set_opcode(v4::Opcode::BootRequest);
    msg.set_htype(v4::HType::Eth);
    msg.set_chaddr(mac);
    msg.set_xid(xid);
    msg.opts_mut()
        .insert(v4::DhcpOption::MessageType(v4::MessageType::Decline));
    msg.opts_mut()
        .insert(v4::DhcpOption::RequestedIpAddress(offered_ip));
    msg.opts_mut()
        .insert(v4::DhcpOption::ServerIdentifier(server_id));
    msg.opts_mut()
        .insert(v4::DhcpOption::ClientIdentifier(mac.to_vec()));
    encode_msg(&msg)
}

fn encode_msg(msg: &v4::Message) -> Result<Vec<u8>, AddressError> {
    let mut buf = Vec::new();
    let mut enc = Encoder::new(&mut buf);
    msg.encode(&mut enc)?;
    Ok(buf)
}

async fn do_discover(
    sock: &tokio::net::UdpSocket,
    iface: &InterfaceIdentity,
    xid: u32,
) -> Result<v4::Message, AddressError> {
    let msg = build_discover(xid, &iface.mac)?;
    let dest = SocketAddrV4::new(Ipv4Addr::BROADCAST, DHCP_SERVER_PORT);

    for attempt in 0..DISCOVER_RETRIES {
        debug!(attempt, "sending dhcpdiscover");
        sock.send_to(&msg, dest).await?;

        match timeout(DISCOVER_TIMEOUT, recv_offer(sock, xid)).await {
            Ok(Ok(offer)) => return Ok(offer),
            Ok(Err(e)) => return Err(e),
            Err(_) => {
                debug!(attempt, "discover timed out, retrying");
            }
        }
    }
    Err(AddressError::Timeout)
}

async fn do_request(
    sock: &tokio::net::UdpSocket,
    iface: &InterfaceIdentity,
    xid: u32,
    offered_ip: Ipv4Addr,
    server_id: Ipv4Addr,
) -> Result<v4::Message, AddressError> {
    let msg = build_request(xid, &iface.mac, offered_ip, server_id, None)?;
    let dest = SocketAddrV4::new(Ipv4Addr::BROADCAST, DHCP_SERVER_PORT);

    for attempt in 0..REQUEST_RETRIES {
        debug!(attempt, "sending dhcprequest");
        sock.send_to(&msg, dest).await?;

        match timeout(REQUEST_TIMEOUT, recv_ack(sock, xid)).await {
            Ok(Ok(ack)) => return Ok(ack),
            Ok(Err(e)) => return Err(e),
            Err(_) => {
                debug!(attempt, "request timed out, retrying");
            }
        }
    }
    Err(AddressError::Timeout)
}

async fn recv_offer(sock: &tokio::net::UdpSocket, xid: u32) -> Result<v4::Message, AddressError> {
    loop {
        let msg = recv_dhcp(sock, xid).await?;
        if msg.opts().has_msg_type(v4::MessageType::Offer) {
            return Ok(msg);
        }
    }
}

async fn recv_ack(sock: &tokio::net::UdpSocket, xid: u32) -> Result<v4::Message, AddressError> {
    loop {
        let msg = recv_dhcp(sock, xid).await?;
        if msg.opts().has_msg_type(v4::MessageType::Ack) {
            return Ok(msg);
        }
        if msg.opts().has_msg_type(v4::MessageType::Nak) {
            warn!("received dhcpnak");
            return Err(AddressError::Timeout);
        }
    }
}

async fn recv_dhcp(sock: &tokio::net::UdpSocket, xid: u32) -> Result<v4::Message, AddressError> {
    let mut buf = vec![0u8; 1500];
    loop {
        let (n, _src) = sock.recv_from(&mut buf).await?;
        if n < 240 {
            continue;
        }
        let msg = match v4::Message::decode(&mut Decoder::new(&buf[..n])) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if msg.xid() != xid {
            continue;
        }
        if msg.opcode() != v4::Opcode::BootReply {
            continue;
        }
        return Ok(msg);
    }
}

fn is_ack(msg: &v4::Message) -> bool {
    msg.opts().has_msg_type(v4::MessageType::Ack)
}

fn is_nak(msg: &v4::Message) -> bool {
    msg.opts().has_msg_type(v4::MessageType::Nak)
}

fn extract_server_id(msg: &v4::Message) -> Ipv4Addr {
    match msg.opts().get(v4::OptionCode::ServerIdentifier) {
        Some(v4::DhcpOption::ServerIdentifier(ip)) => *ip,
        _ => Ipv4Addr::BROADCAST,
    }
}

pub(crate) fn extract_lease(msg: &v4::Message) -> Result<AddressLease, AddressError> {
    let address = msg.yiaddr();

    let subnet_mask = match msg.opts().get(v4::OptionCode::SubnetMask) {
        Some(v4::DhcpOption::SubnetMask(m)) => *m,
        _ => Ipv4Addr::new(255, 255, 255, 0),
    };

    let gateway = match msg.opts().get(v4::OptionCode::Router) {
        Some(v4::DhcpOption::Router(gws)) => gws.first().copied().unwrap_or(Ipv4Addr::UNSPECIFIED),
        _ => Ipv4Addr::UNSPECIFIED,
    };

    let dns_servers = match msg.opts().get(v4::OptionCode::DomainNameServer) {
        Some(v4::DhcpOption::DomainNameServer(dns)) => dns.clone(),
        _ => vec![],
    };

    let lease_duration_secs = match msg.opts().get(v4::OptionCode::AddressLeaseTime) {
        Some(v4::DhcpOption::AddressLeaseTime(t)) => *t,
        _ => 3600,
    };

    let t1_secs = match msg.opts().get(v4::OptionCode::Renewal) {
        Some(v4::DhcpOption::Renewal(t)) => *t,
        _ => lease_duration_secs / 2,
    };

    let t2_secs = match msg.opts().get(v4::OptionCode::Rebinding) {
        Some(v4::DhcpOption::Rebinding(t)) => *t,
        _ => lease_duration_secs * 7 / 8,
    };

    Ok(AddressLease {
        address,
        subnet_mask,
        gateway,
        dns_servers,
        lease_duration_secs,
        t1_secs,
        t2_secs,
    })
}

fn build_resolver(msg: &v4::Message) -> Option<ResolverConfiguration> {
    let dns_servers = match msg.opts().get(v4::OptionCode::DomainNameServer) {
        Some(v4::DhcpOption::DomainNameServer(dns)) => dns.clone(),
        _ => vec![],
    };

    if dns_servers.is_empty() {
        return None;
    }

    let domain = match msg.opts().get(v4::OptionCode::DomainName) {
        Some(v4::DhcpOption::DomainName(d)) => Some(d.clone()),
        _ => None,
    };

    Some(ResolverConfiguration {
        dns_servers,
        domain,
    })
}

async fn arp_probe(iface: &InterfaceIdentity, target: Ipv4Addr) -> bool {
    match arp_probe_platform(iface, target).await {
        Ok(conflict) => conflict,
        Err(e) => {
            warn!(error = %e, "arp probe unavailable, proceeding without conflict detection");
            false
        }
    }
}

#[cfg(target_os = "linux")]
async fn arp_probe_platform(
    iface: &InterfaceIdentity,
    target: Ipv4Addr,
) -> Result<bool, std::io::Error> {
    use nix::sys::socket::{
        AddressFamily, SockFlag, SockProtocol, SockType, socket, setsockopt, sockopt,
    };

    let fd = socket(
        AddressFamily::Packet,
        SockType::Raw,
        SockFlag::empty(),
        Some(SockProtocol::EthAll),
    )
    .map_err(|e| std::io::Error::from_raw_os_error(e as i32))?;

    setsockopt(
        &fd,
        sockopt::BindToDevice,
        &std::ffi::OsString::from(iface.name.as_str()),
    )
    .map_err(|e| std::io::Error::from_raw_os_error(e as i32))?;

    let frame = build_arp_probe_frame(&iface.mac, target);

    for _ in 0..=ARP_PROBE_RETRIES {
        nix::unistd::write(&fd, &frame)
            .map_err(|e| std::io::Error::from_raw_os_error(e as i32))?;

        let fd_clone = nix::unistd::dup(&fd)
            .map_err(|e| std::io::Error::from_raw_os_error(e as i32))?;
        let probe_timeout = ARP_PROBE_TIMEOUT;
        let conflict = tokio::task::spawn_blocking(move || {
            recv_arp_with_timeout(fd_clone, target, probe_timeout)
        })
        .await
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))??;

        if conflict {
            return Ok(true);
        }
    }

    Ok(false)
}

#[cfg(target_os = "linux")]
fn recv_arp_with_timeout(
    fd: std::os::fd::OwnedFd,
    target_ip: Ipv4Addr,
    timeout: Duration,
) -> Result<bool, std::io::Error> {
    use nix::sys::socket::{setsockopt, sockopt};
    use nix::sys::time::TimeVal;

    let tv = TimeVal::new(
        timeout.as_secs() as libc::time_t,
        libc::suseconds_t::from(timeout.subsec_micros() as i32),
    );
    setsockopt(&fd, sockopt::ReceiveTimeout, &tv)
        .map_err(|e| std::io::Error::from_raw_os_error(e as i32))?;

    let mut buf = vec![0u8; 1500];
    let n = match nix::unistd::read(&fd, &mut buf) {
        Ok(n) => n,
        Err(nix::errno::Errno::EAGAIN) | Err(nix::errno::Errno::EWOULDBLOCK) => return Ok(false),
        Err(e) => return Err(std::io::Error::from_raw_os_error(e as i32)),
    };

    if n < 42 {
        return Ok(false);
    }

    if buf[12] != 0x08 || buf[13] != 0x06 {
        return Ok(false);
    }

    if buf[20] != 0x00 || buf[21] != 0x02 {
        return Ok(false);
    }

    let sender_ip = Ipv4Addr::new(buf[28], buf[29], buf[30], buf[31]);
    Ok(sender_ip == target_ip)
}

#[cfg(not(target_os = "linux"))]
async fn arp_probe_platform(
    _iface: &InterfaceIdentity,
    _target: Ipv4Addr,
) -> Result<bool, std::io::Error> {
    Ok(false)
}

#[cfg(target_os = "linux")]
fn build_arp_probe_frame(sender_mac: &[u8; 6], target_ip: Ipv4Addr) -> Vec<u8> {
    let mut frame = Vec::with_capacity(42);

    frame.extend_from_slice(&[0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    frame.extend_from_slice(sender_mac);
    frame.extend_from_slice(&[0x08, 0x06]);

    frame.extend_from_slice(&[0x00, 0x01]);
    frame.extend_from_slice(&[0x08, 0x00]);
    frame.push(6);
    frame.push(4);
    frame.extend_from_slice(&[0x00, 0x01]);
    frame.extend_from_slice(sender_mac);
    frame.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);
    frame.extend_from_slice(&[0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    frame.extend_from_slice(&target_ip.octets());

    frame
}

#[cfg(test)]
mod tests {
    use super::*;
    use dhcproto::v4::{self, Decodable, Decoder};

    fn decode_msg(bytes: &[u8]) -> v4::Message {
        v4::Message::decode(&mut Decoder::new(bytes)).expect("decode failed")
    }

    #[test]
    fn discover_has_correct_opcode_and_flags() {
        let mac = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55];
        let bytes = build_discover(0xdeadbeef, &mac).unwrap();
        let msg = decode_msg(&bytes);
        assert_eq!(msg.opcode(), v4::Opcode::BootRequest);
        assert_eq!(msg.htype(), v4::HType::Eth);
        assert_eq!(msg.xid(), 0xdeadbeef);
        assert!(msg.flags().broadcast());
        assert!(msg.opts().has_msg_type(v4::MessageType::Discover));
    }

    #[test]
    fn discover_has_parameter_request_list() {
        let mac = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
        let bytes = build_discover(1, &mac).unwrap();
        let msg = decode_msg(&bytes);
        let prl = match msg.opts().get(v4::OptionCode::ParameterRequestList) {
            Some(v4::DhcpOption::ParameterRequestList(codes)) => codes.clone(),
            _ => panic!("no parameter request list"),
        };
        assert!(prl.contains(&v4::OptionCode::SubnetMask));
        assert!(prl.contains(&v4::OptionCode::Router));
        assert!(prl.contains(&v4::OptionCode::DomainNameServer));
        assert!(prl.contains(&v4::OptionCode::AddressLeaseTime));
    }

    #[test]
    fn request_includes_server_identifier_and_requested_ip() {
        let mac = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06];
        let requested_ip: Ipv4Addr = "192.168.1.50".parse().unwrap();
        let server_id: Ipv4Addr = "192.168.1.1".parse().unwrap();
        let bytes = build_request(99, &mac, requested_ip, server_id, None).unwrap();
        let msg = decode_msg(&bytes);
        assert!(msg.opts().has_msg_type(v4::MessageType::Request));
        match msg.opts().get(v4::OptionCode::RequestedIpAddress) {
            Some(v4::DhcpOption::RequestedIpAddress(ip)) => assert_eq!(*ip, requested_ip),
            _ => panic!("no requested ip"),
        }
        match msg.opts().get(v4::OptionCode::ServerIdentifier) {
            Some(v4::DhcpOption::ServerIdentifier(ip)) => assert_eq!(*ip, server_id),
            _ => panic!("no server identifier"),
        }
    }

    fn make_ack(
        yiaddr: Ipv4Addr,
        subnet: Option<Ipv4Addr>,
        gateway: Option<Ipv4Addr>,
        dns: Option<Vec<Ipv4Addr>>,
        lease: Option<u32>,
        t1: Option<u32>,
        t2: Option<u32>,
    ) -> v4::Message {
        let mut msg = v4::Message::default();
        msg.set_opcode(v4::Opcode::BootReply);
        msg.set_yiaddr(yiaddr);
        msg.opts_mut()
            .insert(v4::DhcpOption::MessageType(v4::MessageType::Ack));
        if let Some(s) = subnet {
            msg.opts_mut().insert(v4::DhcpOption::SubnetMask(s));
        }
        if let Some(g) = gateway {
            msg.opts_mut().insert(v4::DhcpOption::Router(vec![g]));
        }
        if let Some(d) = dns {
            msg.opts_mut().insert(v4::DhcpOption::DomainNameServer(d));
        }
        if let Some(l) = lease {
            msg.opts_mut().insert(v4::DhcpOption::AddressLeaseTime(l));
        }
        if let Some(t) = t1 {
            msg.opts_mut().insert(v4::DhcpOption::Renewal(t));
        }
        if let Some(t) = t2 {
            msg.opts_mut().insert(v4::DhcpOption::Rebinding(t));
        }
        msg
    }

    #[test]
    fn extract_lease_parses_all_fields() {
        let ip: Ipv4Addr = "10.10.10.5".parse().unwrap();
        let subnet: Ipv4Addr = "255.255.0.0".parse().unwrap();
        let gw: Ipv4Addr = "10.10.0.1".parse().unwrap();
        let dns: Ipv4Addr = "8.8.8.8".parse().unwrap();
        let msg = make_ack(ip, Some(subnet), Some(gw), Some(vec![dns]), Some(7200), Some(3600), Some(6300));
        let lease = extract_lease(&msg).unwrap();
        assert_eq!(lease.address, ip);
        assert_eq!(lease.subnet_mask, subnet);
        assert_eq!(lease.gateway, gw);
        assert_eq!(lease.dns_servers, vec![dns]);
        assert_eq!(lease.lease_duration_secs, 7200);
        assert_eq!(lease.t1_secs, 3600);
        assert_eq!(lease.t2_secs, 6300);
    }

    #[test]
    fn extract_lease_defaults_t1_t2_when_absent() {
        let ip: Ipv4Addr = "10.0.0.10".parse().unwrap();
        let msg = make_ack(ip, None, None, None, Some(3600), None, None);
        let lease = extract_lease(&msg).unwrap();
        assert_eq!(lease.lease_duration_secs, 3600);
        assert_eq!(lease.t1_secs, 1800);
        assert_eq!(lease.t2_secs, 3150);
    }
}
