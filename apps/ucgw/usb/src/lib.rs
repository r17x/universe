use std::collections::HashMap;
use std::future::poll_fn;
use std::task::Poll;

use futures_core::Stream;
use types::channel::{UsbEventSender, InterfaceIdentitySender};
use types::UsbEvent;
use types_usb::channel::InterfaceRecordSender;
use types_usb::{BindingMode, InterfaceRecord, UsbDeviceId, UsbProtocol};
use nusb::hotplug::HotplugEvent;
use nusb::{DeviceId, DeviceInfo, MaybeFuture};

#[derive(Debug, thiserror::Error)]
pub enum UsbError {
    #[error("USB enumeration failed: {0}")]
    Enumeration(#[from] std::io::Error),
    #[error("no matching cellular device found")]
    NoMatchingDevice,
    #[error("failed to claim interface {interface}: {reason}")]
    ClaimFailed { interface: u8, reason: String },
    #[error("hotplug watch failed")]
    HotplugFailed,
}

const KNOWN_MODEMS: &[(u16, u16)] = &[
    (0x12d1, 0x14db),
    (0x12d1, 0x1506),
    (0x2c7c, 0x0125),
    (0x2c7c, 0x0306),
    (0x2c7c, 0x0512),
    (0x413c, 0x81d7),
    (0x413c, 0x81e6),
    (0x1199, 0x9091),
    (0x1199, 0x90b1),
    (0x0bdb, 0x1926),
    (0x0bdb, 0x190d),
    (0x03f0, 0x4e1d),
];

const CDC_CLASS: u8 = 0x02;
const CDC_SUBCLASS_ECM: u8 = 0x06;
const CDC_SUBCLASS_NCM: u8 = 0x0D;
const CDC_SUBCLASS_MBIM: u8 = 0x0E;
const CDC_SUBCLASS_RNDIS_ACM: u8 = 0x02;
const WIRELESS_CLASS: u8 = 0xE0;
const WIRELESS_SUBCLASS_RNDIS: u8 = 0x01;
const WIRELESS_PROTO_RNDIS: u8 = 0x03;
const VENDOR_CLASS: u8 = 0xFF;

pub struct Usb {
    record_tx: InterfaceRecordSender,
    identity_tx: InterfaceIdentitySender,
    event_tx: UsbEventSender,
}

impl Usb {
    pub fn new(
        record_tx: InterfaceRecordSender,
        identity_tx: InterfaceIdentitySender,
        event_tx: UsbEventSender,
    ) -> Self {
        Self {
            record_tx,
            identity_tx,
            event_tx,
        }
    }

    pub async fn run(self) -> Result<(), UsbError> {
        let mut watch = nusb::watch_devices().map_err(|_| UsbError::HotplugFailed)?;
        let mut known: HashMap<DeviceId, String> = HashMap::new();

        for info in nusb::list_devices().map_err(|e| UsbError::Enumeration(e.into())).await? {
            if is_known_modem(&info) {
                let label = format_device_label(&info);
                tracing::info!(
                    label,
                    vendor = info.vendor_id(),
                    product = info.product_id(),
                    bus = info.bus_id(),
                    "found existing cellular device"
                );
                known.insert(info.id(), label.clone());
                self.bind_device(&info).await;
                break;
            }
        }

        loop {
            let event = poll_fn(|cx| {
                let mut pinned = std::pin::Pin::new(&mut watch);
                match pinned.as_mut().poll_next(cx) {
                    Poll::Ready(Some(e)) => Poll::Ready(Some(e)),
                    Poll::Ready(None) => Poll::Ready(None),
                    Poll::Pending => Poll::Pending,
                }
            })
            .await;

            match event {
                None => break,
                Some(HotplugEvent::Connected(info)) => {
                    if is_known_modem(&info) {
                        let label = format_device_label(&info);
                        tracing::info!(
                            label,
                            vendor = info.vendor_id(),
                            product = info.product_id(),
                            bus = info.bus_id(),
                            "cellular device connected"
                        );
                        known.insert(info.id(), label);
                        self.bind_device(&info).await;
                    }
                }
                Some(HotplugEvent::Disconnected(dev_id)) => {
                    if let Some(label) = known.remove(&dev_id) {
                        tracing::info!(label, "cellular device disconnected");
                        let _ = self.record_tx.send(None);
                        let _ = self.identity_tx.send(None);
                        let _ = self
                            .event_tx
                            .send(UsbEvent::DeviceGone {
                                device_id: label,
                            })
                            .await;
                    }
                }
            }
        }

        Ok(())
    }

