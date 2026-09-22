pub mod ccid;
pub mod hid;

use embassy_rp::bind_interrupts;
use embassy_rp::peripherals::USB;
use embassy_rp::usb::{Driver, InterruptHandler};
use embassy_usb::{Builder, Config, UsbDevice};
pub use hid::{FidoHid, FidoHidState};
use static_cell::StaticCell;

use self::ccid::CcidClass;

bind_interrupts!(pub struct Irqs {
    USBCTRL_IRQ => InterruptHandler<USB>;
});

type UsbDriver = Driver<'static, USB>;

static CONFIG_DESC: StaticCell<[u8; 512]> = StaticCell::new();
static BOS_DESC: StaticCell<[u8; 256]> = StaticCell::new();
static MSOS_DESC: StaticCell<[u8; 256]> = StaticCell::new();
static CONTROL_BUF: StaticCell<[u8; 64]> = StaticCell::new();
static HID_STATE: StaticCell<FidoHidState<'static>> = StaticCell::new();

pub fn create_usb_device(
    driver: UsbDriver,
) -> (
    UsbDevice<'static, UsbDriver>,
    FidoHid<'static, UsbDriver>,
    CcidClass<'static, UsbDriver>,
) {
    let mut config = Config::new(0x2e8a, 0x000a);
    config.device_class = 0xEF;
    config.device_sub_class = 0x02;
    config.device_protocol = 0x01;
    config.manufacturer = Some("r17c");
    config.product = Some("r17c security key");
    config.serial_number = Some("r17c-001");

    let mut builder = Builder::new(
        driver,
        config,
        CONFIG_DESC.init([0; 512]),
        BOS_DESC.init([0; 256]),
        MSOS_DESC.init([0; 256]),
        CONTROL_BUF.init([0; 64]),
    );

    let hid_state = HID_STATE.init(FidoHidState::new());
    let hid = FidoHid::new(&mut builder, hid_state, hid::fido_hid_config());

    let ccid = CcidClass::new(&mut builder);

    let usb = builder.build();

    (usb, hid, ccid)
}
