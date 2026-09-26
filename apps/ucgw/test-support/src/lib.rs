use std::net::Ipv4Addr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use types::{
    AddressLease, Allowlist, CounterSnapshot, InterfaceIdentity, PeerId, ResolverConfiguration,
    RouteCommand,
};
use types::channel::{
    AddressBindingStateSender, AddressBindingStateWatch, AdmissionReceiver, AdmissionSender,
    CounterSnapshotSender, CounterSnapshotWatch, UsbEventReceiver, UsbEventSender, ForwardEventReceiver,
    ForwardEventSender, OverlayEventReceiver, OverlayEventSender, InterfaceIdentitySender, InterfaceIdentityWatch,
    LifecycleCommandReceiver, LifecycleCommandSender, ResolverConfigSender, ResolverConfigWatch,
    RouteCommandReceiver, RouteCommandSender,
};
use types_usb::{BindingMode, InterfaceRecord, UsbDeviceId, UsbProtocol};
use types_usb::channel::{InterfaceRecordSender, InterfaceRecordWatch};
use tokio::sync::mpsc;

pub struct ChannelKit {
    pub interface_identity: (InterfaceIdentitySender, InterfaceIdentityWatch),
    pub address_binding: (AddressBindingStateSender, AddressBindingStateWatch),
    pub resolver_config: (ResolverConfigSender, ResolverConfigWatch),
    pub counter_snapshot: (CounterSnapshotSender, CounterSnapshotWatch),
    pub usb_record: (InterfaceRecordSender, InterfaceRecordWatch),
    pub d1_events: (UsbEventSender, UsbEventReceiver),
    pub d5_events: (ForwardEventSender, ForwardEventReceiver),
    pub d8_events: (OverlayEventSender, OverlayEventReceiver),
    pub route_commands: (RouteCommandSender, RouteCommandReceiver),
    pub lifecycle_commands: (LifecycleCommandSender, LifecycleCommandReceiver),
    pub admission: (AdmissionSender, AdmissionReceiver),
}

impl ChannelKit {
    pub fn new() -> Self {
        use types::AddressBindingState;
        use tokio::sync::watch;

        let (ii_tx, ii_rx) = watch::channel(None);
        let (ab_tx, ab_rx) = watch::channel(AddressBindingState::Unbound);
        let (rc_tx, rc_rx) = watch::channel(None);
        let (cs_tx, cs_rx) = watch::channel(None);
        let (ur_tx, ur_rx) = watch::channel(None);
        let (d1_tx, d1_rx) = mpsc::channel(16);
        let (d5_tx, d5_rx) = mpsc::channel(16);
        let (d8_tx, d8_rx) = mpsc::channel(16);
        let (rc_cmd_tx, rc_cmd_rx) = mpsc::channel(16);
        let (lc_tx, lc_rx) = mpsc::channel(16);
        let (adm_tx, adm_rx) = mpsc::channel(16);

        Self {
            interface_identity: (ii_tx, ii_rx),
            address_binding: (ab_tx, ab_rx),
            resolver_config: (rc_tx, rc_rx),
            counter_snapshot: (cs_tx, cs_rx),
            usb_record: (ur_tx, ur_rx),
            d1_events: (d1_tx, d1_rx),
            d5_events: (d5_tx, d5_rx),
            d8_events: (d8_tx, d8_rx),
            route_commands: (rc_cmd_tx, rc_cmd_rx),
            lifecycle_commands: (lc_tx, lc_rx),
            admission: (adm_tx, adm_rx),
        }
    }
}

impl Default for ChannelKit {
    fn default() -> Self {
        Self::new()
    }
}

pub fn fake_peer_id() -> PeerId {
    fake_peer_id_from(1)
}

pub fn fake_peer_id_from(seed: u8) -> PeerId {
    PeerId([seed; 32])
}

pub fn fake_interface_identity() -> InterfaceIdentity {
    InterfaceIdentity {
        name: "eth0".to_string(),
        index: 2,
        mac: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55],
    }
}

