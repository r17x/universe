use std::net::{IpAddr, Ipv4Addr};

#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct PeerId(pub [u8; 32]);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InterfaceIdentity {
    pub name: String,
    pub index: u32,
    pub mac: [u8; 6],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AddressLease {
    pub address: Ipv4Addr,
    pub subnet_mask: Ipv4Addr,
    pub gateway: Ipv4Addr,
    pub dns_servers: Vec<Ipv4Addr>,
    pub lease_duration_secs: u32,
    pub t1_secs: u32,
    pub t2_secs: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AddressBindingState {
    Unbound,
    Discovering,
    Requesting,
    Bound(AddressLease),
    Renewing(AddressLease),
    Rebinding(AddressLease),
    Lost,
}

#[derive(Debug, Clone)]
pub struct ResolverConfiguration {
    pub dns_servers: Vec<Ipv4Addr>,
    pub domain: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CounterSnapshot {
    pub peer_id: PeerId,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub packets_in: u64,
    pub packets_out: u64,
}

#[derive(Debug, Clone)]
pub enum RouteCommand {
    Add {
        destination: IpAddr,
        prefix_len: u8,
        gateway: IpAddr,
        interface_index: u32,
    },
    Delete {
        destination: IpAddr,
        prefix_len: u8,
    },
    SetDefault {
        gateway: IpAddr,
        interface_index: u32,
    },
    FlushAll,
}

#[derive(Debug, Clone)]
pub struct RouteResult {
    pub success: bool,
}

#[derive(Debug, Clone, thiserror::Error)]
pub enum RouteError {
    #[error("route operation failed: {reason}")]
    OperationFailed { reason: String },
    #[error("route not found")]
    NotFound,
    #[error("route already exists")]
    AlreadyExists,
}

#[derive(Debug, Clone)]
pub enum UsbEvent {
    DeviceGone { device_id: String },
    BindingError { device_id: String, reason: String },
}

#[derive(Debug, Clone)]
pub enum ForwardEvent {
    ForwardingEnabled,
    ForwardingDisabled,
    CounterUpdate(CounterSnapshot),
}

#[derive(Debug, Clone)]
pub enum OverlayEvent {
    PeerConnected(PeerId),
    PeerDisconnected(PeerId),
    TransportError { reason: String },
}

#[derive(Debug, Clone)]
pub enum LifecycleCommand {
    Start,
    Stop,
    Flush,
}

#[derive(Debug, Clone)]
pub struct QuiescenceConfirmed;

#[derive(Debug, Clone, thiserror::Error)]
pub enum DomainError {
    #[error("domain startup failed: {domain}: {reason}")]
    StartupFailed { domain: String, reason: String },
    #[error("domain runtime error: {domain}: {reason}")]
    RuntimeError { domain: String, reason: String },
    #[error("domain shutdown failed: {domain}: {reason}")]
    ShutdownFailed { domain: String, reason: String },
}

#[derive(Debug)]
pub struct AdmissionRequest {
    pub peer_id: PeerId,
    pub response: tokio::sync::oneshot::Sender<AdmissionDecision>,
}

#[derive(Debug, Clone)]
pub enum AdmissionDecision {
    Admitted { inner_address: Ipv4Addr },
    Denied { reason: String },
}

#[derive(Debug, Clone, Default)]
pub struct Allowlist {
    pub peers: Vec<PeerId>,
}

impl Allowlist {
    pub fn contains(&self, peer: &PeerId) -> bool {
        self.peers.contains(peer)
    }
}

pub trait FrameCodec: Send + Sync + 'static {
    fn wrap(&self, payload: &[u8], output: &mut Vec<u8>);
    fn strip<'a>(&self, input: &'a [u8]) -> Option<&'a [u8]>;
}

pub mod channel {
    use super::{
        AddressBindingState, AdmissionRequest, CounterSnapshot, UsbEvent, ForwardEvent, OverlayEvent,
        DomainError, InterfaceIdentity, LifecycleCommand, QuiescenceConfirmed, ResolverConfiguration,
        RouteCommand, RouteError, RouteResult,
    };
    use tokio::sync::{mpsc, oneshot, watch};

    pub type InterfaceIdentityWatch = watch::Receiver<Option<InterfaceIdentity>>;
    pub type InterfaceIdentitySender = watch::Sender<Option<InterfaceIdentity>>;

    pub type AddressBindingStateWatch = watch::Receiver<AddressBindingState>;
    pub type AddressBindingStateSender = watch::Sender<AddressBindingState>;

    pub type ResolverConfigWatch = watch::Receiver<Option<ResolverConfiguration>>;
    pub type ResolverConfigSender = watch::Sender<Option<ResolverConfiguration>>;

    pub type CounterSnapshotWatch = watch::Receiver<Option<CounterSnapshot>>;
    pub type CounterSnapshotSender = watch::Sender<Option<CounterSnapshot>>;

    pub type UsbEventSender = mpsc::Sender<UsbEvent>;
    pub type UsbEventReceiver = mpsc::Receiver<UsbEvent>;

    pub type ForwardEventSender = mpsc::Sender<ForwardEvent>;
    pub type ForwardEventReceiver = mpsc::Receiver<ForwardEvent>;

    pub type OverlayEventSender = mpsc::Sender<OverlayEvent>;
    pub type OverlayEventReceiver = mpsc::Receiver<OverlayEvent>;

    pub type RouteCommandSender =
        mpsc::Sender<(RouteCommand, oneshot::Sender<Result<RouteResult, RouteError>>)>;
    pub type RouteCommandReceiver =
        mpsc::Receiver<(RouteCommand, oneshot::Sender<Result<RouteResult, RouteError>>)>;

