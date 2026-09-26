#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UsbDeviceId {
    pub vendor_id: u16,
    pub product_id: u16,
    pub bus_id: String,
    pub device_address: u8,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BindingMode {
    KernelDriver,
    RawClaim,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UsbProtocol {
    Ncm,
    Rndis,
    Ecm,
    Mbim,
    Qmi,
}

#[derive(Debug, Clone)]
pub struct InterfaceRecord {
    pub device_id: UsbDeviceId,
    pub protocol: UsbProtocol,
    pub binding_mode: BindingMode,
    pub interface_number: u8,
    pub alternate_setting: u8,
    pub serial: Option<String>,
}

pub mod channel {
    use super::InterfaceRecord;
    use tokio::sync::watch;

    pub type InterfaceRecordSender = watch::Sender<Option<InterfaceRecord>>;
    pub type InterfaceRecordWatch = watch::Receiver<Option<InterfaceRecord>>;
}
