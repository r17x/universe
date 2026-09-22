use embassy_futures::select::{select, Either};
use embassy_usb::driver::{Driver, Endpoint, EndpointIn, EndpointOut};
use embassy_usb::Builder;
use heapless::Vec;

const ATR: &[u8] = &[
    0x3B, 0xDA, 0x18, 0xFF, 0x81, 0xB1, 0xFE, 0x75, 0x1F, 0x03, 0x00, 0x31, 0xC5, 0x73, 0xC0, 0x01,
    0x40, 0x00, 0x90, 0x00, 0x0C,
];

const PC_TO_RDR_ICC_POWER_ON: u8 = 0x62;
const PC_TO_RDR_ICC_POWER_OFF: u8 = 0x63;
const PC_TO_RDR_GET_SLOT_STATUS: u8 = 0x65;
const PC_TO_RDR_XFR_BLOCK: u8 = 0x6F;

const RDR_TO_PC_DATA_BLOCK: u8 = 0x80;
const RDR_TO_PC_SLOT_STATUS: u8 = 0x81;

const CCID_DESCRIPTOR: &[u8] = &[
    0x10, 0x01, // bcdCCID 1.1
    0x00, // bMaxSlotIndex
    0x07, // bVoltageSupport (5V, 3V, 1.8V)
    0x03, 0x00, 0x00, 0x00, // dwProtocols (T=0, T=1)
    0xA0, 0x0F, 0x00, 0x00, // dwDefaultClock 4000 kHz
    0xA0, 0x0F, 0x00, 0x00, // dwMaximumClock 4000 kHz
    0x00, // dwNumClockSupported
    0x80, 0x25, 0x00, 0x00, // dwDataRate 9600 bps
    0x80, 0x25, 0x00, 0x00, // dwMaxDataRate 9600 bps
    0x00, // dwNumDataRatesSupported
    0xFE, 0x00, 0x00, 0x00, // dwMaxIFSD 254
    0x00, 0x00, 0x00, 0x00, // dwSynchProtocols
    0x00, 0x00, 0x00, 0x00, // dwMechanical
    0x40, 0x08, 0x04, 0x00, // dwFeatures 0x00040840
    0x0F, 0x01, 0x00, 0x00, // dwMaxCCIDMessageLength 271
    0xFF, // bClassGetResponse
    0xFF, // bClassEnvelope
    0x00, 0x00, // wLcdLayout
    0x00, // bPINSupport
    0x01, // bMaxCCIDBusySlots
];

pub trait CcidHandler {
    async fn handle_apdu(&mut self, apdu: &[u8], response: &mut Vec<u8, 512>);
}

pub struct CcidClass<'d, D: Driver<'d>> {
    read_ep: D::EndpointOut,
    write_ep: D::EndpointIn,
    int_ep: D::EndpointIn,
}