    pub type LifecycleCommandSender = mpsc::Sender<(
        LifecycleCommand,
        oneshot::Sender<Result<QuiescenceConfirmed, DomainError>>,
    )>;
    pub type LifecycleCommandReceiver = mpsc::Receiver<(
        LifecycleCommand,
        oneshot::Sender<Result<QuiescenceConfirmed, DomainError>>,
    )>;

    pub type AdmissionSender = mpsc::Sender<AdmissionRequest>;
    pub type AdmissionReceiver = mpsc::Receiver<AdmissionRequest>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::net::IpAddr;
    use tokio::sync::{mpsc, oneshot, watch};

    #[test]
    fn peer_id_equality_and_hash() {
        let a = PeerId([1u8; 32]);
        let b = PeerId([1u8; 32]);
        let c = PeerId([2u8; 32]);
        assert_eq!(a, b);
        assert_ne!(a, c);
        let mut set = HashSet::new();
        set.insert(a.clone());
        assert!(set.contains(&b));
        assert!(!set.contains(&c));
    }

    #[test]
    fn allowlist_contains() {
        let p1 = PeerId([1u8; 32]);
        let p2 = PeerId([2u8; 32]);
        let p3 = PeerId([3u8; 32]);
        let list = Allowlist {
            peers: vec![p1.clone(), p2.clone()],
        };
        assert!(list.contains(&p1));
        assert!(list.contains(&p2));
        assert!(!list.contains(&p3));
    }

    #[test]
    fn allowlist_empty() {
        let list = Allowlist::default();
        assert!(!list.contains(&PeerId([0u8; 32])));
    }

    #[test]
    fn address_binding_state_transitions() {
        let lease = AddressLease {
            address: "10.0.0.5".parse().unwrap(),
            subnet_mask: "255.255.255.0".parse().unwrap(),
            gateway: "10.0.0.1".parse().unwrap(),
            dns_servers: vec![],
            lease_duration_secs: 3600,
            t1_secs: 1800,
            t2_secs: 3150,
        };

        let unbound = AddressBindingState::Unbound;
        let discovering = AddressBindingState::Discovering;
        let requesting = AddressBindingState::Requesting;
        let bound = AddressBindingState::Bound(lease.clone());
        let renewing = AddressBindingState::Renewing(lease.clone());
        let rebinding = AddressBindingState::Rebinding(lease.clone());
        let lost = AddressBindingState::Lost;

        assert!(matches!(unbound, AddressBindingState::Unbound));
        assert!(matches!(discovering, AddressBindingState::Discovering));
        assert!(matches!(requesting, AddressBindingState::Requesting));
        assert!(matches!(bound, AddressBindingState::Bound(_)));
        assert!(matches!(renewing, AddressBindingState::Renewing(_)));
        assert!(matches!(rebinding, AddressBindingState::Rebinding(_)));
        assert!(matches!(lost, AddressBindingState::Lost));
    }

    #[test]
    fn route_command_construction() {
        let add = RouteCommand::Add {
            destination: IpAddr::V4("192.168.0.0".parse().unwrap()),
            prefix_len: 24,
            gateway: IpAddr::V4("192.168.0.1".parse().unwrap()),
            interface_index: 2,
        };
        let delete = RouteCommand::Delete {
            destination: IpAddr::V4("192.168.0.0".parse().unwrap()),
            prefix_len: 24,
        };
        let set_default = RouteCommand::SetDefault {
            gateway: IpAddr::V4("10.0.0.1".parse().unwrap()),
            interface_index: 3,
        };
        let flush = RouteCommand::FlushAll;

        assert!(matches!(add, RouteCommand::Add { prefix_len: 24, .. }));
        assert!(matches!(delete, RouteCommand::Delete { prefix_len: 24, .. }));
        assert!(matches!(set_default, RouteCommand::SetDefault { interface_index: 3, .. }));
        assert!(matches!(flush, RouteCommand::FlushAll));
    }

    #[tokio::test]
    async fn channel_watch_works() {
        let (tx, rx) = watch::channel(AddressBindingState::Unbound);
        assert!(matches!(*rx.borrow(), AddressBindingState::Unbound));
        tx.send(AddressBindingState::Discovering).unwrap();
        assert!(matches!(*rx.borrow(), AddressBindingState::Discovering));
    }

    #[tokio::test]
    async fn channel_mpsc_works() {
        let (tx, mut rx) = mpsc::channel::<UsbEvent>(4);
        tx.send(UsbEvent::DeviceGone { device_id: "usb1".to_string() }).await.unwrap();
        let event = rx.recv().await.unwrap();
        assert!(matches!(event, UsbEvent::DeviceGone { .. }));
    }

    #[tokio::test]
    async fn channel_oneshot_works() {
        let (tx, rx) = oneshot::channel::<RouteResult>();
        tx.send(RouteResult { success: true }).unwrap();
        let result = rx.await.unwrap();
        assert!(result.success);
    }

    #[tokio::test]
    async fn admission_request_roundtrip() {
        use channel::{AdmissionReceiver, AdmissionSender};
        let (tx, mut rx): (AdmissionSender, AdmissionReceiver) = mpsc::channel(4);
        let peer = PeerId([42u8; 32]);
        let (resp_tx, resp_rx) = oneshot::channel();
        tx.send(AdmissionRequest { peer_id: peer.clone(), response: resp_tx })
            .await
            .unwrap();
        let req = rx.recv().await.unwrap();
        assert_eq!(req.peer_id, peer);
        req.response
            .send(AdmissionDecision::Admitted { inner_address: "10.0.0.2".parse().unwrap() })
            .unwrap();
        let decision = resp_rx.await.unwrap();
        assert!(matches!(decision, AdmissionDecision::Admitted { .. }));
    }
}
