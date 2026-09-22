use heapless::Vec;

use crate::oath;
use crate::storage::{self, OathCredential, Storage};
use crate::usb::ccid::CcidHandler;

pub const OATH_AID: &[u8] = &[0xA0, 0x00, 0x00, 0x05, 0x27, 0x21, 0x01];

const TAG_NAME: u8 = 0x71;
const TAG_NAME_LIST: u8 = 0x72;
const TAG_KEY: u8 = 0x73;
const TAG_CHALLENGE: u8 = 0x74;
const TAG_FULL_RESPONSE: u8 = 0x76;

const INS_PUT: u8 = 0x01;
const INS_DELETE: u8 = 0x02;
const INS_LIST: u8 = 0xA1;
const INS_CALCULATE: u8 = 0xA2;
const INS_CALCULATE_ALL: u8 = 0xA4;
const INS_SELECT: u8 = 0xA4;

const SW_SUCCESS: u16 = 0x9000;
const SW_WRONG_DATA: u16 = 0x6A80;
const SW_NOT_FOUND: u16 = 0x6A82;
const SW_INS_NOT_SUPPORTED: u16 = 0x6D00;

pub struct OathApp<'a, S: Storage> {
    storage: &'a mut S,
    selected: bool,
}

fn find_tlv(data: &[u8], tag: u8) -> Option<&[u8]> {
    let mut pos = 0;
    while pos + 1 < data.len() {
        let t = data[pos];
        let l = data[pos + 1] as usize;
        pos += 2;
        if pos + l > data.len() {
            return None;
        }
        if t == tag {
            return Some(&data[pos..pos + l]);
        }
        pos += l;
    }
    None
}

impl<'a, S: Storage> OathApp<'a, S> {
    pub fn new(storage: &'a mut S) -> Self {
        Self {
            storage,
            selected: false,
        }
    }

    fn sw(&self, response: &mut Vec<u8, 512>, sw: u16) {
        response.extend_from_slice(&sw.to_be_bytes()).ok();
    }

    fn cmd_select(&mut self, data: &[u8], response: &mut Vec<u8, 512>) {
        if data.len() >= OATH_AID.len() && data[..OATH_AID.len()] == *OATH_AID {
            self.selected = true;
            response
                .extend_from_slice(&[0x79, 0x03, 0x01, 0x00, 0x00])
                .ok();
            response.extend_from_slice(&[0x71, 0x08]).ok();
            response.extend_from_slice(b"r17c0001").ok();
            self.sw(response, SW_SUCCESS);
        } else {
            self.sw(response, SW_NOT_FOUND);
        }
    }

    fn cmd_put(&mut self, data: &[u8], response: &mut Vec<u8, 512>) {
        let name = match find_tlv(data, TAG_NAME) {
            Some(n) if !n.is_empty() => n,
            _ => {
                self.sw(response, SW_WRONG_DATA);
                return;
            }
        };

        let key_data = match find_tlv(data, TAG_KEY) {
            Some(k) if k.len() >= 3 => k,
            _ => {
                self.sw(response, SW_WRONG_DATA);
                return;
            }
        };

        let type_algo = key_data[0];
        let digits = key_data[1];
        let secret_bytes = &key_data[2..];

        let mut cred_name: heapless::Vec<u8, 64> = heapless::Vec::new();
        if cred_name.extend_from_slice(name).is_err() {
            self.sw(response, SW_WRONG_DATA);
            return;
        }

        let mut secret: heapless::Vec<u8, 64> = heapless::Vec::new();
        if secret.extend_from_slice(secret_bytes).is_err() {
            self.sw(response, SW_WRONG_DATA);
            return;
        }

        let cred = OathCredential {
            name: cred_name,
            type_algo,
            digits,
            secret,
            counter: 0,
        };

        match storage::store_oath_credential(self.storage, &cred) {
            Ok(()) => self.sw(response, SW_SUCCESS),
            Err(_) => self.sw(response, SW_WRONG_DATA),
        }
    }

    fn cmd_delete(&mut self, data: &[u8], response: &mut Vec<u8, 512>) {
        let name = match find_tlv(data, TAG_NAME) {
            Some(n) if !n.is_empty() => n,
            _ => {
                self.sw(response, SW_WRONG_DATA);
                return;
            }
        };

        match storage::delete_oath_credential(self.storage, name) {
            Ok(true) => self.sw(response, SW_SUCCESS),
            Ok(false) => self.sw(response, SW_NOT_FOUND),
            Err(_) => self.sw(response, SW_WRONG_DATA),
        }
    }

