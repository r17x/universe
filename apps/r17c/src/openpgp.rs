use heapless::Vec;
use p256::{ecdsa::SigningKey, EncodedPoint, FieldBytes};
use zeroize::Zeroizing;

use crate::button::UserPresence;
use crate::crypto::{self, Entropy};
use crate::storage::Storage;
use crate::types::{FlashError, UserPresenceResult};
use crate::usb::ccid::CcidHandler;

const OPENPGP_AID: &[u8] = &[
    0xD2, 0x76, 0x00, 0x01, 0x24, 0x01, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

const PGP_STORAGE_BASE: u32 = 0x50000;
const PGP_SIG_COUNT_OFFSET: u32 = PGP_STORAGE_BASE;
const PGP_SIGN_KEY_OFFSET: u32 = PGP_STORAGE_BASE + 0x100;
const PGP_DEC_KEY_OFFSET: u32 = PGP_STORAGE_BASE + 0x200;
const PGP_AUTH_KEY_OFFSET: u32 = PGP_STORAGE_BASE + 0x300;
const PGP_PW1_OFFSET: u32 = PGP_STORAGE_BASE + 0x400;
const PGP_PW3_OFFSET: u32 = PGP_STORAGE_BASE + 0x500;
const PGP_PW1_RETRIES_OFFSET: u32 = PGP_STORAGE_BASE + 0x600;
const PGP_PW3_RETRIES_OFFSET: u32 = PGP_STORAGE_BASE + 0x601;
const PGP_FPR_SIGN_OFFSET: u32 = PGP_STORAGE_BASE + 0x700;
const PGP_FPR_DEC_OFFSET: u32 = PGP_STORAGE_BASE + 0x714;
const PGP_FPR_AUTH_OFFSET: u32 = PGP_STORAGE_BASE + 0x728;
const PGP_TS_SIGN_OFFSET: u32 = PGP_STORAGE_BASE + 0x740;
const PGP_TS_DEC_OFFSET: u32 = PGP_STORAGE_BASE + 0x744;
const PGP_TS_AUTH_OFFSET: u32 = PGP_STORAGE_BASE + 0x748;

const DEFAULT_PW1: &[u8] = b"123456";
const DEFAULT_PW3: &[u8] = b"12345678";
const MAX_PIN_LEN: usize = 127;
const MAX_PIN_RETRIES: u8 = 3;

const SW_SUCCESS: u16 = 0x9000;
const SW_SECURITY_NOT_SATISFIED: u16 = 0x6982;
const SW_AUTH_METHOD_BLOCKED: u16 = 0x6983;
const SW_CONDITIONS_NOT_SATISFIED: u16 = 0x6985;
const SW_WRONG_DATA: u16 = 0x6A80;
const SW_FILE_NOT_FOUND: u16 = 0x6A82;
const SW_INCORRECT_P1P2: u16 = 0x6A86;
const SW_INS_NOT_SUPPORTED: u16 = 0x6D00;
const SW_CLA_NOT_SUPPORTED: u16 = 0x6E00;

pub struct OpenPgp<'a, S: Storage, R: Entropy, U: UserPresence> {
    storage: &'a mut S,
    rng: &'a mut R,
    user_presence: &'a U,
    selected: bool,
    pw1_verified: bool,
    pw3_verified: bool,
    pw1: Zeroizing<[u8; MAX_PIN_LEN]>,
    pw1_len: usize,
    pw3: Zeroizing<[u8; MAX_PIN_LEN]>,
    pw3_len: usize,
    sign_key: Option<Zeroizing<[u8; 32]>>,
    dec_key: Option<Zeroizing<[u8; 32]>>,
    auth_key: Option<Zeroizing<[u8; 32]>>,
    sig_count: u32,
    pw1_retries: u8,
    pw3_retries: u8,
    fpr: [[u8; 20]; 3],
    ts: [[u8; 4]; 3],
}

