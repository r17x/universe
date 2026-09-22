use embassy_time::Instant;
use heapless::Vec;

use crate::types::*;

const MAX_CHANNELS: usize = 4;
const INIT_PAYLOAD_MAX: usize = 57;
const CONT_PAYLOAD_MAX: usize = 59;
const MSG_BUF_SIZE: usize = 1024;
const BROADCAST_CID: u32 = 0xFFFF_FFFF;
const TRANSACTION_TIMEOUT_MS: u64 = 3000;
const LOCK_MAX_SECS: u8 = 10;

const _: () = assert!(INIT_PAYLOAD_MAX + 7 == 64);
const _: () = assert!(CONT_PAYLOAD_MAX + 5 == 64);
const _: () = assert!(MSG_BUF_SIZE >= 1024);
const _: () = assert!(BROADCAST_CID == 0xFFFF_FFFF);

pub enum Dispatch {
    None,
    Cbor { len: usize },
    Msg { len: usize },
    Wink,
    Cancel,
}

struct Channel {
    cid: u32,
    state: ChannelState,
    locked_until: Option<u64>,
    last_active: Option<Instant>,
    next_seq: u8,
    cmd: u8,
}

impl Channel {
    const fn inactive() -> Self {
        Self {
            cid: 0,
            state: ChannelState::Idle,
            locked_until: None,
            last_active: None,
            next_seq: 0,
            cmd: 0,
        }
    }

    fn reset(&mut self) {
        self.state = ChannelState::Idle;
        self.locked_until = None;
        self.next_seq = 0;
        self.cmd = 0;
        self.last_active = None;
    }
}

pub struct CtapHid {
    channels: [Channel; MAX_CHANNELS],
    next_cid: u32,
    msg_buf: [u8; MSG_BUF_SIZE],
    active_cid: u32,
}

impl CtapHid {
    pub fn new() -> Self {
        Self {
            channels: [
                Channel::inactive(),
                Channel::inactive(),
                Channel::inactive(),
                Channel::inactive(),
            ],
            next_cid: 1,
            msg_buf: [0u8; MSG_BUF_SIZE],
            active_cid: 0,
        }
    }

    pub fn msg_buf(&self) -> &[u8] {
        &self.msg_buf
    }

    pub fn active_cid(&self) -> ChannelId {
        ChannelId(self.active_cid)
    }

    pub fn process_packet(
        &mut self,
        packet: &[u8; 64],
        response: &mut Vec<[u8; 64], 8>,
    ) -> Dispatch {
        let cid = u32::from_be_bytes([packet[0], packet[1], packet[2], packet[3]]);
        let byte4 = packet[4];

        if byte4 & 0x80 != 0 {
            self.handle_init_packet(cid, byte4, packet, response)
        } else {
            self.handle_cont_packet(cid, byte4, packet, response)
        }
    }

    fn handle_init_packet(
        &mut self,
        cid: u32,
        cmd: u8,
        packet: &[u8; 64],
        response: &mut Vec<[u8; 64], 8>,
    ) -> Dispatch {
        let payload_len = u16::from_be_bytes([packet[5], packet[6]]) as usize;

        if cid == BROADCAST_CID {
            if cmd == CTAPHID_INIT {
                return self.handle_init_command(packet, response);
            }
            let _ = response.push(Self::build_error(ChannelId(cid), ERR_INVALID_CHANNEL));
            return Dispatch::None;
        }

        if cmd == CTAPHID_INIT {
            if let Some(ch) = self.channels.iter_mut().find(|c| c.cid == cid) {
                ch.reset();
            } else {
                let _ = response.push(Self::build_error(ChannelId(cid), ERR_INVALID_CHANNEL));
                return Dispatch::None;
            }
        }

        if let Some(locked_by) = self.locked_channel() {
            if locked_by != cid {
                let _ = response.push(Self::build_error(ChannelId(cid), ERR_CHANNEL_BUSY));
                return Dispatch::None;
            }
        }

        let ch_idx = match self.find_or_allocate_channel(cid) {
            Some(i) => i,
            None => {
                let _ = response.push(Self::build_error(ChannelId(cid), ERR_CHANNEL_BUSY));
                return Dispatch::None;
            }
        };

        if cmd == CTAPHID_CANCEL {
            self.channels[ch_idx].reset();
            return Dispatch::Cancel;
        }

        let copy_len = payload_len.min(INIT_PAYLOAD_MAX).min(MSG_BUF_SIZE);
        self.msg_buf[..copy_len].copy_from_slice(&packet[7..7 + copy_len]);

        self.channels[ch_idx].cmd = cmd;
        self.channels[ch_idx].next_seq = 0;
        self.channels[ch_idx].last_active = Some(Instant::now());
        self.active_cid = cid;

        if payload_len <= INIT_PAYLOAD_MAX {
            let dispatch_len = payload_len.min(MSG_BUF_SIZE);
            self.channels[ch_idx].state = ChannelState::Idle;
            self.dispatch_command(ch_idx, cmd, cid, dispatch_len, response)
        } else {
            self.channels[ch_idx].state = ChannelState::Receiving {
                cmd,
                expected: payload_len as u16,
                received: copy_len,
            };
            Dispatch::None
        }
    }

