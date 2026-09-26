use std::net::{IpAddr, Ipv4Addr};
use std::path::PathBuf;
use std::str::FromStr;

use usb::Usb;
use mesh::Mesh;
use control::Control;
use iface::Iface;
use address::Address;
use route::Route;
use forward::Forward;
use nat::Nat;
use consumer::Consumer;
use overlay::Overlay;
use tunnel::Tunnel;
use types::channel::{
    AdmissionSender, AddressBindingStateSender, CounterSnapshotSender, UsbEventSender,
    ForwardEventSender, OverlayEventSender, InterfaceIdentitySender, ResolverConfigSender,
    RouteCommandReceiver, RouteCommandSender,
};
use types::{AddressBindingState, Allowlist, PeerId, RouteCommand};
use types_usb::channel::InterfaceRecordSender;
use tokio::sync::{mpsc, oneshot, watch};
use tokio::task::JoinSet;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let config_path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/etc/ucgw/config.toml"));

    let (admission_tx, admission_rx): (AdmissionSender, _) = mpsc::channel(64);

    let d11 = Control::new(config_path, admission_rx)?;
    let config = d11.config().clone();

    let consumer_subnet_str = config.network.consumer_subnet.clone();
    let consumer_gateway_str = config.network.consumer_gateway.clone();

    let (consumer_subnet_addr, consumer_prefix_len) =
        parse_cidr(&consumer_subnet_str).unwrap_or((Ipv4Addr::new(192, 168, 100, 0), 24));

    let consumer_gateway: Ipv4Addr = consumer_gateway_str
        .parse()
        .unwrap_or(Ipv4Addr::new(192, 168, 100, 1));

    let pool_start = Ipv4Addr::new(
        consumer_subnet_addr.octets()[0],
        consumer_subnet_addr.octets()[1],
        consumer_subnet_addr.octets()[2],
        100,
    );
    let pool_end = Ipv4Addr::new(
        consumer_subnet_addr.octets()[0],
        consumer_subnet_addr.octets()[1],
        consumer_subnet_addr.octets()[2],
        200,
    );
    let consumer_subnet_mask = prefix_len_to_mask(consumer_prefix_len);

    let overlay_enabled = config.overlay.enabled;
    let dry_run = config.gateway.dry_run;

    if dry_run {
        tracing::info!("DRY RUN MODE — no network modifications will be made");
    }

    let allowlist = build_allowlist(&config.admission.peers);

    let iroh_secret_key = if overlay_enabled {
        if let Some(ref path) = config.overlay.secret_key_path {
            load_or_generate_secret_key(path)
        } else {
            iroh::SecretKey::generate()
        }
    } else {
        iroh::SecretKey::generate()
    };

    let local_peer_id = PeerId(*iroh_secret_key.public().as_bytes());

    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    let shutdown_tx_signal = shutdown_tx.clone();
    tokio::spawn(async move {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to listen for ctrl+c");
        tracing::info!("shutdown signal received");
        let _ = shutdown_tx_signal.send(true);
    });

    let mut tasks: JoinSet<()> = JoinSet::new();

    let (resolver_tx, resolver_rx): (ResolverConfigSender, _) = watch::channel(None);
    let (route_cmd_tx, route_cmd_rx): (RouteCommandSender, RouteCommandReceiver) =
        mpsc::channel(64);

    let d4 = Route::new(route_cmd_rx);
    tasks.spawn(async move {
        if let Err(e) = d4.run().await {
            tracing::error!(error = %e, "route exited with error");
        }
    });

    let iface_name = if let Some(ref name) = config.gateway.upstream_interface {
        tracing::info!(iface = %name, "using configured upstream interface (bypass mode)");

        let iface_index = resolve_interface_index(name);
        tracing::info!(iface = %name, index = iface_index, "interface resolved");

        let iface_addr = resolve_interface_address(name);
        let gateway = resolve_default_gateway(name).await;

        if let (Some(addr), Some(gw)) = (iface_addr, gateway) {
            tracing::info!(ip = %addr, gateway = %gw, "upstream address detected");
            let _ = resolver_tx.send(Some(types::ResolverConfiguration {
                dns_servers: vec![gw],
                domain: None,
            }));
        } else {
            tracing::info!("upstream address/gateway not detected, DNS will use 8.8.8.8");
        }

        name.clone()
    } else {
        tracing::info!("stage 1: USB binding + interface discovery");

        let (iface_record_tx, iface_record_rx): (InterfaceRecordSender, _) = watch::channel(None);
        let (iface_identity_tx, iface_identity_rx): (InterfaceIdentitySender, _) =
            watch::channel(None);
        let (d1_event_tx, mut d1_event_rx): (UsbEventSender, _) = mpsc::channel(64);

        let d1 = Usb::new(
            iface_record_tx,
            iface_identity_tx.clone(),
            d1_event_tx,
        );
        let d2 = Iface::new(iface_record_rx, iface_identity_tx);

        tasks.spawn(async move {
            if let Err(e) = d1.run().await {
                tracing::error!(error = %e, "usb exited with error");
            }
        });

        tasks.spawn(async move {
            if let Err(e) = d2.run().await {
                tracing::error!(error = %e, "iface exited with error");
            }
        });

        tokio::spawn(async move {
            while let Some(event) = d1_event_rx.recv().await {
                tracing::debug!(event = ?event, "usb event");
            }
        });

        tracing::info!("waiting for interface identity");
        let (name, iface_index) = {
            let mut watch = iface_identity_rx.clone();
            loop {
                if let Some(ref identity) = *watch.borrow() {
                    break (identity.name.clone(), identity.index);
                }
                if watch.changed().await.is_err() {
                    return Err("interface identity channel closed before interface appeared".into());
                }
                if let Some(ref identity) = *watch.borrow() {
                    break (identity.name.clone(), identity.index);
                }
            }
        };
        tracing::info!(iface = %name, "interface ready");

        tracing::info!("stage 2: DHCP client + routing");

        let (binding_state_tx, _binding_state_rx): (AddressBindingStateSender, _) =
            watch::channel(AddressBindingState::Unbound);

        let d3 = Address::new(
            iface_identity_rx.clone(),
            binding_state_tx.clone(),
            resolver_tx.clone(),
        );

        tasks.spawn(async move {
            if let Err(e) = d3.run().await {
                tracing::error!(error = %e, "address exited with error");
            }
        });

        tracing::info!("waiting for DHCP bind");
        let lease = {
            let mut watch = _binding_state_rx;
            loop {
                match &*watch.borrow() {
                    AddressBindingState::Bound(lease) => break lease.clone(),
                    AddressBindingState::Renewing(lease) => break lease.clone(),
                    AddressBindingState::Rebinding(lease) => break lease.clone(),
                    _ => {}
                }
                if watch.changed().await.is_err() {
                    return Err("binding state channel closed before DHCP bound".into());
                }
                match &*watch.borrow() {
                    AddressBindingState::Bound(lease) => break lease.clone(),
                    AddressBindingState::Renewing(lease) => break lease.clone(),
                    AddressBindingState::Rebinding(lease) => break lease.clone(),
                    _ => {}
                }
            }
        };
        tracing::info!(
            ip = %lease.address,
            gateway = %lease.gateway,
            "DHCP bound, setting default route"
        );

        let (resp_tx, resp_rx) = oneshot::channel();
        let _ = route_cmd_tx
            .send((
                RouteCommand::SetDefault {
                    gateway: IpAddr::V4(lease.gateway),
                    interface_index: iface_index,
                },
                resp_tx,
            ))
            .await;
        match resp_rx.await {
            Ok(Ok(_)) => tracing::info!("default route set via {}", lease.gateway),
            Ok(Err(e)) => tracing::warn!(error = %e, "failed to set default route"),
            Err(_) => tracing::warn!("route response dropped"),
        }

        name
    };

    if dry_run {
        tracing::info!("stage 3 [dry-run]: would enable IP forwarding + NAT on {}", iface_name);
        tracing::info!(
            "  sysctl net.inet.ip.forwarding=1, NAT masquerade on {} for {}/{}",
            iface_name, consumer_subnet_addr, consumer_prefix_len
        );
        tracing::info!("stage 4 [dry-run]: would start consumer DHCP on :67, DNS on {}",
            config.network.dns_listen);
        tracing::info!(
            "  DHCP pool {}-{}, gateway {}, subnet mask {}",
            pool_start, pool_end, consumer_gateway, consumer_subnet_mask
        );
    } else {
        tracing::info!("stage 3: IP forwarding + NAT");

        let (counter_tx, _counter_rx): (CounterSnapshotSender, _) = watch::channel(None);
        let (d5_event_tx, mut d5_event_rx): (ForwardEventSender, _) = mpsc::channel(64);

        let d5 = Forward::new(
            iface_name.clone(),
            local_peer_id,
            counter_tx,
            d5_event_tx,
        );
        let d6 = Nat::new(
            iface_name.clone(),
            consumer_subnet_addr,
            consumer_prefix_len,
        );

        let shutdown_rx_d5 = shutdown_rx.clone();
        let shutdown_rx_d6 = shutdown_rx.clone();

        tasks.spawn(async move {
            if let Err(e) = d5.run(shutdown_rx_d5).await {
                tracing::error!(error = %e, "forward exited with error");
            }
        });

        tasks.spawn(async move {
            if let Err(e) = d6.run(shutdown_rx_d6).await {
                tracing::error!(error = %e, "nat exited with error");
            }
        });

        tokio::spawn(async move {
            while let Some(event) = d5_event_rx.recv().await {
                tracing::debug!(event = ?event, "forward event");
            }
        });

        tracing::info!("stage 4: consumer services");

        let consumer_iface = config
            .network
            .dns_listen
            .split(':')
            .next()
            .and_then(|addr_str| {
                if addr_str.is_empty() || addr_str == "0.0.0.0" {
                    None
                } else {
                    Some(addr_str.to_string())
                }
            })
            .unwrap_or_else(|| "br0".to_string());

        let d7 = Consumer::new(
            consumer_iface,
            consumer_gateway,
            pool_start,
            pool_end,
            consumer_subnet_mask,
            resolver_rx.clone(),
        );

        let shutdown_rx_d7 = shutdown_rx.clone();

        tasks.spawn(async move {
            if let Err(e) = d7.run(shutdown_rx_d7).await {
                tracing::error!(error = %e, "consumer exited with error");
            }
        });
    }

    tracing::info!("stage 4b: overlay + mesh");

    let (d8_event_tx, mut d8_event_rx): (OverlayEventSender, _) = mpsc::channel(64);
    let (admitted_peer_tx, mut admitted_peer_rx): (
        types_overlay::channel::AdmittedPeerSender,
        types_overlay::channel::AdmittedPeerReceiver,
    ) = mpsc::channel(64);

    let mut d8 = Overlay::new(allowlist, d8_event_tx, admission_tx, admitted_peer_tx);

    let overlay_handle = if overlay_enabled {
        match d8.start().await {
            Ok(handle) => {
                tracing::info!(
                    node_id = %handle.endpoint.id(),
                    "overlay endpoint started — use this node_id to connect"
                );
                Some(handle)
            }
            Err(e) => {
                tracing::error!(error = %e, "overlay start failed");
                None
            }
        }
    } else {
        None
    };

    let shutdown_rx_d8 = shutdown_rx.clone();
    let shutdown_rx_d10 = shutdown_rx.clone();

    tasks.spawn(async move {
        if let Err(e) = d8.run(shutdown_rx_d8).await {
            tracing::error!(error = %e, "overlay exited with error");
        }
    });

    if overlay_enabled {
        if let Some(ref handle) = overlay_handle {
            let (peer_tx, mut peer_rx) = mpsc::channel(64);

            let signing_key = iroh_secret_key.as_signing_key().clone();

            let gossip = iroh_gossip::net::Gossip::builder().spawn(handle.endpoint.clone());

            let d10 = Mesh::new(gossip, signing_key, vec![], peer_tx);

            tasks.spawn(async move {
                if let Err(e) = d10.run(shutdown_rx_d10).await {
                    tracing::error!(error = %e, "mesh exited with error");
                }
            });

            tokio::spawn(async move {
                while let Some(peer) = peer_rx.recv().await {
                    tracing::debug!(peer = ?peer.peer_id, "discovered mesh peer");
                }
            });
        } else {
            drop(shutdown_rx_d10);
        }
    } else {
        drop(shutdown_rx_d10);
    }

    if dry_run {
        tracing::info!("stage 5 [dry-run]: would create TUN device at 10.200.0.1/16");
    } else {
        tracing::info!("stage 5: tunnel");

        let tun_address = Ipv4Addr::new(10, 200, 0, 1);
        let tun_netmask = Ipv4Addr::new(255, 255, 0, 0);

        let d9 = Tunnel::new(tun_address, tun_netmask);
        let tunnel_handle = d9.handle();
        let shutdown_rx_d9 = shutdown_rx.clone();

        tasks.spawn(async move {
            if let Err(e) = d9.run(shutdown_rx_d9).await {
                tracing::error!(error = %e, "tunnel exited with error");
            }
        });

        let tunnel_handle_events = tunnel_handle.clone();
        tokio::spawn(async move {
            while let Some(admitted) = admitted_peer_rx.recv().await {
                tracing::info!(
                    peer = ?admitted.peer_id,
                    inner = %admitted.inner_address,
                    "wiring admitted peer to tunnel"
                );
                if let Err(e) = tunnel_handle_events
                    .add_peer(admitted.peer_id, admitted.inner_address, admitted.connection)
                    .await
                {
                    tracing::error!(error = %e, "failed to add peer to tunnel");
                }
            }
        });

        tokio::spawn(async move {
            while let Some(event) = d8_event_rx.recv().await {
                match event {
                    types::OverlayEvent::PeerDisconnected(peer_id) => {
                        tracing::info!(peer = ?peer_id, "removing disconnected peer from tunnel");
                        if let Err(e) = tunnel_handle.remove_peer(&peer_id).await {
                            tracing::warn!(error = %e, "failed to remove peer from tunnel");
                        }
                    }
                    other => {
                        tracing::debug!(event = ?other, "overlay event");
                    }
                }
            }
        });
    }

    let shutdown_rx_d11 = shutdown_rx.clone();
    tasks.spawn(async move {
        if let Err(e) = d11.run(shutdown_rx_d11).await {
            tracing::error!(error = %e, "control exited with error");
        }
    });

    tracing::info!("all stages started, running");

    let mut shutdown_watch = shutdown_rx.clone();
    shutdown_watch.changed().await.ok();

    tracing::info!("initiating shutdown");
    let _ = shutdown_tx.send(true);

    if !dry_run {
        let (cleanup_resp_tx, cleanup_resp_rx) = oneshot::channel();
        let _ = route_cmd_tx
            .send((RouteCommand::FlushAll, cleanup_resp_tx))
            .await;
        let _ = cleanup_resp_rx.await;
    }
    drop(route_cmd_tx);

    tracing::info!("draining remaining tasks");
    while tasks.join_next().await.is_some() {}

    tracing::info!("shutdown complete");
    Ok(())
}