fn load_pin(
    storage: &mut impl Storage,
    offset: u32,
    default: &[u8],
) -> (Zeroizing<[u8; MAX_PIN_LEN]>, usize) {
    let mut buf = [0u8; MAX_PIN_LEN + 1];
    if storage.read(offset, &mut buf).is_ok() && buf[0] != 0xFF && buf[0] as usize <= MAX_PIN_LEN {
        let len = buf[0] as usize;
        let mut pin = Zeroizing::new([0u8; MAX_PIN_LEN]);
        pin[..len].copy_from_slice(&buf[1..1 + len]);
        return (pin, len);
    }
    let mut pin = Zeroizing::new([0u8; MAX_PIN_LEN]);
    let len = default.len().min(MAX_PIN_LEN);
    pin[..len].copy_from_slice(&default[..len]);
    (pin, len)
}

fn load_key(storage: &mut impl Storage, offset: u32) -> Option<Zeroizing<[u8; 32]>> {
    let mut buf = Zeroizing::new([0u8; 32]);
    if storage.read(offset, buf.as_mut()).is_ok() && buf.iter().any(|&b| b != 0xFF) {
        Some(buf)
    } else {
        None
    }
}

impl<'a, S: Storage, R: Entropy, U: UserPresence> OpenPgp<'a, S, R, U> {
    pub fn new(storage: &'a mut S, rng: &'a mut R, user_presence: &'a U) -> Self {
        let sig_count = {
            let mut buf = [0u8; 4];
            match storage.read(PGP_SIG_COUNT_OFFSET, &mut buf) {
                Ok(()) if buf != [0xFF, 0xFF, 0xFF, 0xFF] => u32::from_le_bytes(buf),
                _ => 0,
            }
        };
        let (pw1, pw1_len) = load_pin(storage, PGP_PW1_OFFSET, DEFAULT_PW1);
        let (pw3, pw3_len) = load_pin(storage, PGP_PW3_OFFSET, DEFAULT_PW3);
        let sign_key = load_key(storage, PGP_SIGN_KEY_OFFSET);
        let dec_key = load_key(storage, PGP_DEC_KEY_OFFSET);
        let auth_key = load_key(storage, PGP_AUTH_KEY_OFFSET);
        let pw1_retries = {
            let mut buf = [0u8; 1];
            match storage.read(PGP_PW1_RETRIES_OFFSET, &mut buf) {
                Ok(()) if buf[0] != 0xFF => buf[0].min(MAX_PIN_RETRIES),
                _ => MAX_PIN_RETRIES,
            }
        };
        let pw3_retries = {
            let mut buf = [0u8; 1];
            match storage.read(PGP_PW3_RETRIES_OFFSET, &mut buf) {
                Ok(()) if buf[0] != 0xFF => buf[0].min(MAX_PIN_RETRIES),
                _ => MAX_PIN_RETRIES,
            }
        };
        let mut fpr = [[0u8; 20]; 3];
        let mut ts = [[0u8; 4]; 3];
        let fpr_offsets = [PGP_FPR_SIGN_OFFSET, PGP_FPR_DEC_OFFSET, PGP_FPR_AUTH_OFFSET];
        let ts_offsets = [PGP_TS_SIGN_OFFSET, PGP_TS_DEC_OFFSET, PGP_TS_AUTH_OFFSET];
        for i in 0..3 {
            let _ = storage.read(fpr_offsets[i], &mut fpr[i]);
            if fpr[i].iter().all(|&b| b == 0xFF) {
                fpr[i] = [0u8; 20];
            }
            let _ = storage.read(ts_offsets[i], &mut ts[i]);
            if ts[i].iter().all(|&b| b == 0xFF) {
                ts[i] = [0u8; 4];
            }
        }

        Self {
            storage,
            rng,
            user_presence,
            selected: false,
            pw1_verified: false,
            pw3_verified: false,
            pw1,
            pw1_len,
            pw3,
            pw3_len,
            sign_key,
            dec_key,
            auth_key,
            sig_count,
            pw1_retries,
            pw3_retries,
            fpr,
            ts,
        }
    }

    fn sw(&self, response: &mut Vec<u8, 512>, sw: u16) {
        response.extend_from_slice(&sw.to_be_bytes()).ok();
    }

    fn sw_ok(&self, response: &mut Vec<u8, 512>) {
        response.extend_from_slice(&SW_SUCCESS.to_be_bytes()).ok();
    }

    fn persist_sig_count(&mut self) -> Result<(), FlashError> {
        self.storage
            .write(PGP_SIG_COUNT_OFFSET, &self.sig_count.to_le_bytes())
    }