    fn handle_cont_packet(
        &mut self,
        cid: u32,
        seq: u8,
        packet: &[u8; 64],
        response: &mut Vec<[u8; 64], 8>,
    ) -> Dispatch {
        let ch_idx = match self.channels.iter().position(|c| c.cid == cid) {
            Some(i) => i,
            None => {
                let _ = response.push(Self::build_error(ChannelId(cid), ERR_INVALID_CHANNEL));
                return Dispatch::None;
            }
        };

        let (cmd, expected, received) = match self.channels[ch_idx].state {
            ChannelState::Receiving {
                cmd,
                expected,
                received,
            } => (cmd, expected as usize, received),
            _ => {
                let _ = response.push(Self::build_error(ChannelId(cid), ERR_INVALID_CMD));
                return Dispatch::None;
            }
        };

        if seq != self.channels[ch_idx].next_seq {
            self.channels[ch_idx].reset();
            let _ = response.push(Self::build_error(ChannelId(cid), ERR_INVALID_SEQ));
            return Dispatch::None;
        }

        let remaining = expected - received;
        let copy_len = remaining.min(CONT_PAYLOAD_MAX).min(MSG_BUF_SIZE - received);
        if copy_len > 0 {
            self.msg_buf[received..received + copy_len].copy_from_slice(&packet[5..5 + copy_len]);
        }
        let new_received = received + copy_len;

        self.channels[ch_idx].next_seq = seq + 1;
        self.channels[ch_idx].last_active = Some(Instant::now());

        if new_received >= expected {
            self.channels[ch_idx].state = ChannelState::Idle;
            self.dispatch_command(ch_idx, cmd, cid, expected.min(MSG_BUF_SIZE), response)
        } else {
            self.channels[ch_idx].state = ChannelState::Receiving {
                cmd,
                expected: expected as u16,
                received: new_received,
            };
            Dispatch::None
        }
    }

    fn dispatch_command(
        &mut self,
        ch_idx: usize,
        cmd: u8,
        cid: u32,
        len: usize,
        response: &mut Vec<[u8; 64], 8>,
    ) -> Dispatch {
        match cmd {
            CTAPHID_PING => {
                let mut pkt_buf: Vec<[u8; 64], 16> = Vec::new();
                let payload = &self.msg_buf[..len];
                Self::build_response(ChannelId(cid), CTAPHID_PING, payload, &mut pkt_buf);
                for pkt in pkt_buf.iter() {
                    let _ = response.push(*pkt);
                }
                Dispatch::None
            }
            CTAPHID_WINK => {
                let mut pkt_buf: Vec<[u8; 64], 16> = Vec::new();
                Self::build_response(ChannelId(cid), CTAPHID_WINK, &[], &mut pkt_buf);
                for pkt in pkt_buf.iter() {
                    let _ = response.push(*pkt);
                }
                Dispatch::Wink
            }
            CTAPHID_LOCK => {
                self.handle_lock_command(ch_idx, cid, len, response);
                Dispatch::None
            }
            CTAPHID_CBOR => Dispatch::Cbor { len },
            CTAPHID_MSG => Dispatch::Msg { len },
            CTAPHID_CANCEL => {
                self.channels[ch_idx].reset();
                Dispatch::None
            }
            _ => {
                let _ = response.push(Self::build_error(ChannelId(cid), ERR_INVALID_CMD));
                Dispatch::None
            }
        }
    }

    fn handle_init_command(
        &mut self,
        packet: &[u8; 64],
        response: &mut Vec<[u8; 64], 8>,
    ) -> Dispatch {
        let payload_len = u16::from_be_bytes([packet[5], packet[6]]) as usize;
        if payload_len != 8 {
            let _ = response.push(Self::build_error(ChannelId(BROADCAST_CID), ERR_INVALID_LEN));
            return Dispatch::None;
        }

        let nonce = &packet[7..15];
        let new_cid = self.allocate_cid();

        let mut resp_payload = [0u8; 17];
        resp_payload[0..8].copy_from_slice(nonce);
        resp_payload[8..12].copy_from_slice(&new_cid.to_be_bytes());
        resp_payload[12] = 2;
        resp_payload[13] = 0;
        resp_payload[14] = 1;
        resp_payload[15] = 0;
        resp_payload[16] = 0x05;

        let mut pkt_buf: Vec<[u8; 64], 16> = Vec::new();
        Self::build_response(
            ChannelId(BROADCAST_CID),
            CTAPHID_INIT,
            &resp_payload,
            &mut pkt_buf,
        );
        for pkt in pkt_buf.iter() {
            let _ = response.push(*pkt);
        }

        defmt::debug!("CTAPHID INIT: allocated CID {}", new_cid);
        Dispatch::None
    }

