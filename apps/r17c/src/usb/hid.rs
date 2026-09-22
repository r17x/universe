use embassy_usb::class::hid::{Config as HidConfig, HidBootProtocol, HidReaderWriter, HidSubclass};

pub const FIDO_REPORT_DESCRIPTOR: &[u8] = &[
    0x06, 0xD0, 0xF1, // Usage Page (FIDO Alliance 0xF1D0)
    0x09, 0x01, // Usage (CTAP HID 0x01)
    0xA1, 0x01, // Collection (Application)
    0x09, 0x20, //   Usage (Data In)
    0x15, 0x00, //   Logical Minimum (0)
    0x26, 0xFF, 0x00, //   Logical Maximum (255)
    0x75, 0x08, //   Report Size (8 bits)
    0x95, 0x40, //   Report Count (64)
    0x81, 0x02, //   Input (Data, Variable, Absolute)
    0x09, 0x21, //   Usage (Data Out)
    0x15, 0x00, //   Logical Minimum (0)
    0x26, 0xFF, 0x00, //   Logical Maximum (255)
    0x75, 0x08, //   Report Size (8 bits)
    0x95, 0x40, //   Report Count (64)
    0x91, 0x02, //   Output (Data, Variable, Absolute)
    0xC0, // End Collection
];

pub fn fido_hid_config() -> HidConfig<'static> {
    HidConfig {
        report_descriptor: FIDO_REPORT_DESCRIPTOR,
        request_handler: None,
        poll_ms: 5,
        max_packet_size: 64,
        hid_subclass: HidSubclass::No,
        hid_boot_protocol: HidBootProtocol::None,
    }
}

pub type FidoHid<'d, D> = HidReaderWriter<'d, D, 64, 64>;
pub type FidoHidState<'d> = embassy_usb::class::hid::State<'d>;