pub(crate) fn parse_cidr(cidr: &str) -> Option<(Ipv4Addr, u8)> {
    let mut parts = cidr.splitn(2, '/');
    let addr: Ipv4Addr = parts.next()?.parse().ok()?;
    let prefix: u8 = parts.next()?.parse().ok()?;
    Some((addr, prefix))
}

pub(crate) fn prefix_len_to_mask(prefix_len: u8) -> Ipv4Addr {
    if prefix_len == 0 {
        return Ipv4Addr::new(0, 0, 0, 0);
    }
    let bits = !0u32 << (32 - prefix_len as u32);
    Ipv4Addr::from(bits)
}

pub(crate) fn build_allowlist(peers: &[String]) -> Allowlist {
    use base64::Engine;
    let peer_ids = peers
        .iter()
        .filter_map(|s| {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(s)
                .ok()?;
            if bytes.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                Some(PeerId(arr))
            } else {
                None
            }
        })
        .collect();
    Allowlist { peers: peer_ids }
}

fn resolve_interface_index(name: &str) -> u32 {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("ifconfig")
            .arg("-v")
            .arg(name)
            .output()
            .ok();
        if let Some(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Some(line) = text.lines().next() {
                for (i, word) in line.split_whitespace().enumerate() {
                    if word == "index" {
                        if let Some(val) = line.split_whitespace().nth(i + 1) {
                            if let Ok(idx) = val.parse::<u32>() {
                                return idx;
                            }
                        }
                    }
                }
            }
        }
        0
    }
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string(format!("/sys/class/net/{}/ifindex", name))
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(0)
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = name;
        0
    }
}