    fn handle_lock_command(
        &mut self,
        ch_idx: usize,
        cid: u32,
        len: usize,
        response: &mut Vec<[u8; 64], 8>,
    ) {
        if len != 1 {
            let _ = response.push(Self::build_error(ChannelId(cid), ERR_INVALID_LEN));
            return;
        }

        let duration = self.msg_buf[0].min(LOCK_MAX_SECS);

        if duration == 0 {
            self.channels[ch_idx].locked_until = None;
        } else {
            let until_tick = Instant::now().as_millis() + (duration as u64) * 1000;
            self.channels[ch_idx].locked_until = Some(until_tick);
        }

        let mut pkt_buf: Vec<[u8; 64], 16> = Vec::new();
        Self::build_response(ChannelId(cid), CTAPHID_LOCK, &[], &mut pkt_buf);
        for pkt in pkt_buf.iter() {
            let _ = response.push(*pkt);
        }
    }

    fn allocate_cid(&mut self) -> u32 {
        let mut cid = self.next_cid;
        self.next_cid = self.next_cid.wrapping_add(1).max(1);
        if cid == BROADCAST_CID {
            cid = self.next_cid;
            self.next_cid = self.next_cid.wrapping_add(1).max(1);
        }

        if let Some(slot) = self
            .channels
            .iter_mut()
            .find(|c| c.cid == 0 || c.cid == cid)
        {
            slot.cid = cid;
            slot.state = ChannelState::Idle;
            slot.next_seq = 0;
            slot.cmd = 0;
            slot.last_active = None;
        } else {
            let oldest = self
                .channels
                .iter_mut()
                .min_by_key(|c| c.last_active.map(|i| i.as_millis()).unwrap_or(0))
                .unwrap();
            oldest.cid = cid;
            oldest.state = ChannelState::Idle;
            oldest.next_seq = 0;
            oldest.cmd = 0;
            oldest.last_active = None;
        }

        cid
    }

    fn find_or_allocate_channel(&mut self, cid: u32) -> Option<usize> {
        if let Some(i) = self.channels.iter().position(|c| c.cid == cid) {
            return Some(i);
        }
        if let Some(i) = self.channels.iter().position(|c| c.cid == 0) {
            self.channels[i].cid = cid;
            return Some(i);
        }
        None
    }

    fn locked_channel(&self) -> Option<u32> {
        let now = Instant::now().as_millis();
        for ch in self.channels.iter() {
            if let Some(until_tick) = ch.locked_until {
                if now < until_tick {
                    return Some(ch.cid);
                }
            }
        }
        None
    }

    pub fn build_response(
        cid: ChannelId,
        cmd: u8,
        payload: &[u8],
        packets: &mut Vec<[u8; 64], 16>,
    ) {
        let total = payload.len();
        let mut pkt = [0u8; 64];
        pkt[0..4].copy_from_slice(&cid.0.to_be_bytes());
        pkt[4] = cmd;
        pkt[5] = ((total >> 8) & 0xFF) as u8;
        pkt[6] = (total & 0xFF) as u8;

        let first_chunk = total.min(INIT_PAYLOAD_MAX);
        pkt[7..7 + first_chunk].copy_from_slice(&payload[..first_chunk]);
        let _ = packets.push(pkt);

        let mut offset = first_chunk;
        let mut seq: u8 = 0;
        while offset < total {
            let mut cont = [0u8; 64];
            cont[0..4].copy_from_slice(&cid.0.to_be_bytes());
            cont[4] = seq;
            let chunk = (total - offset).min(CONT_PAYLOAD_MAX);
            cont[5..5 + chunk].copy_from_slice(&payload[offset..offset + chunk]);
            let _ = packets.push(cont);
            offset += chunk;
            seq += 1;
        }
    }

    pub fn build_error(cid: ChannelId, error_code: u8) -> [u8; 64] {
        let mut pkt = [0u8; 64];
        pkt[0..4].copy_from_slice(&cid.0.to_be_bytes());
        pkt[4] = CTAPHID_ERROR;
        pkt[5] = 0;
        pkt[6] = 1;
        pkt[7] = error_code;
        pkt
    }

    pub fn check_timeouts(&mut self, response: &mut Vec<[u8; 64], 8>) {
        let now = Instant::now().as_millis();
        for ch in self.channels.iter_mut() {
            if let Some(until_tick) = ch.locked_until {
                if now >= until_tick {
                    ch.locked_until = None;
                }
            }
            match ch.state {
                ChannelState::Receiving { .. } => {
                    if let Some(last) = ch.last_active {
                        if now.saturating_sub(last.as_millis()) >= TRANSACTION_TIMEOUT_MS {
                            let cid = ch.cid;
                            ch.reset();
                            let _ =
                                response.push(Self::build_error(ChannelId(cid), ERR_MSG_TIMEOUT));
                        }
                    }
                }
                ChannelState::Idle => {}
            }
        }
    }
}