pub fn fake_address_lease() -> AddressLease {
    AddressLease {
        address: Ipv4Addr::new(10, 0, 0, 10),
        subnet_mask: Ipv4Addr::new(255, 255, 255, 0),
        gateway: Ipv4Addr::new(10, 0, 0, 1),
        dns_servers: vec![Ipv4Addr::new(10, 0, 0, 1)],
        lease_duration_secs: 86400,
        t1_secs: 43200,
        t2_secs: 75600,
    }
}

pub fn fake_usb_device_id() -> UsbDeviceId {
    UsbDeviceId {
        vendor_id: 0x12d1,
        product_id: 0x14db,
        bus_id: "1-1".to_string(),
        device_address: 3,
    }
}

pub fn fake_interface_record() -> InterfaceRecord {
    InterfaceRecord {
        device_id: fake_usb_device_id(),
        protocol: UsbProtocol::Ncm,
        binding_mode: BindingMode::KernelDriver,
        interface_number: 0,
        alternate_setting: 0,
        serial: Some("FAKESN0001".to_string()),
    }
}

pub fn fake_resolver_config() -> ResolverConfiguration {
    ResolverConfiguration {
        dns_servers: vec![Ipv4Addr::new(10, 0, 0, 1)],
        domain: Some("local".to_string()),
    }
}

pub fn fake_counter_snapshot() -> CounterSnapshot {
    CounterSnapshot {
        peer_id: fake_peer_id(),
        bytes_in: 1024,
        bytes_out: 512,
        packets_in: 8,
        packets_out: 4,
    }
}

pub fn fake_allowlist(peer_ids: Vec<PeerId>) -> Allowlist {
    Allowlist { peers: peer_ids }
}

pub struct IdentityCodec;

impl types::FrameCodec for IdentityCodec {
    fn wrap(&self, payload: &[u8], output: &mut Vec<u8>) {
        output.extend_from_slice(payload);
    }

    fn strip<'a>(&self, input: &'a [u8]) -> Option<&'a [u8]> {
        Some(input)
    }
}

pub struct RouteCommandSink {
    rx: RouteCommandReceiver,
    commands: Arc<Mutex<Vec<RouteCommand>>>,
}

impl RouteCommandSink {
    pub fn new(rx: RouteCommandReceiver) -> Self {
        Self {
            rx,
            commands: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn commands(&self) -> Vec<RouteCommand> {
        self.commands
            .lock()
            .expect("route command sink mutex poisoned")
            .clone()
    }

    pub async fn run(mut self) {
        while let Some((cmd, reply_tx)) = self.rx.recv().await {
            self.commands
                .lock()
                .expect("route command sink mutex poisoned")
                .push(cmd);
            let _ = reply_tx.send(Ok(types::RouteResult { success: true }));
        }
    }
}

pub struct EventCollector<T> {
    rx: mpsc::Receiver<T>,
}

impl<T: Send + 'static> EventCollector<T> {
    pub fn new(rx: mpsc::Receiver<T>) -> Self {
        Self { rx }
    }

    pub async fn collect_for(mut self, duration: Duration) -> Vec<T> {
        let mut collected = Vec::new();
        let deadline = tokio::time::sleep(duration);
        tokio::pin!(deadline);
        loop {
            tokio::select! {
                biased;
                _ = &mut deadline => break,
                item = self.rx.recv() => match item {
                    Some(v) => collected.push(v),
                    None => break,
                },
            }
        }
        collected
    }
}

pub struct ShutdownHandle {
    tx: tokio::sync::watch::Sender<bool>,
    rx: tokio::sync::watch::Receiver<bool>,
}

impl ShutdownHandle {
    pub fn new() -> Self {
        let (tx, rx) = tokio::sync::watch::channel(false);
        Self { tx, rx }
    }

    pub fn receiver(&self) -> tokio::sync::watch::Receiver<bool> {
        self.rx.clone()
    }

    pub fn trigger(&self) {
        let _ = self.tx.send(true);
    }
}

impl Default for ShutdownHandle {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::{FrameCodec, RouteCommand};
    use std::time::Duration;