fn resolve_interface_address(name: &str) -> Option<Ipv4Addr> {
    let output = std::process::Command::new("ifconfig")
        .arg(name)
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("inet ") {
            let addr_str = rest.split_whitespace().next()?;
            return addr_str.parse().ok();
        }
    }
    None
}

async fn resolve_default_gateway(_iface: &str) -> Option<Ipv4Addr> {
    #[cfg(target_os = "macos")]
    {
        let output = tokio::process::Command::new("route")
            .args(["-n", "get", "default", "-ifscope", _iface])
            .output()
            .await
            .ok()?;
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("gateway:") {
                return rest.trim().parse().ok();
            }
        }
        None
    }
    #[cfg(target_os = "linux")]
    {
        let output = tokio::process::Command::new("ip")
            .args(["route", "show", "default", "dev", _iface])
            .output()
            .await
            .ok()?;
        let text = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = text.split_whitespace().collect();
        for (i, word) in parts.iter().enumerate() {
            if *word == "via" {
                if let Some(gw) = parts.get(i + 1) {
                    return gw.parse().ok();
                }
            }
        }
        None
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

fn load_or_generate_secret_key(path: &str) -> iroh::SecretKey {
    match std::fs::read_to_string(path) {
        Ok(contents) => {
            let trimmed = contents.trim();
            iroh::SecretKey::from_str(trimmed).unwrap_or_else(|_| {
                tracing::warn!(path, "failed to parse secret key, generating new one");
                iroh::SecretKey::generate()
            })
        }
        Err(e) => {
            tracing::warn!(path, error = %e, "failed to read secret key file, generating new one");
            iroh::SecretKey::generate()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    #[test]
    fn parse_cidr_valid_24() {
        let result = parse_cidr("10.0.0.0/24");
        assert_eq!(result, Some(("10.0.0.0".parse().unwrap(), 24)));
    }

    #[test]
    fn parse_cidr_valid_16() {
        let result = parse_cidr("192.168.1.0/16");
        assert_eq!(result, Some(("192.168.1.0".parse().unwrap(), 16)));
    }

    #[test]
    fn parse_cidr_invalid_returns_none() {
        assert_eq!(parse_cidr("invalid"), None);
        assert_eq!(parse_cidr("10.0.0.0"), None);
        assert_eq!(parse_cidr("10.0.0.0/"), None);
        assert_eq!(parse_cidr("/24"), None);
    }

    #[test]
    fn prefix_len_to_mask_24() {
        let mask = prefix_len_to_mask(24);
        assert_eq!(mask, "255.255.255.0".parse::<Ipv4Addr>().unwrap());
    }

    #[test]
    fn prefix_len_to_mask_0() {
        let mask = prefix_len_to_mask(0);
        assert_eq!(mask, "0.0.0.0".parse::<Ipv4Addr>().unwrap());
    }

    #[test]
    fn prefix_len_to_mask_32() {
        let mask = prefix_len_to_mask(32);
        assert_eq!(mask, "255.255.255.255".parse::<Ipv4Addr>().unwrap());
    }

    #[test]
    fn prefix_len_to_mask_16() {
        let mask = prefix_len_to_mask(16);
        assert_eq!(mask, "255.255.0.0".parse::<Ipv4Addr>().unwrap());
    }

    #[test]
    fn build_allowlist_valid_peers() {
        let peer_bytes = [0x42u8; 32];
        let encoded = base64::engine::general_purpose::STANDARD.encode(peer_bytes);
        let list = build_allowlist(&[encoded]);
        assert_eq!(list.peers.len(), 1);
        assert_eq!(list.peers[0].0, peer_bytes);
    }

    #[test]
    fn build_allowlist_skips_invalid_base64() {
        let list = build_allowlist(&["!!!not base64".to_string()]);
        assert!(list.peers.is_empty());
    }

    #[test]
    fn build_allowlist_skips_wrong_length_bytes() {
        let short = base64::engine::general_purpose::STANDARD.encode([0u8; 10]);
        let list = build_allowlist(&[short]);
        assert!(list.peers.is_empty());
    }

    #[test]
    fn build_allowlist_empty_input() {
        let list = build_allowlist(&[]);
        assert!(list.peers.is_empty());
    }
}