    fn persist_pin(
        storage: &mut S,
        offset: u32,
        pin: &[u8; MAX_PIN_LEN],
        len: usize,
    ) -> Result<(), FlashError> {
        let mut buf = [0u8; MAX_PIN_LEN + 1];
        buf[0] = len as u8;
        buf[1..1 + len].copy_from_slice(&pin[..len]);
        storage.write(offset, &buf)
    }

    fn persist_retries(&mut self, offset: u32, retries: u8) {
        self.storage.write(offset, &[retries]).ok();
    }

    fn cmd_select(&mut self, data: &[u8], response: &mut Vec<u8, 512>) {
        if data.len() >= 6 && data[..6] == [0xD2, 0x76, 0x00, 0x01, 0x24, 0x01] {
            self.selected = true;
            self.sw_ok(response);
        } else {
            self.sw(response, SW_FILE_NOT_FOUND);
        }
    }

    fn tlv_push(buf: &mut heapless::Vec<u8, 256>, tag: &[u8], value: &[u8]) {
        buf.extend_from_slice(tag).ok();
        buf.push(value.len() as u8).ok();
        buf.extend_from_slice(value).ok();
    }

    fn algo_attr_ec() -> [u8; 9] {
        [0x13, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07]
    }

    fn algo_attr_ec_dec() -> [u8; 9] {
        [0x12, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07]
    }

