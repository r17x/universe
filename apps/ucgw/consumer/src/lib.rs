use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use std::sync::Arc;

use dhcproto::v4::{self, Decodable, Encodable};
use types::channel::ResolverConfigWatch;
use hickory_resolver::config::{NameServerConfig, ResolverConfig};
use hickory_resolver::TokioResolver;
use hickory_server::net::runtime::Time as HickoryTime;
use hickory_server::proto::op::{Header, HeaderCounts, MessageType, Metadata, OpCode, ResponseCode};
use hickory_server::server::{Request, RequestHandler, ResponseHandler, ResponseInfo};
use hickory_server::zone_handler::MessageResponseBuilder;
use hickory_server::Server;
use socket2::{Domain, Protocol, Socket, Type};
use tokio::net::UdpSocket;
use tokio::sync::{Mutex, RwLock};
use tokio::time::Instant;
use tracing::{debug, error, warn};

#[derive(Debug, thiserror::Error)]
pub enum ConsumerError {
    #[error("socket error: {0}")]
    SocketError(#[from] std::io::Error),
    #[error("dhcp error: {0}")]
    DhcpError(String),
    #[error("dns error: {0}")]
    DnsError(String),
    #[error("address pool exhausted")]
    PoolExhausted,
    #[error("channel error")]
    ChannelError,
}

struct LeaseEntry {
    ip: Ipv4Addr,
    expires: Instant,
}

pub(crate) struct LeasePool {
    start: u32,
    end: u32,
    leases: HashMap<[u8; 6], LeaseEntry>,
    ip_to_mac: HashMap<Ipv4Addr, [u8; 6]>,
    lease_duration_secs: u32,
}

impl LeasePool {
    pub(crate) fn new(start: Ipv4Addr, end: Ipv4Addr, lease_duration_secs: u32) -> Self {
        Self {
            start: u32::from(start),
            end: u32::from(end),
            leases: HashMap::new(),
            ip_to_mac: HashMap::new(),
            lease_duration_secs,
        }
    }

    pub(crate) fn assign(&mut self, mac: [u8; 6]) -> Option<Ipv4Addr> {
        if let Some(entry) = self.leases.get_mut(&mac) {
            entry.expires = Instant::now()
                + tokio::time::Duration::from_secs(self.lease_duration_secs as u64);
            return Some(entry.ip);
        }
        let mut candidate = self.start;
        while candidate <= self.end {
            let ip = Ipv4Addr::from(candidate);
            if !self.ip_to_mac.contains_key(&ip) {
                let expires = Instant::now()
                    + tokio::time::Duration::from_secs(self.lease_duration_secs as u64);
                let entry = LeaseEntry { ip, expires };
                self.leases.insert(mac, entry);
                self.ip_to_mac.insert(ip, mac);
                return Some(ip);
            }
            candidate += 1;
        }
        None
    }

    pub(crate) fn commit(&mut self, mac: [u8; 6], ip: Ipv4Addr) -> bool {
        if let Some(entry) = self.leases.get_mut(&mac) {
            if entry.ip == ip {
                entry.expires = Instant::now()
                    + tokio::time::Duration::from_secs(self.lease_duration_secs as u64);
                return true;
            }
        }
        let expires =
            Instant::now() + tokio::time::Duration::from_secs(self.lease_duration_secs as u64);
        let entry = LeaseEntry { ip, expires };
        self.leases.insert(mac, entry);
        self.ip_to_mac.insert(ip, mac);
        true
    }

