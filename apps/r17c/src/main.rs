#![no_std]
#![no_main]
#![deny(warnings)]
#![deny(unused_imports, unused_variables, dead_code, unreachable_code)]
#![deny(clippy::all)]

pub use r17c::cbor;
pub use r17c::crypto;
pub use r17c::oath;
pub use r17c::storage;
pub use r17c::types;

mod button;
mod ctaphid;
mod fido2;
mod oath_ccid;
mod openpgp;
mod usb;

use core::cell::RefCell;
use core::pin::pin;

use defmt_rtt as _;
use embassy_executor::Spawner;
use embassy_futures::join::join;
use embassy_futures::select::{select, Either};
use embassy_rp::flash::Flash;
use embassy_rp::gpio::{Level, Output};
use embassy_rp::mode::Blocking;
use embassy_rp::usb::Driver;
use embassy_sync::blocking_mutex::raw::CriticalSectionRawMutex;
use embassy_sync::blocking_mutex::Mutex;
use embassy_sync::signal::Signal;
use embassy_time::{Duration, Timer};
use embassy_usb::UsbDevice;
use embedded_alloc::LlffHeap;
use heapless::Vec;
use panic_probe as _;
use static_cell::StaticCell;

use usb::ccid::CcidHandler;
use usb::Irqs;

enum SelectedApp {
    None,
    OpenPgp,
    Oath,
}

struct CardDispatcher<PGP, OATH> {
    pgp: PGP,
    oath: OATH,
    selected: SelectedApp,
}

const OPENPGP_AID_PREFIX: &[u8] = &[0xD2, 0x76, 0x00, 0x01, 0x24, 0x01];

impl<PGP: CcidHandler, OATH: CcidHandler> CcidHandler for CardDispatcher<PGP, OATH> {
    async fn handle_apdu(&mut self, apdu: &[u8], response: &mut Vec<u8, 512>) {
        if apdu.len() >= 4 && apdu[1] == 0xA4 && apdu[2] == 0x04 {
            let data = if apdu.len() > 5 {
                let lc = apdu[4] as usize;
                if apdu.len() >= 5 + lc {
                    &apdu[5..5 + lc]
                } else {
                    &apdu[5..]
                }
            } else {
                &[]
            };

            if data.len() >= OPENPGP_AID_PREFIX.len()
                && data[..OPENPGP_AID_PREFIX.len()] == *OPENPGP_AID_PREFIX
            {
                self.selected = SelectedApp::OpenPgp;
            } else if data.len() >= oath_ccid::OATH_AID.len()
                && data[..oath_ccid::OATH_AID.len()] == *oath_ccid::OATH_AID
            {
                self.selected = SelectedApp::Oath;
            }
        }

        match self.selected {
            SelectedApp::OpenPgp => self.pgp.handle_apdu(apdu, response).await,
            SelectedApp::Oath => self.oath.handle_apdu(apdu, response).await,
            SelectedApp::None => {
                response.extend_from_slice(&[0x6A, 0x82]).ok();
            }
        }
    }
}

#[global_allocator]
static HEAP: LlffHeap = LlffHeap::empty();
const HEAP_SIZE: usize = 65536;
static mut HEAP_MEM: [u8; HEAP_SIZE] = [0; HEAP_SIZE];

const FLASH_SIZE: usize = 2 * 1024 * 1024;
type UsbDriver = Driver<'static, embassy_rp::peripherals::USB>;

static CANCEL_SIGNAL: Signal<CriticalSectionRawMutex, ()> = Signal::new();
static WINK_SIGNAL: Signal<CriticalSectionRawMutex, ()> = Signal::new();
static UP_WAITING: core::sync::atomic::AtomicBool = core::sync::atomic::AtomicBool::new(false);
static BUSY_SIGNAL: core::sync::atomic::AtomicBool = core::sync::atomic::AtomicBool::new(false);

struct FlashStorage {
    flash: &'static Mutex<CriticalSectionRawMutex, RefCell<Flash<'static, Blocking, FLASH_SIZE>>>,
}

impl storage::Storage for FlashStorage {
    fn read(&self, offset: u32, buf: &mut [u8]) -> Result<(), types::FlashError> {
        self.flash.lock(|r| {
            r.borrow_mut()
                .blocking_read(offset, buf)
                .map_err(|_| types::FlashError::ReadCorrupted)
        })
    }

    fn write(&mut self, offset: u32, data: &[u8]) -> Result<(), types::FlashError> {
        self.flash.lock(|r| {
            r.borrow_mut()
                .blocking_write(offset, data)
                .map_err(|_| types::FlashError::WriteFailed)
        })
    }