    #[test]
    fn channel_kit_creates_all_channels() {
        let kit = ChannelKit::new();
        let (tx, rx) = kit.interface_identity;
        assert!(rx.has_changed().is_ok());
        drop(tx);
        drop(rx);
    }

    #[tokio::test]
    async fn shutdown_handle_trigger_works() {
        let handle = ShutdownHandle::new();
        let mut rx = handle.receiver();
        assert!(!*rx.borrow());
        handle.trigger();
        rx.changed().await.unwrap();
        assert!(*rx.borrow());
    }

    #[test]
    fn shutdown_handle_default() {
        let h = ShutdownHandle::default();
        assert!(!*h.rx.borrow());
    }

    #[test]
    fn fake_peer_id_returns_valid_id() {
        let p = fake_peer_id();
        assert_eq!(p.0, [1u8; 32]);
    }

    #[test]
    fn fake_peer_id_from_seed() {
        let p = fake_peer_id_from(42);
        assert_eq!(p.0, [42u8; 32]);
    }

    #[test]
    fn fake_interface_identity_valid() {
        let iface = fake_interface_identity();
        assert_eq!(iface.name, "eth0");
        assert_eq!(iface.index, 2);
    }

    #[test]
    fn fake_address_lease_valid() {
        let lease = fake_address_lease();
        assert_eq!(lease.lease_duration_secs, 86400);
        assert_eq!(lease.t1_secs, 43200);
        assert_eq!(lease.t2_secs, 75600);
    }

    #[test]
    fn fake_allowlist_contains_expected_peers() {
        let p1 = fake_peer_id_from(1);
        let p2 = fake_peer_id_from(2);
        let list = fake_allowlist(vec![p1.clone(), p2.clone()]);
        assert!(list.contains(&p1));
        assert!(list.contains(&p2));
        assert!(!list.contains(&fake_peer_id_from(3)));
    }

    #[test]
    fn identity_codec_roundtrip() {
        let codec = IdentityCodec;
        let payload = b"test payload data";
        let mut wrapped = Vec::new();
        codec.wrap(payload, &mut wrapped);
        assert_eq!(wrapped, payload);
        let stripped = codec.strip(&wrapped).unwrap();
        assert_eq!(stripped, payload);
    }

    #[tokio::test]
    async fn route_command_sink_collects_commands() {
        let kit = ChannelKit::new();
        let (cmd_tx, cmd_rx) = kit.route_commands;
        let sink = RouteCommandSink::new(cmd_rx);
        let commands_ref = sink.commands.clone();

        let sink_handle = tokio::spawn(sink.run());

        let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
        cmd_tx
            .send((
                RouteCommand::FlushAll,
                reply_tx,
            ))
            .await
            .unwrap();
        let result = reply_rx.await.unwrap();
        assert!(result.unwrap().success);

        drop(cmd_tx);
        sink_handle.await.unwrap();

        let cmds = commands_ref.lock().unwrap();
        assert_eq!(cmds.len(), 1);
        assert!(matches!(cmds[0], RouteCommand::FlushAll));
    }

    #[tokio::test]
    async fn event_collector_collects_within_duration() {
        let (tx, rx) = tokio::sync::mpsc::channel(16);
        let collector = EventCollector::new(rx);

        tx.send(1u32).await.unwrap();
        tx.send(2u32).await.unwrap();
        tx.send(3u32).await.unwrap();
        drop(tx);

        let events = collector.collect_for(Duration::from_millis(50)).await;
        assert_eq!(events, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn event_collector_stops_at_duration() {
        let (_tx, rx) = tokio::sync::mpsc::channel::<u32>(16);
        let collector = EventCollector::new(rx);
        let events = collector.collect_for(Duration::from_millis(10)).await;
        assert!(events.is_empty());
    }

    #[test]
    fn fake_resolver_config_valid() {
        let cfg = fake_resolver_config();
        assert!(!cfg.dns_servers.is_empty());
        assert_eq!(cfg.domain, Some("local".to_string()));
    }

    #[test]
    fn fake_counter_snapshot_valid() {
        let snap = fake_counter_snapshot();
        assert_eq!(snap.bytes_in, 1024);
        assert_eq!(snap.bytes_out, 512);
    }
}