    pub(crate) fn release(&mut self, mac: [u8; 6]) {
        if let Some(entry) = self.leases.remove(&mac) {
            self.ip_to_mac.remove(&entry.ip);
        }
    }
}

fn servfail_response_info() -> ResponseInfo {
    let metadata = Metadata::new(0, MessageType::Response, OpCode::Query);
    ResponseInfo::from(Header {
        metadata,
        counts: HeaderCounts::default(),
    })
}

struct ForwardHandler {
    resolver: Arc<RwLock<TokioResolver>>,
}

#[async_trait::async_trait]
impl RequestHandler for ForwardHandler {
    async fn handle_request<R: ResponseHandler, T: HickoryTime>(
        &self,
        request: &Request,
        mut response_handle: R,
    ) -> ResponseInfo {
        let info = match request.request_info() {
            Ok(i) => i,
            Err(_) => {
                let meta = Metadata::new(0, MessageType::Response, OpCode::Query);
                let builder = MessageResponseBuilder::from_message_request(request);
                let response = builder.error_msg(&meta, ResponseCode::ServFail);
                return response_handle
                    .send_response(response)
                    .await
                    .unwrap_or_else(|_| servfail_response_info());
            }
        };

        let name = info.query.name().clone();
        let record_type = info.query.query_type();

        let lookup_result = {
            let resolver = self.resolver.read().await;
            resolver.lookup(name.clone(), record_type).await
        };

        let builder = MessageResponseBuilder::from_message_request(request);

        match lookup_result {
            Ok(lookup) => {
                let mut meta = Metadata::response_from_request(info.metadata);
                meta.authoritative = false;
                meta.recursion_available = true;
                meta.response_code = ResponseCode::NoError;
                let answers: Vec<_> = lookup.answers().iter().collect();
                let response = builder.build(meta, answers.iter().copied(), [], [], []);
                response_handle
                    .send_response(response)
                    .await
                    .unwrap_or_else(|_| servfail_response_info())
            }
            Err(e) => {
                let code = if e.is_nx_domain() {
                    ResponseCode::NXDomain
                } else {
                    ResponseCode::ServFail
                };
                let meta = Metadata::response_from_request(info.metadata);
                let response = builder.error_msg(&meta, code);
                response_handle
                    .send_response(response)
                    .await
                    .unwrap_or_else(|_| servfail_response_info())
            }
        }
    }
}

pub struct Consumer {
    consumer_interface: String,
    server_ip: Ipv4Addr,
    pool_start: Ipv4Addr,
    pool_end: Ipv4Addr,
    subnet_mask: Ipv4Addr,
    resolver_watch: ResolverConfigWatch,
}

impl Consumer {
    pub fn new(
        consumer_interface: String,
        server_ip: Ipv4Addr,
        pool_start: Ipv4Addr,
        pool_end: Ipv4Addr,
        subnet_mask: Ipv4Addr,
        resolver_watch: ResolverConfigWatch,
    ) -> Self {
        Self {
            consumer_interface,
            server_ip,
            pool_start,
            pool_end,
            subnet_mask,
            resolver_watch,
        }
    }