    async fn bind_device(&self, info: &DeviceInfo) {
        let label = format_device_label(info);
        match try_bind(info).await {
            Ok(record) => {
                tracing::info!(
                    label,
                    interface = record.interface_number,
                    protocol = ?record.protocol,
                    "bound cellular interface"
                );
                let _ = self.record_tx.send(Some(record));
            }
            Err(e) => {
                tracing::error!(label, error = %e, "failed to bind cellular device");
                let _ = self
                    .event_tx
                    .send(UsbEvent::BindingError {
                        device_id: label,
                        reason: e.to_string(),
                    })
                    .await;
            }
        }
    }
}

fn is_known_modem(info: &DeviceInfo) -> bool {
    KNOWN_MODEMS
        .iter()
        .any(|(vid, pid)| *vid == info.vendor_id() && *pid == info.product_id())
}

fn format_device_label(info: &DeviceInfo) -> String {
    format!(
        "{:04x}:{:04x}@{}:{}",
        info.vendor_id(),
        info.product_id(),
        info.bus_id(),
        info.device_address()
    )
}

fn classify_interface(iface: &nusb::InterfaceInfo) -> Option<UsbProtocol> {
    let class = iface.class();
    let sub = iface.subclass();
    let proto = iface.protocol();

    if class == WIRELESS_CLASS && sub == WIRELESS_SUBCLASS_RNDIS && proto == WIRELESS_PROTO_RNDIS {
        return Some(UsbProtocol::Rndis);
    }

    if class == CDC_CLASS {
        return match sub {
            CDC_SUBCLASS_NCM => Some(UsbProtocol::Ncm),
            CDC_SUBCLASS_MBIM => Some(UsbProtocol::Mbim),
            CDC_SUBCLASS_ECM => Some(UsbProtocol::Ecm),
            CDC_SUBCLASS_RNDIS_ACM => Some(UsbProtocol::Rndis),
            _ => None,
        };
    }

    if class == VENDOR_CLASS && sub == VENDOR_CLASS && proto == VENDOR_CLASS {
        return Some(UsbProtocol::Qmi);
    }

    None
}

fn protocol_priority(p: &UsbProtocol) -> u8 {
    match p {
        UsbProtocol::Ncm => 0,
        UsbProtocol::Mbim => 1,
        UsbProtocol::Ecm => 2,
        UsbProtocol::Rndis => 3,
        UsbProtocol::Qmi => 4,
    }
}

async fn try_bind(info: &DeviceInfo) -> Result<InterfaceRecord, UsbError> {
    let usb_id = UsbDeviceId {
        vendor_id: info.vendor_id(),
        product_id: info.product_id(),
        bus_id: info.bus_id().to_string(),
        device_address: info.device_address(),
    };

    let serial = info.serial_number().map(str::to_string);

    let mut best: Option<(u8, UsbProtocol)> = None;

    for iface in info.interfaces() {
        if let Some(protocol) = classify_interface(iface) {
            let iface_num = iface.interface_number();
            let priority = protocol_priority(&protocol);
            let current_priority = best
                .as_ref()
                .map(|(_, p)| protocol_priority(p))
                .unwrap_or(u8::MAX);
            if priority < current_priority {
                best = Some((iface_num, protocol));
            }
        }
    }

    let (iface_num, protocol) = best.ok_or(UsbError::NoMatchingDevice)?;

    let device = info.open().await.map_err(|e| UsbError::ClaimFailed {
        interface: iface_num,
        reason: e.to_string(),
    })?;

    let binding_mode = try_detach_kernel_driver(&device, iface_num);

    device
        .claim_interface(iface_num)
        .await
        .map_err(|e| UsbError::ClaimFailed {
            interface: iface_num,
            reason: e.to_string(),
        })?;

    Ok(InterfaceRecord {
        device_id: usb_id,
        protocol,
        binding_mode,
        interface_number: iface_num,
        alternate_setting: 0,
        serial,
    })
}

#[cfg(target_os = "linux")]
fn try_detach_kernel_driver(device: &nusb::Device, iface_num: u8) -> BindingMode {
    match device.detach_kernel_driver(iface_num) {
        Ok(()) => BindingMode::KernelDriver,
        Err(_) => BindingMode::RawClaim,
    }
}

#[cfg(not(target_os = "linux"))]
fn try_detach_kernel_driver(_device: &nusb::Device, _iface_num: u8) -> BindingMode {
    BindingMode::RawClaim
}
