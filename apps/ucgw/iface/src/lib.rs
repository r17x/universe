use types::channel::InterfaceIdentitySender;
use types::InterfaceIdentity;
use types_usb::channel::InterfaceRecordWatch;
use types_usb::InterfaceRecord;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};

#[derive(Debug, thiserror::Error)]
pub enum IfaceError {
    #[error("network interface not found for USB device")]
    InterfaceNotFound,
    #[cfg(target_os = "linux")]
    #[error("netlink error: {0}")]
    NetlinkError(#[from] rtnetlink::Error),
    #[error("platform error: {0}")]
    PlatformError(String),
}

pub struct Iface {
    usb_record: InterfaceRecordWatch,
    identity_tx: InterfaceIdentitySender,
}

impl Iface {
    pub fn new(usb_record: InterfaceRecordWatch, identity_tx: InterfaceIdentitySender) -> Self {
        Self {
            usb_record,
            identity_tx,
        }
    }

    pub async fn run(mut self) -> Result<(), IfaceError> {
        loop {
            let record = self.usb_record.borrow_and_update().clone();
            match record {
                None => {
                    if self.identity_tx.borrow().is_some() {
                        info!("usb record cleared, clearing interface identity");
                        let _ = self.identity_tx.send(None);
                    }
                    if self.usb_record.changed().await.is_err() {
                        break;
                    }
                }
                Some(rec) => {
                    info!(
                        vendor_id = rec.device_id.vendor_id,
                        product_id = rec.device_id.product_id,
                        "usb record received, discovering network interface"
                    );
                    match platform::discover(&rec).await {
                        Ok(identity) => {
                            info!(
                                name = %identity.name,
                                index = identity.index,
                                "interface identity resolved"
                            );
                            let _ = self.identity_tx.send(Some(identity.clone()));
                            monitor_interface(
                                &mut self.usb_record,
                                &self.identity_tx,
                                &identity,
                            )
                            .await;
                        }
                        Err(IfaceError::InterfaceNotFound) => {
                            warn!("interface not found, waiting for usb record change");
                            let _ = self.usb_record.changed().await;
                        }
                        Err(e) => {
                            error!("interface discovery failed: {e}");
                            sleep(Duration::from_secs(2)).await;
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

async fn monitor_interface(
    usb_record: &mut InterfaceRecordWatch,
    identity_tx: &InterfaceIdentitySender,
    identity: &InterfaceIdentity,
) {
    loop {
        tokio::select! {
            changed = usb_record.changed() => {
                if changed.is_err() {
                    return;
                }
                let current = usb_record.borrow_and_update().clone();
                if current.is_none() {
                    info!(name = %identity.name, "usb record gone, clearing identity");
                    let _ = identity_tx.send(None);
                    return;
                }
            }
            gone = platform::wait_gone(&identity.name) => {
                if gone {
                    warn!(name = %identity.name, "interface disappeared");
                    let _ = identity_tx.send(None);
                    return;
                }
            }
        }
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::{IfaceError, InterfaceIdentity, InterfaceRecord};
    use futures_util::TryStreamExt;
    use netlink_packet_route::link::LinkAttribute;
    use rtnetlink::MulticastGroup;
    use tracing::debug;

    pub async fn discover(record: &InterfaceRecord) -> Result<InterfaceIdentity, IfaceError> {
        let bus_id = record.device_id.bus_id.clone();
        for attempt in 0..30u32 {
            if attempt > 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
            match try_find_interface(&bus_id).await {
                Ok(Some(identity)) => return Ok(identity),
                Ok(None) => debug!(attempt, "interface not yet visible, retrying"),
                Err(e) => return Err(e),
            }
        }
        Err(IfaceError::InterfaceNotFound)
    }

    async fn try_find_interface(bus_id: &str) -> Result<Option<InterfaceIdentity>, IfaceError> {
        let (conn, handle, _) =
            rtnetlink::new_connection().map_err(|e| IfaceError::PlatformError(e.to_string()))?;
        tokio::spawn(conn);

        let mut links = handle.link().get().execute();
        while let Some(msg) = links.try_next().await? {
            let index = msg.header.index;
            let mut name: Option<String> = None;
            let mut mac: Option<[u8; 6]> = None;

            for attr in &msg.attributes {
                match attr {
                    LinkAttribute::IfName(n) => name = Some(n.clone()),
                    LinkAttribute::Address(bytes) if bytes.len() == 6 => {
                        let mut arr = [0u8; 6];
                        arr.copy_from_slice(bytes);
                        mac = Some(arr);
                    }
                    _ => {}
                }
            }

            let (Some(iface_name), Some(mac)) = (name, mac) else {
                continue;
            };

            if is_usb_backed_by(&iface_name, bus_id) {
                return Ok(Some(InterfaceIdentity {
                    name: iface_name,
                    index,
                    mac,
                }));
            }
        }
        Ok(None)
    }

    fn is_usb_backed_by(iface_name: &str, bus_id: &str) -> bool {
        let dev_link = format!("/sys/class/net/{}/device", iface_name);
        match std::fs::canonicalize(&dev_link) {
            Ok(target) => target.to_string_lossy().contains(bus_id),
            Err(_) => false,
        }
    }

    pub async fn wait_gone(name: &str) -> bool {
        let sysfs = format!("/sys/class/net/{}", name);
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            if !std::path::Path::new(&sysfs).exists() {
                return true;
            }
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::{IfaceError, InterfaceIdentity, InterfaceRecord};
    use system_configuration::network_configuration::get_interfaces;
    use tracing::debug;

    pub async fn discover(record: &InterfaceRecord) -> Result<InterfaceIdentity, IfaceError> {
        let bus_id = record.device_id.bus_id.clone();
        for attempt in 0..30u32 {
            if attempt > 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
            match try_find_interface(&bus_id).await {
                Ok(Some(identity)) => return Ok(identity),
                Ok(None) => debug!(attempt, "interface not yet visible, retrying"),
                Err(e) => return Err(e),
            }
        }
        Err(IfaceError::InterfaceNotFound)
    }

    async fn try_find_interface(_bus_id: &str) -> Result<Option<InterfaceIdentity>, IfaceError> {
        let interfaces = get_interfaces();
        for iface in interfaces.iter() {
            let Some(bsd_name_cf) = iface.bsd_name() else {
                continue;
            };
            let bsd_name = bsd_name_cf.to_string();
            let Some(itype) = iface.interface_type_string() else {
                continue;
            };
            let itype_str = itype.to_string();
            if !itype_str.contains("Ethernet") && !itype_str.contains("WWAN") {
                continue;
            }
            let Some((index, mac)) = query_ifconfig(&bsd_name) else {
                continue;
            };
            return Ok(Some(InterfaceIdentity {
                name: bsd_name,
                index,
                mac,
            }));
        }
        Ok(None)
    }

    fn query_ifconfig(name: &str) -> Option<(u32, [u8; 6])> {
        let output = std::process::Command::new("ifconfig")
            .arg("-v")
            .arg(name)
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&output.stdout);
        let index = parse_flags_line_index(&text)?;
        let mac = parse_ether_line(&text)?;
        Some((index, mac))
    }

    fn parse_flags_line_index(text: &str) -> Option<u32> {
        let line = text.lines().next()?;
        line.split_whitespace()
            .skip_while(|w| *w != "index")
            .nth(1)
            .and_then(|s| s.parse().ok())
    }

    fn parse_ether_line(text: &str) -> Option<[u8; 6]> {
        for line in text.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("ether ") {
                let mac_str = rest.split_whitespace().next()?;
                return parse_mac(mac_str);
            }
        }
        None
    }

    fn parse_mac(s: &str) -> Option<[u8; 6]> {
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() != 6 {
            return None;
        }
        let mut mac = [0u8; 6];
        for (i, p) in parts.iter().enumerate() {
            mac[i] = u8::from_str_radix(p, 16).ok()?;
        }
        Some(mac)
    }

    pub async fn wait_gone(name: &str) -> bool {
        let name = name.to_string();
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            let interfaces = get_interfaces();
            let exists = interfaces
                .iter()
                .filter_map(|i| i.bsd_name())
                .any(|n| n == name);
            if !exists {
                return true;
            }
        }
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
mod platform {
    use super::{IfaceError, InterfaceIdentity, InterfaceRecord};

    pub async fn discover(_record: &InterfaceRecord) -> Result<InterfaceIdentity, IfaceError> {
        Err(IfaceError::PlatformError("unsupported platform".into()))
    }

    pub async fn wait_gone(_name: &str) -> bool {
        tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
        false
    }
}