    pub async fn run(
        self,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> Result<(), ConsumerError> {
        let lease_pool = Arc::new(Mutex::new(LeasePool::new(
            self.pool_start,
            self.pool_end,
            3600,
        )));

        let upstream_servers = {
            let cfg = self.resolver_watch.borrow();
            match cfg.as_ref() {
                Some(rc) => rc.dns_servers.clone(),
                None => vec![Ipv4Addr::new(8, 8, 8, 8)],
            }
        };

        let resolver = Arc::new(RwLock::new(build_resolver(&upstream_servers)?));

        let dhcp_socket = bind_dhcp_socket(&self.consumer_interface, self.server_ip)?;
        let dns_socket = bind_dns_socket(&self.consumer_interface, self.server_ip)?;

        let handler = ForwardHandler {
            resolver: resolver.clone(),
        };
        let mut dns_server = Server::new(handler);
        dns_server.register_socket(dns_socket);

        let server_ip = self.server_ip;
        let subnet_mask = self.subnet_mask;
        let mut resolver_watch = self.resolver_watch.clone();
        let resolver_for_watch = resolver.clone();

        let dhcp_handle =
            tokio::spawn(run_dhcp_server(dhcp_socket, lease_pool, server_ip, subnet_mask));
        let dhcp_abort = dhcp_handle.abort_handle();

        let watch_task = tokio::spawn(async move {
            loop {
                if resolver_watch.changed().await.is_err() {
                    break;
                }
                let servers = {
                    let cfg = resolver_watch.borrow();
                    cfg.as_ref().map(|rc| rc.dns_servers.clone())
                };
                if let Some(servers) = servers {
                    match build_resolver(&servers) {
                        Ok(new_resolver) => {
                            let mut guard = resolver_for_watch.write().await;
                            *guard = new_resolver;
                        }
                        Err(e) => {
                            warn!("failed to rebuild resolver: {e}");
                        }
                    }
                }
            }
        });

        tokio::select! {
            _ = shutdown.changed() => {
                let _ = dns_server.shutdown_gracefully().await;
                dhcp_abort.abort();
                watch_task.abort();
            }
            result = dns_server.block_until_done() => {
                dhcp_abort.abort();
                watch_task.abort();
                if let Err(e) = result {
                    return Err(ConsumerError::DnsError(e.to_string()));
                }
            }
            result = dhcp_handle => {
                watch_task.abort();
                match result {
                    Ok(Err(e)) => return Err(e),
                    Err(e) => return Err(ConsumerError::DhcpError(e.to_string())),
                    Ok(Ok(())) => {}
                }
            }
        }

        Ok(())
    }
}

fn build_resolver(upstream_servers: &[Ipv4Addr]) -> Result<TokioResolver, ConsumerError> {
    let name_servers: Vec<NameServerConfig> = upstream_servers
        .iter()
        .map(|ip| NameServerConfig::udp_and_tcp(std::net::IpAddr::V4(*ip)))
        .collect();

    let config = ResolverConfig::from_parts(None, vec![], name_servers);
    TokioResolver::builder_with_config(
        config,
        hickory_server::net::runtime::TokioRuntimeProvider::default(),
    )
    .build()
    .map_err(|e| ConsumerError::DnsError(e.to_string()))
}

fn bind_dhcp_socket(interface: &str, server_ip: Ipv4Addr) -> Result<std::net::UdpSocket, ConsumerError> {
    let socket = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP))?;
    socket.set_reuse_address(true)?;
    socket.set_broadcast(true)?;
    #[cfg(any(target_os = "android", target_os = "fuchsia", target_os = "linux"))]
    socket.bind_device(Some(interface.as_bytes()))?;
    #[cfg(not(any(target_os = "android", target_os = "fuchsia", target_os = "linux")))]
    let _ = interface;
    let addr = SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, 67);
    socket.bind(&socket2::SockAddr::from(addr))?;
    let _ = server_ip;
    Ok(socket.into())
}

fn bind_dns_socket(interface: &str, server_ip: Ipv4Addr) -> Result<UdpSocket, ConsumerError> {
    let socket = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP))?;
    socket.set_reuse_address(true)?;
    #[cfg(any(target_os = "android", target_os = "fuchsia", target_os = "linux"))]
    socket.bind_device(Some(interface.as_bytes()))?;
    #[cfg(not(any(target_os = "android", target_os = "fuchsia", target_os = "linux")))]
    let _ = interface;
    let addr = SocketAddrV4::new(server_ip, 53);
    socket.bind(&socket2::SockAddr::from(addr))?;
    socket.set_nonblocking(true)?;
    let std_sock: std::net::UdpSocket = socket.into();
    let tokio_sock = UdpSocket::from_std(std_sock)?;
    Ok(tokio_sock)
}