    fn erase(&mut self, offset: u32, len: u32) -> Result<(), types::FlashError> {
        self.flash.lock(|r| {
            r.borrow_mut()
                .blocking_erase(offset, offset + len)
                .map_err(|_| types::FlashError::EraseFailed)
        })
    }
}

struct RoscRng;

impl crypto::Entropy for RoscRng {
    fn fill_random(&mut self, buf: &mut [u8]) {
        for byte in buf.iter_mut() {
            let mut val: u8 = 0;
            for bit in 0..8 {
                let b = embassy_rp::pac::ROSC.randombit().read().randombit() as u8;
                val |= b << bit;
            }
            *byte = val;
        }
    }
}

#[embassy_executor::task]
async fn usb_task(mut usb: UsbDevice<'static, UsbDriver>) {
    usb.run().await;
}

#[embassy_executor::task]
async fn led_task(mut led: Output<'static>) {
    loop {
        if WINK_SIGNAL.signaled() {
            WINK_SIGNAL.reset();
            for _ in 0..6 {
                led.set_high();
                Timer::after(Duration::from_millis(100)).await;
                led.set_low();
                Timer::after(Duration::from_millis(100)).await;
            }
        }
        if BUSY_SIGNAL.load(core::sync::atomic::Ordering::Relaxed) {
            led.set_high();
            Timer::after(Duration::from_millis(30)).await;
            led.set_low();
            Timer::after(Duration::from_millis(30)).await;
        } else if UP_WAITING.load(core::sync::atomic::Ordering::Relaxed) {
            led.set_high();
            Timer::after(Duration::from_millis(80)).await;
            led.set_low();
            Timer::after(Duration::from_millis(80)).await;
        } else {
            led.set_high();
            Timer::after(Duration::from_millis(1000)).await;
            led.set_low();
            Timer::after(Duration::from_millis(1000)).await;
        }
    }
}

#[embassy_executor::task]
async fn watchdog_task(mut watchdog: embassy_rp::watchdog::Watchdog<'static>) {
    loop {
        watchdog.feed(embassy_time::Duration::from_secs(8));
        Timer::after(Duration::from_secs(4)).await;
    }
}