    fn cmd_get_data(&mut self, p1: u8, p2: u8, response: &mut Vec<u8, 512>) {
        match (p1, p2) {
            (0x00, 0x4F) => {
                response.extend_from_slice(OPENPGP_AID).ok();
                self.sw_ok(response);
            }
            (0x00, 0x5B) => {
                self.sw_ok(response);
            }
            (0x00, 0x5E) => {
                self.sw_ok(response);
            }
            (0x00, 0x65) => {
                let mut buf: heapless::Vec<u8, 256> = heapless::Vec::new();
                Self::tlv_push(&mut buf, &[0x5F, 0x2B], &[]);
                Self::tlv_push(&mut buf, &[0x5F, 0x35], &[0x39]);
                response.extend_from_slice(&buf).ok();
                self.sw_ok(response);
            }
            (0x00, 0x7A) => {
                let sig_be = self.sig_count.to_be_bytes();
                let mut buf: heapless::Vec<u8, 256> = heapless::Vec::new();
                Self::tlv_push(&mut buf, &[0x93], &[sig_be[1], sig_be[2], sig_be[3]]);
                response.extend_from_slice(&buf).ok();
                self.sw_ok(response);
            }
            (0x00, 0xC0) => {
                response
                    .extend_from_slice(&[
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    ])
                    .ok();
                self.sw_ok(response);
            }
            (0x00, 0xC4) => {
                response
                    .extend_from_slice(&[
                        0x01,
                        MAX_PIN_LEN as u8,
                        MAX_PIN_LEN as u8,
                        MAX_PIN_LEN as u8,
                        self.pw1_retries,
                        self.pw3_retries,
                        MAX_PIN_RETRIES,
                    ])
                    .ok();
                self.sw_ok(response);
            }
            (0x00, 0xC1) | (0x00, 0xC3) => {
                response.extend_from_slice(&Self::algo_attr_ec()).ok();
                self.sw_ok(response);
            }
            (0x00, 0xC2) => {
                response.extend_from_slice(&Self::algo_attr_ec_dec()).ok();
                self.sw_ok(response);
            }
            (0x00, 0x6E) => {
                let mut buf: heapless::Vec<u8, 256> = heapless::Vec::new();
                let hist: &[u8] = &[0x00, 0x31, 0xC5, 0x73, 0xC0, 0x01, 0x40, 0x00, 0x90, 0x00];
                Self::tlv_push(&mut buf, &[0x4F], OPENPGP_AID);
                Self::tlv_push(&mut buf, &[0x5F, 0x52], hist);
                let ext_cap: &[u8] = &[0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
                Self::tlv_push(&mut buf, &[0xC0], ext_cap);
                Self::tlv_push(&mut buf, &[0xC1], &Self::algo_attr_ec());
                Self::tlv_push(&mut buf, &[0xC2], &Self::algo_attr_ec_dec());
                Self::tlv_push(&mut buf, &[0xC3], &Self::algo_attr_ec());
                let pw_status: &[u8] = &[
                    0x01,
                    MAX_PIN_LEN as u8,
                    MAX_PIN_LEN as u8,
                    MAX_PIN_LEN as u8,
                    self.pw1_retries,
                    self.pw3_retries,
                    MAX_PIN_RETRIES,
                ];
                Self::tlv_push(&mut buf, &[0xC4], pw_status);
                let mut fpr_all = [0u8; 60];
                fpr_all[..20].copy_from_slice(&self.fpr[0]);
                fpr_all[20..40].copy_from_slice(&self.fpr[1]);
                fpr_all[40..60].copy_from_slice(&self.fpr[2]);
                Self::tlv_push(&mut buf, &[0xC5], &fpr_all);
                Self::tlv_push(&mut buf, &[0xC6], &[0u8; 60]);
                let mut ts_all = [0u8; 12];
                ts_all[..4].copy_from_slice(&self.ts[0]);
                ts_all[4..8].copy_from_slice(&self.ts[1]);
                ts_all[8..12].copy_from_slice(&self.ts[2]);
                Self::tlv_push(&mut buf, &[0xCD], &ts_all);
                response.extend_from_slice(&buf).ok();
                self.sw_ok(response);
            }
            (0x00, 0x73) => {
                response
                    .extend_from_slice(&[0xC0, 0x00, 0xC1, 0x00, 0xC2, 0x00, 0xC3, 0x00])
                    .ok();
                self.sw_ok(response);
            }
            (0x5F, 0x2D) | (0x5F, 0x50) => {
                self.sw_ok(response);
            }
            (0x5F, 0x52) => {
                response
                    .extend_from_slice(&[
                        0x00, 0x31, 0xC5, 0x73, 0xC0, 0x01, 0x40, 0x00, 0x90, 0x00,
                    ])
                    .ok();
                self.sw_ok(response);
            }
            (0x00, 0xC5) => {
                for i in 0..3 {
                    response.extend_from_slice(&self.fpr[i]).ok();
                }
                self.sw_ok(response);
            }
            (0x00, 0xC6) => {
                response.extend_from_slice(&[0u8; 60]).ok();
                self.sw_ok(response);
            }
            (0x00, 0xC7) => {
                response.extend_from_slice(&self.fpr[0]).ok();
                self.sw_ok(response);
            }
            (0x00, 0xC8) => {
                response.extend_from_slice(&self.fpr[1]).ok();
                self.sw_ok(response);
            }
            (0x00, 0xC9) => {
                response.extend_from_slice(&self.fpr[2]).ok();
                self.sw_ok(response);
            }
            (0x00, 0xCD) => {
                for i in 0..3 {
                    response.extend_from_slice(&self.ts[i]).ok();
                }
                self.sw_ok(response);
            }
            (0x00, 0xCE) => {
                response.extend_from_slice(&self.ts[0]).ok();
                self.sw_ok(response);
            }
            (0x00, 0xCF) => {
                response.extend_from_slice(&self.ts[1]).ok();
                self.sw_ok(response);
            }
            (0x00, 0xD0) => {
                response.extend_from_slice(&self.ts[2]).ok();
                self.sw_ok(response);
            }
            _ => {
                self.sw(response, SW_FILE_NOT_FOUND);
            }
        }
    }

    fn cmd_verify(&mut self, _p1: u8, p2: u8, data: &[u8], response: &mut Vec<u8, 512>) {
        match p2 {
            0x81 | 0x82 => {
                if self.pw1_retries == 0 {
                    self.sw(response, SW_AUTH_METHOD_BLOCKED);
                    return;
                }
                if data.len() == self.pw1_len && data == &self.pw1[..self.pw1_len] {
                    self.pw1_retries = MAX_PIN_RETRIES;
                    self.persist_retries(PGP_PW1_RETRIES_OFFSET, self.pw1_retries);
                    self.pw1_verified = true;
                    self.sw_ok(response);
                } else {
                    self.pw1_retries -= 1;
                    self.persist_retries(PGP_PW1_RETRIES_OFFSET, self.pw1_retries);
                    self.sw(response, 0x63C0 | self.pw1_retries as u16);
                }
            }
            0x83 => {
                if self.pw3_retries == 0 {
                    self.sw(response, SW_AUTH_METHOD_BLOCKED);
                    return;
                }
                if data.len() == self.pw3_len && data == &self.pw3[..self.pw3_len] {
                    self.pw3_retries = MAX_PIN_RETRIES;
                    self.persist_retries(PGP_PW3_RETRIES_OFFSET, self.pw3_retries);
                    self.pw3_verified = true;
                    self.sw_ok(response);
                } else {
                    self.pw3_retries -= 1;
                    self.persist_retries(PGP_PW3_RETRIES_OFFSET, self.pw3_retries);
                    self.sw(response, 0x63C0 | self.pw3_retries as u16);
                }
            }
            _ => {
                self.sw(response, SW_INCORRECT_P1P2);
            }
        }
    }

    fn cmd_change_reference_data(
        &mut self,
        _p1: u8,
        p2: u8,
        data: &[u8],
        response: &mut Vec<u8, 512>,
    ) {
        match p2 {
            0x81 => {
                let old_len = self.pw1_len;
                if data.len() <= old_len {
                    self.sw(response, SW_WRONG_DATA);
                    return;
                }
                let old = &data[..old_len];
                let new = &data[old_len..];
                if new.len() < 6 || new.len() > MAX_PIN_LEN {
                    self.sw(response, SW_WRONG_DATA);
                    return;
                }
                if old != &self.pw1[..old_len] {
                    self.sw(response, SW_SECURITY_NOT_SATISFIED);
                    return;
                }
                let new_len = new.len();
                self.pw1 = Zeroizing::new([0u8; MAX_PIN_LEN]);
                self.pw1[..new_len].copy_from_slice(new);
                self.pw1_len = new_len;
                Self::persist_pin(self.storage, PGP_PW1_OFFSET, &self.pw1, self.pw1_len).ok();
                self.sw_ok(response);
            }
            0x83 => {
                let old_len = self.pw3_len;
                if data.len() <= old_len {
                    self.sw(response, SW_WRONG_DATA);
                    return;
                }
                let old = &data[..old_len];
                let new = &data[old_len..];
                if new.len() < 8 || new.len() > MAX_PIN_LEN {
                    self.sw(response, SW_WRONG_DATA);
                    return;
                }
                if old != &self.pw3[..old_len] {
                    self.sw(response, SW_SECURITY_NOT_SATISFIED);
                    return;
                }
                let new_len = new.len();
                self.pw3 = Zeroizing::new([0u8; MAX_PIN_LEN]);
                self.pw3[..new_len].copy_from_slice(new);
                self.pw3_len = new_len;
                Self::persist_pin(self.storage, PGP_PW3_OFFSET, &self.pw3, self.pw3_len).ok();
                self.sw_ok(response);
            }
            _ => {
                self.sw(response, SW_INCORRECT_P1P2);
            }
        }
    }

    async fn cmd_pso(&mut self, p1: u8, p2: u8, data: &[u8], response: &mut Vec<u8, 512>) {
        match (p1, p2) {
            (0x9E, 0x9A) => {
                if !self.pw1_verified {
                    self.sw(response, SW_CONDITIONS_NOT_SATISFIED);
                    return;
                }
                match self.user_presence.wait(30000).await {
                    UserPresenceResult::Confirmed => {}
                    _ => {
                        self.sw(response, SW_CONDITIONS_NOT_SATISFIED);
                        return;
                    }
                }
                let key = match &self.sign_key {
                    Some(k) => {
                        let mut buf = Zeroizing::new([0u8; 32]);
                        buf.copy_from_slice(k.as_ref());
                        buf
                    }
                    None => {
                        self.sw(response, SW_CONDITIONS_NOT_SATISFIED);
                        return;
                    }
                };
                match crypto::sign(&key, data) {
                    Ok(sig) => {
                        response.extend_from_slice(&sig).ok();
                        self.sig_count += 1;
                        self.persist_sig_count().ok();
                        self.sw_ok(response);
                    }
                    Err(_) => {
                        self.sw(response, SW_WRONG_DATA);
                    }
                }
            }
            (0x80, 0x86) => {
                if !self.pw1_verified {
                    self.sw(response, SW_CONDITIONS_NOT_SATISFIED);
                    return;
                }
                let ec_point = if data.len() >= 65 && data[0] == 0x04 {
                    Some(&data[..65])
                } else if data.len() >= 2 && data[0] == 0xA6 {
                    Self::extract_ec_point(data)
                } else {
                    None
                };
                let ec_point = match ec_point {
                    Some(p) if p.len() >= 65 && p[0] == 0x04 => p,
                    _ => {
                        self.sw(response, SW_WRONG_DATA);
                        return;
                    }
                };
                let key = match &self.dec_key {
                    Some(k) => {
                        let mut buf = Zeroizing::new([0u8; 32]);
                        buf.copy_from_slice(k.as_ref());
                        buf
                    }
                    None => {
                        self.sw(response, SW_CONDITIONS_NOT_SATISFIED);
                        return;
                    }
                };
                let peer_x: &[u8; 32] = match ec_point[1..33].try_into() {
                    Ok(v) => v,
                    Err(_) => {
                        self.sw(response, SW_WRONG_DATA);
                        return;
                    }
                };
                let peer_y: &[u8; 32] = match ec_point[33..65].try_into() {
                    Ok(v) => v,
                    Err(_) => {
                        self.sw(response, SW_WRONG_DATA);
                        return;
                    }
                };
                match crypto::ecdh_shared_secret(&key, peer_x, peer_y) {
                    Ok(secret) => {
                        response.extend_from_slice(secret.as_ref()).ok();
                        self.sw_ok(response);
                    }
                    Err(_) => {
                        self.sw(response, SW_WRONG_DATA);
                    }
                }
            }
            _ => {
                self.sw(response, SW_INCORRECT_P1P2);
            }
        }
    }

    fn cmd_internal_auth(&mut self, data: &[u8], response: &mut Vec<u8, 512>) {
        if !self.pw1_verified {
            self.sw(response, SW_CONDITIONS_NOT_SATISFIED);
            return;
        }
        let key = match &self.auth_key {
            Some(k) => {
                let mut buf = Zeroizing::new([0u8; 32]);
                buf.copy_from_slice(k.as_ref());
                buf
            }
            None => {
                self.sw(response, SW_CONDITIONS_NOT_SATISFIED);
                return;
            }
        };
        match crypto::sign(&key, data) {
            Ok(sig) => {
                response.extend_from_slice(&sig).ok();
                self.sw_ok(response);
            }
            Err(_) => {
                self.sw(response, SW_WRONG_DATA);
            }
        }
    }

    fn extract_ec_point(data: &[u8]) -> Option<&[u8]> {
        let mut pos = 0;
        if pos >= data.len() || data[pos] != 0xA6 {
            return None;
        }
        pos += 1;
        let (a6_len, consumed) = Self::parse_tlv_len(&data[pos..])?;
        pos += consumed;
        let a6_end = pos + a6_len;
        if a6_end > data.len() {
            return None;
        }
        if pos + 1 >= a6_end || data[pos] != 0x7F || data[pos + 1] != 0x49 {
            return None;
        }
        pos += 2;
        let (_, consumed) = Self::parse_tlv_len(&data[pos..])?;
        pos += consumed;
        if pos >= a6_end || data[pos] != 0x86 {
            return None;
        }
        pos += 1;
        let (point_len, consumed) = Self::parse_tlv_len(&data[pos..])?;
        pos += consumed;
        if pos + point_len > data.len() {
            return None;
        }
        Some(&data[pos..pos + point_len])
    }

    fn parse_tlv_len(data: &[u8]) -> Option<(usize, usize)> {
        if data.is_empty() {
            return None;
        }
        if data[0] < 0x80 {
            Some((data[0] as usize, 1))
        } else if data[0] == 0x81 && data.len() >= 2 {
            Some((data[1] as usize, 2))
        } else if data[0] == 0x82 && data.len() >= 3 {
            Some((((data[1] as usize) << 8) | data[2] as usize, 3))
        } else {
            None
        }
    }

    fn pubkey_response(
        &self,
        verifying_key: &crypto::VerifyingKey,
        response: &mut Vec<u8, 512>,
    ) -> bool {
        let point = EncodedPoint::from(verifying_key);
        let (x, y) = match (point.x(), point.y()) {
            (Some(x), Some(y)) => (x, y),
            _ => return false,
        };
        let mut uncompressed = [0u8; 65];
        uncompressed[0] = 0x04;
        uncompressed[1..33].copy_from_slice(x);
        uncompressed[33..65].copy_from_slice(y);
        response.push(0x7F).ok();
        response.push(0x49).ok();
        response.push(0x43).ok();
        response.push(0x86).ok();
        response.push(0x41).ok();
        response.extend_from_slice(&uncompressed).ok();
        true
    }

    fn key_for_crt(&self, data: &[u8]) -> Option<&Option<Zeroizing<[u8; 32]>>> {
        if data.len() >= 2 {
            match data[0] {
                0xB6 => Some(&self.sign_key),
                0xB8 => Some(&self.dec_key),
                0xA4 => Some(&self.auth_key),
                _ => None,
            }
        } else {
            Some(&self.sign_key)
        }
    }

    fn key_offset_for_crt(data: &[u8]) -> u32 {
        if data.len() >= 2 {
            match data[0] {
                0xB6 => PGP_SIGN_KEY_OFFSET,
                0xB8 => PGP_DEC_KEY_OFFSET,
                0xA4 => PGP_AUTH_KEY_OFFSET,
                _ => PGP_SIGN_KEY_OFFSET,
            }
        } else {
            PGP_SIGN_KEY_OFFSET
        }
    }

    fn cmd_generate_key(&mut self, p1: u8, _p2: u8, data: &[u8], response: &mut Vec<u8, 512>) {
        match p1 {
            0x80 => {
                let (priv_bytes, verifying_key) = crypto::generate_keypair(self.rng);
                let ok = self.pubkey_response(&verifying_key, response);
                if !ok {
                    self.sw(response, SW_WRONG_DATA);
                    return;
                }
                let offset = Self::key_offset_for_crt(data);
                let _ = self.storage.write(offset, priv_bytes.as_ref());
                match data.first() {
                    Some(0xB8) => self.dec_key = Some(priv_bytes),
                    Some(0xA4) => self.auth_key = Some(priv_bytes),
                    _ => self.sign_key = Some(priv_bytes),
                }
                self.sw_ok(response);
            }
            0x81 => {
                let key_slot = match self.key_for_crt(data) {
                    Some(slot) => slot,
                    None => {
                        self.sw(response, SW_INCORRECT_P1P2);
                        return;
                    }
                };
                let key_bytes = match key_slot {
                    Some(k) => {
                        let mut buf = Zeroizing::new([0u8; 32]);
                        buf.copy_from_slice(k.as_ref());
                        buf
                    }
                    None => {
                        self.sw(response, 0x6A88);
                        return;
                    }
                };
                let sk = match SigningKey::from_bytes(FieldBytes::from_slice(key_bytes.as_ref())) {
                    Ok(sk) => sk,
                    Err(_) => {
                        self.sw(response, SW_WRONG_DATA);
                        return;
                    }
                };
                let vk = sk.verifying_key();
                let ok = self.pubkey_response(vk, response);
                if !ok {
                    self.sw(response, SW_WRONG_DATA);
                    return;
                }
                self.sw_ok(response);
            }
            _ => {
                self.sw(response, SW_INCORRECT_P1P2);
            }
        }
    }

    fn cmd_put_data(&mut self, p1: u8, p2: u8, data: &[u8], response: &mut Vec<u8, 512>) {
        if !self.pw3_verified {
            self.sw(response, SW_CONDITIONS_NOT_SATISFIED);
            return;
        }
        match (p1, p2) {
            (0x3F, 0xFF) if data.len() == 32 => {
                let mut key_bytes = Zeroizing::new([0u8; 32]);
                key_bytes.copy_from_slice(data);
                self.sign_key = Some(key_bytes);
                let _ = self.storage.write(PGP_SIGN_KEY_OFFSET, data);
                self.sw_ok(response);
            }
            (0xB8, 0x00) if data.len() == 32 => {
                let mut key_bytes = Zeroizing::new([0u8; 32]);
                key_bytes.copy_from_slice(data);
                self.dec_key = Some(key_bytes);
                let _ = self.storage.write(PGP_DEC_KEY_OFFSET, data);
                self.sw_ok(response);
            }
            (0xA4, 0x00) if data.len() == 32 => {
                let mut key_bytes = Zeroizing::new([0u8; 32]);
                key_bytes.copy_from_slice(data);
                self.auth_key = Some(key_bytes);
                let _ = self.storage.write(PGP_AUTH_KEY_OFFSET, data);
                self.sw_ok(response);
            }
            (0x00, 0xC7) if data.len() == 20 => {
                self.fpr[0].copy_from_slice(data);
                let _ = self.storage.write(PGP_FPR_SIGN_OFFSET, data);
                self.sw_ok(response);
            }
            (0x00, 0xC8) if data.len() == 20 => {
                self.fpr[1].copy_from_slice(data);
                let _ = self.storage.write(PGP_FPR_DEC_OFFSET, data);
                self.sw_ok(response);
            }
            (0x00, 0xC9) if data.len() == 20 => {
                self.fpr[2].copy_from_slice(data);
                let _ = self.storage.write(PGP_FPR_AUTH_OFFSET, data);
                self.sw_ok(response);
            }
            (0x00, 0xCE) if data.len() == 4 => {
                self.ts[0].copy_from_slice(data);
                let _ = self.storage.write(PGP_TS_SIGN_OFFSET, data);
                self.sw_ok(response);
            }
            (0x00, 0xCF) if data.len() == 4 => {
                self.ts[1].copy_from_slice(data);
                let _ = self.storage.write(PGP_TS_DEC_OFFSET, data);
                self.sw_ok(response);
            }
            (0x00, 0xD0) if data.len() == 4 => {
                self.ts[2].copy_from_slice(data);
                let _ = self.storage.write(PGP_TS_AUTH_OFFSET, data);
                self.sw_ok(response);
            }
            (0x00, 0x5B) | (0x00, 0x5E) | (0x5F, 0x2D) | (0x5F, 0x50) => {
                self.sw_ok(response);
            }
            _ => {
                self.sw(response, SW_INCORRECT_P1P2);
            }
        }
    }

    fn cmd_get_challenge(&mut self, _p1: u8, _p2: u8, response: &mut Vec<u8, 512>) {
        let mut buf = [0u8; 32];
        self.rng.fill_random(&mut buf);
        response.extend_from_slice(&buf).ok();
        self.sw_ok(response);
    }
}

impl<'a, S: Storage, R: Entropy, U: UserPresence> CcidHandler for OpenPgp<'a, S, R, U> {
    async fn handle_apdu(&mut self, apdu: &[u8], response: &mut Vec<u8, 512>) {
        if apdu.len() < 4 {
            self.sw(response, SW_WRONG_DATA);
            return;
        }
        let cla = apdu[0];
        let ins = apdu[1];
        let p1 = apdu[2];
        let p2 = apdu[3];
        let data = if apdu.len() <= 5 {
            &[][..]
        } else {
            let lc = apdu[4] as usize;
            if apdu.len() >= 5 + lc {
                &apdu[5..5 + lc]
            } else {
                return self.sw(response, SW_WRONG_DATA);
            }
        };

        if cla != 0x00 {
            self.sw(response, SW_CLA_NOT_SUPPORTED);
            return;
        }

        if ins != 0xA4 && !self.selected {
            self.sw(response, SW_FILE_NOT_FOUND);
            return;
        }

        match ins {
            0xA4 => self.cmd_select(data, response),
            0xCA => self.cmd_get_data(p1, p2, response),
            0x20 => self.cmd_verify(p1, p2, data, response),
            0x24 => self.cmd_change_reference_data(p1, p2, data, response),
            0x2A => self.cmd_pso(p1, p2, data, response).await,
            0x88 => self.cmd_internal_auth(data, response),
            0x47 => self.cmd_generate_key(p1, p2, data, response),
            0xDA => self.cmd_put_data(p1, p2, data, response),
            0x84 => self.cmd_get_challenge(p1, p2, response),
            _ => self.sw(response, SW_INS_NOT_SUPPORTED),
        }
    }
}