async fn run_dhcp_server(
    std_socket: std::net::UdpSocket,
    pool: Arc<Mutex<LeasePool>>,
    server_ip: Ipv4Addr,
    subnet_mask: Ipv4Addr,
) -> Result<(), ConsumerError> {
    std_socket.set_nonblocking(true)?;
    let socket = UdpSocket::from_std(std_socket)?;
    let mut buf = [0u8; 1500];

    loop {
        let (len, src) = socket.recv_from(&mut buf).await?;
        let msg = match v4::Message::from_bytes(&buf[..len]) {
            Ok(m) => m,
            Err(e) => {
                warn!("dhcp decode error from {src}: {e}");
                continue;
            }
        };

        let msg_type = match msg.opts().get(v4::OptionCode::MessageType) {
            Some(v4::DhcpOption::MessageType(t)) => *t,
            _ => continue,
        };

        let mac = extract_mac(msg.chaddr());

        match msg_type {
            v4::MessageType::Discover => {
                let assigned = {
                    let mut p = pool.lock().await;
                    p.assign(mac)
                };
                match assigned {
                    Some(ip) => {
                        let reply =
                            build_offer(&msg, ip, server_ip, subnet_mask, server_ip, 3600);
                        send_reply(&socket, reply, src).await;
                    }
                    None => {
                        debug!("pool exhausted, dropping DISCOVER from {src}");
                    }
                }
            }
            v4::MessageType::Request => {
                let requested_ip = msg
                    .opts()
                    .get(v4::OptionCode::RequestedIpAddress)
                    .and_then(|o| {
                        if let v4::DhcpOption::RequestedIpAddress(ip) = o {
                            Some(*ip)
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| msg.ciaddr());

                let committed = {
                    let mut p = pool.lock().await;
                    p.commit(mac, requested_ip)
                };

                if committed {
                    let reply =
                        build_ack(&msg, requested_ip, server_ip, subnet_mask, server_ip, 3600);
                    send_reply(&socket, reply, src).await;
                } else {
                    error!("could not commit lease for {mac:?}");
                }
            }
            v4::MessageType::Release => {
                let mut p = pool.lock().await;
                p.release(mac);
            }
            _ => {}
        }
    }
}

fn extract_mac(chaddr: &[u8]) -> [u8; 6] {
    let mut mac = [0u8; 6];
    let len = chaddr.len().min(6);
    mac[..len].copy_from_slice(&chaddr[..len]);
    mac
}

fn build_offer(
    msg: &v4::Message,
    assigned_ip: Ipv4Addr,
    server_ip: Ipv4Addr,
    subnet_mask: Ipv4Addr,
    dns_ip: Ipv4Addr,
    lease_secs: u32,
) -> v4::Message {
    let mut reply = v4::Message::default();
    reply.set_opcode(v4::Opcode::BootReply);
    reply.set_htype(v4::HType::Eth);
    reply.set_xid(msg.xid());
    reply.set_chaddr(msg.chaddr());
    reply.set_yiaddr(assigned_ip);
    reply.set_siaddr(server_ip);
    reply
        .opts_mut()
        .insert(v4::DhcpOption::MessageType(v4::MessageType::Offer));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::ServerIdentifier(server_ip));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::AddressLeaseTime(lease_secs));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::Renewal(lease_secs / 2));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::Rebinding(lease_secs * 7 / 8));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::SubnetMask(subnet_mask));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::Router(vec![server_ip]));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::DomainNameServer(vec![dns_ip]));
    reply
}

fn build_ack(
    msg: &v4::Message,
    assigned_ip: Ipv4Addr,
    server_ip: Ipv4Addr,
    subnet_mask: Ipv4Addr,
    dns_ip: Ipv4Addr,
    lease_secs: u32,
) -> v4::Message {
    let mut reply = v4::Message::default();
    reply.set_opcode(v4::Opcode::BootReply);
    reply.set_htype(v4::HType::Eth);
    reply.set_xid(msg.xid());
    reply.set_chaddr(msg.chaddr());
    reply.set_yiaddr(assigned_ip);
    reply.set_siaddr(server_ip);
    reply
        .opts_mut()
        .insert(v4::DhcpOption::MessageType(v4::MessageType::Ack));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::ServerIdentifier(server_ip));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::AddressLeaseTime(lease_secs));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::Renewal(lease_secs / 2));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::Rebinding(lease_secs * 7 / 8));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::SubnetMask(subnet_mask));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::Router(vec![server_ip]));
    reply
        .opts_mut()
        .insert(v4::DhcpOption::DomainNameServer(vec![dns_ip]));
    reply
}