    fn cmd_list(&mut self, response: &mut Vec<u8, 512>) {
        let creds = match storage::list_oath_credentials(self.storage) {
            Ok(c) => c,
            Err(_) => {
                self.sw(response, SW_WRONG_DATA);
                return;
            }
        };

        for (name, type_algo) in creds.iter() {
            response.push(TAG_NAME_LIST).ok();
            response.push((1 + name.len()) as u8).ok();
            response.push(*type_algo).ok();
            response.extend_from_slice(name).ok();
        }

        self.sw(response, SW_SUCCESS);
    }

    fn cmd_calculate(&mut self, data: &[u8], response: &mut Vec<u8, 512>) {
        let name = match find_tlv(data, TAG_NAME) {
            Some(n) if !n.is_empty() => n,
            _ => {
                self.sw(response, SW_WRONG_DATA);
                return;
            }
        };

        let (cred, _slot) = match storage::find_oath_credential(self.storage, name) {
            Ok(Some(pair)) => pair,
            Ok(None) => {
                self.sw(response, SW_NOT_FOUND);
                return;
            }
            Err(_) => {
                self.sw(response, SW_WRONG_DATA);
                return;
            }
        };

        let cred_type = cred.type_algo & 0xF0;

        let otp = match cred_type {
            0x20 => {
                let challenge = match find_tlv(data, TAG_CHALLENGE) {
                    Some(c) if c.len() == 8 => {
                        u64::from_be_bytes([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]])
                    }
                    _ => {
                        self.sw(response, SW_WRONG_DATA);
                        return;
                    }
                };
                oath::totp(&cred.secret, challenge, 1, cred.digits)
            }
            0x10 => {
                let otp = oath::hotp(&cred.secret, cred.counter, cred.digits);
                let updated = OathCredential {
                    name: cred.name,
                    type_algo: cred.type_algo,
                    digits: cred.digits,
                    secret: cred.secret,
                    counter: cred.counter + 1,
                };
                if storage::store_oath_credential(self.storage, &updated).is_err() {
                    self.sw(response, SW_WRONG_DATA);
                    return;
                }
                otp
            }
            _ => {
                self.sw(response, SW_WRONG_DATA);
                return;
            }
        };

        response.push(TAG_FULL_RESPONSE).ok();
        response.push(5).ok();
        response.push(cred.digits).ok();
        response.extend_from_slice(&otp.to_be_bytes()).ok();
        self.sw(response, SW_SUCCESS);
    }

    fn cmd_calculate_all(&mut self, _p2: u8, data: &[u8], response: &mut Vec<u8, 512>) {
        let challenge = match find_tlv(data, TAG_CHALLENGE) {
            Some(c) if c.len() == 8 => {
                u64::from_be_bytes([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]])
            }
            _ => {
                self.sw(response, SW_WRONG_DATA);
                return;
            }
        };

        let creds = match storage::list_oath_credentials(self.storage) {
            Ok(c) => c,
            Err(_) => {
                self.sw(response, SW_WRONG_DATA);
                return;
            }
        };

        for (name, type_algo) in creds.iter() {
            let (cred, _slot) = match storage::find_oath_credential(self.storage, name) {
                Ok(Some(pair)) => pair,
                _ => continue,
            };

            response.push(TAG_NAME).ok();
            response.push(name.len() as u8).ok();
            response.extend_from_slice(name).ok();

            let cred_type = type_algo & 0xF0;
            match cred_type {
                0x20 => {
                    let otp = oath::totp(&cred.secret, challenge, 1, cred.digits);
                    response.push(TAG_FULL_RESPONSE).ok();
                    response.push(5).ok();
                    response.push(cred.digits).ok();
                    response.extend_from_slice(&otp.to_be_bytes()).ok();
                }
                0x10 => {
                    response.push(0x77).ok();
                    response.push(5).ok();
                    response.push(cred.digits).ok();
                    response.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]).ok();
                }
                _ => {}
            }
        }

        self.sw(response, SW_SUCCESS);
    }
}

impl<'a, S: Storage> CcidHandler for OathApp<'a, S> {
    async fn handle_apdu(&mut self, apdu: &[u8], response: &mut Vec<u8, 512>) {
        if apdu.len() < 4 {
            self.sw(response, SW_WRONG_DATA);
            return;
        }
        let ins = apdu[1];
        let p1 = apdu[2];
        let p2 = apdu[3];
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

        let is_select = ins == INS_SELECT && p1 == 0x04;

        if !is_select && !self.selected {
            self.sw(response, SW_NOT_FOUND);
            return;
        }

        match ins {
            INS_SELECT if p1 == 0x04 => self.cmd_select(data, response),
            INS_CALCULATE_ALL if p1 == 0x00 => self.cmd_calculate_all(p2, data, response),
            INS_PUT => self.cmd_put(data, response),
            INS_DELETE => self.cmd_delete(data, response),
            INS_LIST => self.cmd_list(response),
            INS_CALCULATE => self.cmd_calculate(data, response),
            _ => self.sw(response, SW_INS_NOT_SUPPORTED),
        }
    }
}