impl<'d, D: Driver<'d>> CcidClass<'d, D> {
    pub fn new(builder: &mut Builder<'d, D>) -> Self {
        let mut func = builder.function(0x0B, 0x00, 0x00);
        let mut iface = func.interface();
        let mut alt = iface.alt_setting(0x0B, 0x00, 0x00, None);

        alt.descriptor(0x21, CCID_DESCRIPTOR);

        let read_ep = alt.endpoint_bulk_out(None, 64);
        let write_ep = alt.endpoint_bulk_in(None, 64);
        let int_ep = alt.endpoint_interrupt_in(None, 8, 32);

        drop(func);

        Self {
            read_ep,
            write_ep,
            int_ep,
        }
    }

    pub async fn run(&mut self, handler: &mut impl CcidHandler) {
        loop {
            self.read_ep.wait_enabled().await;

            let notify: [u8; 2] = [0x50, 0x03];
            let mut notified = false;

            loop {
                let mut buf = [0u8; 271];

                let first = if !notified {
                    match select(
                        self.int_ep.write(&notify),
                        self.read_ep.read(&mut buf[..64]),
                    )
                    .await
                    {
                        Either::First(_) => {
                            notified = true;
                            match self.read_ep.read(&mut buf[..64]).await {
                                Ok(n) if n >= 10 => n,
                                Ok(_) => continue,
                                Err(_) => break,
                            }
                        }
                        Either::Second(Ok(n)) if n >= 10 => {
                            notified = true;
                            n
                        }
                        Either::Second(Ok(_)) => continue,
                        Either::Second(Err(_)) => break,
                    }
                } else {
                    match self.read_ep.read(&mut buf[..64]).await {
                        Ok(n) if n >= 10 => n,
                        Ok(_) => continue,
                        Err(_) => break,
                    }
                };

                let mut total = first;
                let data_len = u32::from_le_bytes([buf[1], buf[2], buf[3], buf[4]]) as usize;
                let full_len = 10 + data_len;

                while total < full_len.min(271) {
                    let end = (total + 64).min(271);
                    match self.read_ep.read(&mut buf[total..end]).await {
                        Ok(n) if n > 0 => total += n,
                        _ => break,
                    }
                }

                self.process_message(&buf[..total.min(full_len)], handler)
                    .await;
            }
        }
    }

    async fn process_message(&mut self, msg: &[u8], handler: &mut impl CcidHandler) {
        let msg_type = msg[0];
        let length = u32::from_le_bytes([msg[1], msg[2], msg[3], msg[4]]) as usize;
        let seq = msg[6];

        match msg_type {
            PC_TO_RDR_ICC_POWER_ON => {
                self.send_data_block(seq, ATR).await;
            }
            PC_TO_RDR_ICC_POWER_OFF => {
                self.send_slot_status(seq, 0x00).await;
            }
            PC_TO_RDR_GET_SLOT_STATUS => {
                self.send_slot_status(seq, 0x00).await;
            }
            PC_TO_RDR_XFR_BLOCK => {
                let apdu_start = 10;
                let apdu_end = (apdu_start + length).min(msg.len());
                let apdu = &msg[apdu_start..apdu_end];

                let mut response: Vec<u8, 512> = Vec::new();
                handler.handle_apdu(apdu, &mut response).await;
                self.send_data_block(seq, &response).await;
            }
            _ => {
                self.send_slot_status(seq, 0x00).await;
            }
        }
    }

    async fn send_data_block(&mut self, seq: u8, data: &[u8]) {
        let len = data.len() as u32;
        let len_bytes = len.to_le_bytes();
        let mut header = [0u8; 10];
        header[0] = RDR_TO_PC_DATA_BLOCK;
        header[1] = len_bytes[0];
        header[2] = len_bytes[1];
        header[3] = len_bytes[2];
        header[4] = len_bytes[3];
        header[5] = 0x00;
        header[6] = seq;
        header[7] = 0x00;
        header[8] = 0x00;
        header[9] = 0x00;

        let total_len = 10 + data.len();
        let mut packet = [0u8; 64];
        let first_chunk = data.len().min(54);
        packet[..10].copy_from_slice(&header);
        packet[10..10 + first_chunk].copy_from_slice(&data[..first_chunk]);

        let first_packet_len = (10 + first_chunk).min(64);
        self.write_ep.write(&packet[..first_packet_len]).await.ok();

        let mut offset = first_chunk;
        while offset < data.len() {
            let chunk = (data.len() - offset).min(64);
            self.write_ep
                .write(&data[offset..offset + chunk])
                .await
                .ok();
            offset += chunk;
        }

        if total_len.is_multiple_of(64) {
            self.write_ep.write(&[]).await.ok();
        }
    }

    async fn send_slot_status(&mut self, seq: u8, bstatus: u8) {
        let mut packet = [0u8; 10];
        packet[0] = RDR_TO_PC_SLOT_STATUS;
        packet[5] = 0x00;
        packet[6] = seq;
        packet[7] = bstatus;
        self.write_ep.write(&packet).await.ok();
    }
}