async fn send_reply(socket: &UdpSocket, reply: v4::Message, src: SocketAddr) {
    match reply.to_vec() {
        Ok(bytes) => {
            let broadcast = SocketAddr::new(std::net::IpAddr::V4(Ipv4Addr::BROADCAST), 68);
            let target = if src.ip().is_unspecified() {
                broadcast
            } else {
                src
            };
            if let Err(e) = socket.send_to(&bytes, target).await {
                warn!("failed to send dhcp reply: {e}");
            }
        }
        Err(e) => {
            warn!("failed to encode dhcp reply: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pool(start: &str, end: &str) -> LeasePool {
        LeasePool::new(start.parse().unwrap(), end.parse().unwrap(), 3600)
    }

    #[test]
    fn allocates_sequentially_from_start() {
        let mut p = pool("10.0.0.10", "10.0.0.15");
        let mac1 = [0x01, 0x00, 0x00, 0x00, 0x00, 0x01];
        let mac2 = [0x01, 0x00, 0x00, 0x00, 0x00, 0x02];
        let ip1 = p.assign(mac1).unwrap();
        let ip2 = p.assign(mac2).unwrap();
        assert_eq!(ip1, "10.0.0.10".parse::<Ipv4Addr>().unwrap());
        assert_eq!(ip2, "10.0.0.11".parse::<Ipv4Addr>().unwrap());
    }

    #[test]
    fn same_mac_gets_same_ip() {
        let mut p = pool("10.0.0.10", "10.0.0.20");
        let mac = [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF];
        let ip1 = p.assign(mac).unwrap();
        let ip2 = p.assign(mac).unwrap();
        assert_eq!(ip1, ip2);
    }

    #[test]
    fn pool_exhaustion_returns_none() {
        let mut p = pool("10.0.0.10", "10.0.0.11");
        let mac1 = [0x01, 0x00, 0x00, 0x00, 0x00, 0x01];
        let mac2 = [0x01, 0x00, 0x00, 0x00, 0x00, 0x02];
        let mac3 = [0x01, 0x00, 0x00, 0x00, 0x00, 0x03];
        assert!(p.assign(mac1).is_some());
        assert!(p.assign(mac2).is_some());
        assert!(p.assign(mac3).is_none());
    }

    #[test]
    fn release_frees_ip_for_reuse() {
        let mut p = pool("10.0.0.10", "10.0.0.11");
        let mac1 = [0x01, 0x00, 0x00, 0x00, 0x00, 0x01];
        let mac2 = [0x01, 0x00, 0x00, 0x00, 0x00, 0x02];
        let mac3 = [0x01, 0x00, 0x00, 0x00, 0x00, 0x03];
        let ip1 = p.assign(mac1).unwrap();
        p.assign(mac2).unwrap();
        p.release(mac1);
        let ip3 = p.assign(mac3).unwrap();
        assert_eq!(ip1, ip3);
    }

    #[test]
    fn commit_registers_binding() {
        let mut p = pool("10.0.0.10", "10.0.0.20");
        let mac = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06];
        let ip: Ipv4Addr = "10.0.0.15".parse().unwrap();
        assert!(p.commit(mac, ip));
        let ip2 = p.assign(mac).unwrap();
        assert_eq!(ip2, ip);
    }

    #[test]
    fn release_nonexistent_is_noop() {
        let mut p = pool("10.0.0.10", "10.0.0.20");
        let mac = [0xFF; 6];
        p.release(mac);
    }
}
