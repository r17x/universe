use crate::types::UserPresenceResult;
use embassy_sync::blocking_mutex::raw::CriticalSectionRawMutex;
use embassy_sync::signal::Signal;
use embassy_time::{Duration, Instant, Timer};

pub trait UserPresence {
    async fn wait(&self, timeout_ms: u32) -> UserPresenceResult;
}

pub struct BootselButton {
    cancel: &'static Signal<CriticalSectionRawMutex, ()>,
}

impl BootselButton {
    pub fn new(cancel: &'static Signal<CriticalSectionRawMutex, ()>) -> Self {
        Self { cancel }
    }

    fn is_pressed(&self) -> bool {
        unsafe {
            let cs_gpio = embassy_rp::pac::IO_QSPI.gpio(1);

            cortex_m::interrupt::free(|_| read_bootsel_in_ram(cs_gpio.as_ptr() as *mut u32))
        }
    }
}

#[inline(never)]
#[link_section = ".data.ram_func"]
unsafe fn read_bootsel_in_ram(cs_gpio_base: *mut u32) -> bool {
    let ctrl_ptr = cs_gpio_base.add(1);
    let status_ptr = cs_gpio_base;

    let orig_ctrl = core::ptr::read_volatile(ctrl_ptr);
    core::ptr::write_volatile(ctrl_ptr, 2 << 12);

    for _ in 0..1024 {
        cortex_m::asm::nop();
    }

    let status = core::ptr::read_volatile(status_ptr);
    core::ptr::write_volatile(ctrl_ptr, orig_ctrl);

    (status & (1 << 17)) == 0
}

impl UserPresence for BootselButton {
    async fn wait(&self, timeout_ms: u32) -> UserPresenceResult {
        self.cancel.reset();
        let poll_interval = Duration::from_millis(50);
        let deadline = Duration::from_millis(timeout_ms as u64);
        let start = Instant::now();

        crate::UP_WAITING.store(true, core::sync::atomic::Ordering::Relaxed);

        let result = loop {
            if self.is_pressed() {
                break UserPresenceResult::Confirmed;
            }

            if Instant::now() - start > deadline {
                break UserPresenceResult::TimedOut;
            }

            Timer::after(poll_interval).await;

            if self.cancel.signaled() {
                break UserPresenceResult::Cancelled;
            }
        };

        crate::UP_WAITING.store(false, core::sync::atomic::Ordering::Relaxed);
        result
    }
}