#[embassy_executor::main]
async fn main(spawner: Spawner) {
    let p = embassy_rp::init(Default::default());

    let mut watchdog = embassy_rp::watchdog::Watchdog::new(p.WATCHDOG);
    watchdog.start(embassy_time::Duration::from_secs(8));

    defmt::info!("r17c boot");

    unsafe { HEAP.init(core::ptr::addr_of_mut!(HEAP_MEM) as usize, HEAP_SIZE) };

    let flash = Flash::<Blocking, FLASH_SIZE>::new_blocking(p.FLASH);
    static FLASH_CELL: StaticCell<
        Mutex<CriticalSectionRawMutex, RefCell<Flash<'static, Blocking, FLASH_SIZE>>>,
    > = StaticCell::new();
    let flash_mutex = FLASH_CELL.init(Mutex::new(RefCell::new(flash)));

    let mut fido_storage = FlashStorage { flash: flash_mutex };
    let mut ccid_storage = FlashStorage { flash: flash_mutex };
    let mut oath_storage = FlashStorage { flash: flash_mutex };

    let mut rng = RoscRng;
    let mut rng2 = RoscRng;

    if !storage::validate_flash_layout(&fido_storage).unwrap_or(false) {
        storage::initialize_flash_layout(&mut fido_storage).ok();
    }

    let master_secret = storage::init_master_secret(&mut fido_storage, &mut rng)
        .unwrap_or_else(|_| zeroize::Zeroizing::new([0u8; 32]));

    let driver = Driver::new(p.USB, Irqs);
    let (usb_device, hid, mut ccid) = usb::create_usb_device(driver);

    spawner.spawn(usb_task(usb_device).unwrap());
    spawner.spawn(led_task(Output::new(p.PIN_25, Level::Low)).unwrap());
    spawner.spawn(watchdog_task(watchdog).unwrap());

    let button = button::BootselButton::new(&CANCEL_SIGNAL);

    let mut ctap_hid = ctaphid::CtapHid::new();
    let mut fido = fido2::Fido2::new(&mut fido_storage, &mut rng, &button, master_secret);
    let pgp = openpgp::OpenPgp::new(&mut ccid_storage, &mut rng2, &button);
    let oath_app = oath_ccid::OathApp::new(&mut oath_storage);
    let mut dispatcher = CardDispatcher {
        pgp,
        oath: oath_app,
        selected: SelectedApp::None,
    };

    let (mut hid_reader, mut hid_writer) = hid.split();

    let fido_loop = async {
        loop {
            let mut packet = [0u8; 64];
            let read_result = embassy_time::with_timeout(
                Duration::from_millis(100),
                hid_reader.read(&mut packet),
            )
            .await;

            match read_result {
                Ok(Ok(_)) => {
                    let cmd_byte = packet[4];
                    defmt::info!("HID: cmd=0x{:02X}", cmd_byte);
                    let mut responses: Vec<[u8; 64], 8> = Vec::new();
                    let dispatch = ctap_hid.process_packet(&packet, &mut responses);

                    for pkt in responses.iter() {
                        hid_writer.write(pkt).await.ok();
                    }

                    match dispatch {
                        ctaphid::Dispatch::Cbor { len } => {
                            defmt::info!("HID: CBOR dispatch len={}", len);
                            let cid = ctap_hid.active_cid();
                            let data = ctap_hid.msg_buf();

                            BUSY_SIGNAL.store(true, core::sync::atomic::Ordering::Relaxed);
                            let mut cbor_future = pin!(fido.process_cbor(data, len));

                            let cbor_resp = loop {
                                let mut cancel_buf = [0u8; 64];
                                match select(
                                    cbor_future.as_mut(),
                                    select(
                                        Timer::after(Duration::from_millis(100)),
                                        hid_reader.read(&mut cancel_buf),
                                    ),
                                )
                                .await
                                {
                                    Either::First(resp) => break resp,
                                    Either::Second(_) => {
                                        if cancel_buf[4] == types::CTAPHID_CANCEL {
                                            CANCEL_SIGNAL.signal(());
                                        }
                                        let status = if UP_WAITING
                                            .load(core::sync::atomic::Ordering::Relaxed)
                                        {
                                            0x02
                                        } else {
                                            0x01
                                        };
                                        let mut ka = [0u8; 64];
                                        let cid_bytes = cid.to_be_bytes();
                                        ka[0..4].copy_from_slice(&cid_bytes);
                                        ka[4] = types::CTAPHID_KEEPALIVE;
                                        ka[5] = 0x00;
                                        ka[6] = 0x01;
                                        ka[7] = status;
                                        hid_writer.write(&ka).await.ok();
                                    }
                                }
                            };

                            let mut packets: Vec<[u8; 64], 16> = Vec::new();
                            ctaphid::CtapHid::build_response(
                                cid,
                                types::CTAPHID_CBOR,
                                &cbor_resp,
                                &mut packets,
                            );
                            defmt::info!(
                                "HID: sending {} packets, resp[0]=0x{:02X}",
                                packets.len(),
                                cbor_resp.first().copied().unwrap_or(0xFF)
                            );
                            for pkt in packets.iter() {
                                hid_writer.write(pkt).await.ok();
                            }
                            BUSY_SIGNAL.store(false, core::sync::atomic::Ordering::Relaxed);
                        }
                        ctaphid::Dispatch::Msg { len } => {
                            let cid = ctap_hid.active_cid();
                            let data = ctap_hid.msg_buf();
                            BUSY_SIGNAL.store(true, core::sync::atomic::Ordering::Relaxed);
                            let msg_resp = fido.process_msg(data, len).await;
                            let mut packets: Vec<[u8; 64], 16> = Vec::new();
                            ctaphid::CtapHid::build_response(
                                cid,
                                types::CTAPHID_MSG,
                                &msg_resp,
                                &mut packets,
                            );
                            for pkt in packets.iter() {
                                hid_writer.write(pkt).await.ok();
                            }
                            BUSY_SIGNAL.store(false, core::sync::atomic::Ordering::Relaxed);
                        }
                        ctaphid::Dispatch::Cancel => {
                            CANCEL_SIGNAL.signal(());
                        }
                        ctaphid::Dispatch::Wink => {
                            WINK_SIGNAL.signal(());
                        }
                        ctaphid::Dispatch::None => {}
                    }
                }
                Ok(Err(_)) => {}
                Err(_) => {
                    let mut responses: Vec<[u8; 64], 8> = Vec::new();
                    ctap_hid.check_timeouts(&mut responses);
                    for pkt in responses.iter() {
                        hid_writer.write(pkt).await.ok();
                    }
                }
            }
        }
    };

    let ccid_loop = async {
        ccid.run(&mut dispatcher).await;
    };

    join(fido_loop, ccid_loop).await;
}
