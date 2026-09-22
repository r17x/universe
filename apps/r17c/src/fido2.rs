use embassy_time::{Duration, Instant, Timer};
use heapless::Vec;
use p256::{ecdsa::SigningKey, FieldBytes};
use zeroize::Zeroizing;

use crate::button::UserPresence;
use crate::cbor::{CborParser, CborWriter};
use crate::crypto::{self, Entropy};
use crate::storage::{self, Storage};
use crate::types::*;

const CMD_MAKE_CREDENTIAL: u8 = 0x01;
const CMD_GET_ASSERTION: u8 = 0x02;
const CMD_GET_INFO: u8 = 0x04;
const CMD_CLIENT_PIN: u8 = 0x06;
const CMD_RESET: u8 = 0x07;
const CMD_CRED_MGMT: u8 = 0x0A;
const CMD_CRED_MGMT_PREVIEW: u8 = 0x41;

const U2F_REGISTER: u8 = 0x01;
const U2F_AUTHENTICATE: u8 = 0x02;
const U2F_VERSION: u8 = 0x03;

const ATTESTATION_KEY: [u8; 32] = [
    0xf3, 0xfc, 0xcc, 0x0d, 0x00, 0xd8, 0x03, 0x19, 0x54, 0xf9, 0x08, 0x64, 0xd4, 0x3c, 0x24, 0x7f,
    0x4b, 0xf5, 0xf0, 0x66, 0x5c, 0x6b, 0x50, 0xcc, 0x17, 0x74, 0x9a, 0x27, 0xd1, 0xcf, 0x76, 0x64,
];

const TBS_CERT_PREFIX: [u8; 115] = [
    0x30, 0x81, 0x91, 0xa0, 0x03, 0x02, 0x01, 0x02, 0x02, 0x01, 0x01, 0x30, 0x0a, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02, 0x30, 0x11, 0x31, 0x0f, 0x30, 0x0d, 0x06, 0x03, 0x55,
    0x04, 0x03, 0x0c, 0x04, 0x72, 0x31, 0x37, 0x63, 0x30, 0x1e, 0x17, 0x0d, 0x32, 0x30, 0x30, 0x31,
    0x30, 0x31, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x5a, 0x17, 0x0d, 0x35, 0x30, 0x30, 0x31, 0x30,
    0x31, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x5a, 0x30, 0x11, 0x31, 0x0f, 0x30, 0x0d, 0x06, 0x03,
    0x55, 0x04, 0x03, 0x0c, 0x04, 0x72, 0x31, 0x37, 0x63, 0x30, 0x39, 0x30, 0x13, 0x06, 0x07, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x03, 0x22, 0x00,
];

const SIG_ALG_DER: [u8; 12] = [
    0x30, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02,
];

const U2F_P1_CHECK_ONLY: u8 = 0x07;
const U2F_SW_NO_ERROR: u16 = 0x9000;
const U2F_SW_CONDITIONS_NOT_SATISFIED: u16 = 0x6985;
const U2F_SW_WRONG_DATA: u16 = 0x6A80;
const U2F_SW_WRONG_LENGTH: u16 = 0x6700;
const U2F_SW_INS_NOT_SUPPORTED: u16 = 0x6D00;
const U2F_SW_CLA_NOT_SUPPORTED: u16 = 0x6E00;

const USER_PRESENCE_TIMEOUT_MS: u32 = 30_000;

fn build_auth_data_make(
    rp_id_hash: &[u8; 32],
    flags: u8,
    sign_count: u32,
    cred_id: &[u8],
    cose_key: &[u8],
) -> Vec<u8, 384> {
    let mut out: Vec<u8, 384> = Vec::new();
    out.extend_from_slice(rp_id_hash).ok();
    out.push(flags).ok();
    out.extend_from_slice(&sign_count.to_be_bytes()).ok();
    out.extend_from_slice(&AAGUID.0).ok();
    let id_len = cred_id.len() as u16;
    out.extend_from_slice(&id_len.to_be_bytes()).ok();
    out.extend_from_slice(cred_id).ok();
    out.extend_from_slice(cose_key).ok();
    out
}

fn build_auth_data_assert(rp_id_hash: &[u8; 32], flags: u8, sign_count: u32) -> Vec<u8, 256> {
    let mut out: Vec<u8, 256> = Vec::new();
    out.extend_from_slice(rp_id_hash).ok();
    out.push(flags).ok();
    out.extend_from_slice(&sign_count.to_be_bytes()).ok();
    out
}

pub struct Fido2<'a, S: Storage, R: Entropy, U: UserPresence> {
    storage: &'a mut S,
    rng: &'a mut R,
    user_presence: &'a U,
    master_secret: Zeroizing<[u8; 32]>,
    boot_time: Instant,
    pin_key_priv: Zeroizing<[u8; 32]>,
    pin_key_pub: crypto::VerifyingKey,
    pin_token: [u8; 16],
    rp_list: heapless::Vec<(RpIdHash, heapless::Vec<u8, 28>), 16>,
    rp_index: usize,
    cred_list: heapless::Vec<(CredentialId, heapless::Vec<u8, 64>, u8), 16>,
    cred_index: usize,
}

impl<'a, S: Storage, R: Entropy, U: UserPresence> Fido2<'a, S, R, U> {
    pub fn new(
        storage: &'a mut S,
        rng: &'a mut R,
        user_presence: &'a U,
        master_secret: Zeroizing<[u8; 32]>,
    ) -> Self {
        let (pin_priv, pin_pub) = crypto::generate_keypair(rng);
        let mut pin_token = [0u8; 16];
        rng.fill_random(&mut pin_token);
        Self {
            storage,
            rng,
            user_presence,
            master_secret,
            boot_time: Instant::now(),
            pin_key_priv: pin_priv,
            pin_key_pub: pin_pub,
            pin_token,
            rp_list: heapless::Vec::new(),
            rp_index: 0,
            cred_list: heapless::Vec::new(),
            cred_index: 0,
        }
    }

    pub async fn process_cbor(&mut self, data: &[u8], len: usize) -> Vec<u8, 512> {
        let payload = match data.get(..len) {
            Some(s) => s,
            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
        };
        if payload.is_empty() {
            return Self::error_response(CTAP2_ERR_INVALID_CBOR);
        }
        let cmd = payload[0];
        let body = &payload[1..];
        defmt::debug!("CTAP2 cmd 0x{:02X} len={}", cmd, len);
        match cmd {
            CMD_GET_INFO => self.cmd_get_info(),
            CMD_MAKE_CREDENTIAL => self.cmd_make_credential(body).await,
            CMD_GET_ASSERTION => self.cmd_get_assertion(body).await,
            CMD_CLIENT_PIN => self.cmd_client_pin(body).await,
            CMD_RESET => self.cmd_reset().await,
            CMD_CRED_MGMT | CMD_CRED_MGMT_PREVIEW => self.cmd_credential_management(body).await,
            _ => Self::error_response(ERR_INVALID_CMD),
        }
    }

    pub async fn process_msg(&mut self, data: &[u8], len: usize) -> Vec<u8, 512> {
        if len < 7 {
            return Self::sw_response(U2F_SW_WRONG_LENGTH);
        }
        let cla = data[0];
        let ins = data[1];
        let p1 = data[2];
        let lc = ((data[4] as usize) << 16) | ((data[5] as usize) << 8) | (data[6] as usize);
        let body = match data.get(7..7 + lc) {
            Some(s) => s,
            None => return Self::sw_response(U2F_SW_WRONG_LENGTH),
        };

        if cla != 0x00 {
            return Self::sw_response(U2F_SW_CLA_NOT_SUPPORTED);
        }

        defmt::debug!("U2F INS 0x{:02X} P1=0x{:02X} lc={}", ins, p1, lc);

        match ins {
            U2F_REGISTER => self.u2f_register(body).await,
            U2F_AUTHENTICATE => self.u2f_authenticate(p1, body).await,
            U2F_VERSION => {
                let mut out: Vec<u8, 512> = Vec::new();
                out.extend_from_slice(b"U2F_V2").ok();
                out.extend_from_slice(&U2F_SW_NO_ERROR.to_be_bytes()).ok();
                out
            }
            _ => Self::sw_response(U2F_SW_INS_NOT_SUPPORTED),
        }
    }

    fn cmd_get_info(&mut self) -> Vec<u8, 512> {
        let pin_is_set = storage::is_pin_set(self.storage).unwrap_or(false);
        let mut w = CborWriter::new();
        w.map(10);

        w.unsigned(0x01);
        w.array(2);
        w.text("FIDO_2_0");
        w.text("U2F_V2");

        w.unsigned(0x02);
        w.array(2);
        w.text("credProtect");
        w.text("hmac-secret");

        w.unsigned(0x03);
        w.bytes(&AAGUID.0);

        w.unsigned(0x04);
        w.map(6);
        w.text("rk");
        w.bool_val(true);
        w.text("up");
        w.bool_val(true);
        w.text("plat");
        w.bool_val(false);
        w.text("credMgmt");
        w.bool_val(true);
        w.text("clientPin");
        w.bool_val(pin_is_set);
        w.text("credentialMgmtPreview");
        w.bool_val(true);

        w.unsigned(0x05);
        w.unsigned(1024);

        w.unsigned(0x06);
        w.array(1);
        w.unsigned(1);

        w.unsigned(0x07);
        w.unsigned(8);

        w.unsigned(0x08);
        w.unsigned(128);

        w.unsigned(0x09);
        w.array(1);
        w.text("usb");

        w.unsigned(0x0A);
        w.array(1);
        w.map(2);
        w.text("alg");
        w.negative(-7);
        w.text("type");
        w.text("public-key");

        let cbor = w.into_vec();
        let mut resp: Vec<u8, 512> = Vec::new();
        resp.push(CTAP2_OK).ok();
        resp.extend_from_slice(&cbor).ok();
        resp
    }

    async fn cmd_make_credential(&mut self, data: &[u8]) -> Vec<u8, 512> {
        let mut p = CborParser::new(data);

        let map_len = match p.read_map_len() {
            Some(l) => l,
            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
        };

        let mut client_data_hash: Option<&[u8]> = None;
        let mut rp_id: Option<&str> = None;
        let mut user_id: Option<&[u8]> = None;
        let mut has_es256 = false;
        let mut exclude_list: Vec<&[u8], 8> = Vec::new();
        let mut rk_requested = false;
        let mut hmac_secret_requested = false;
        let mut cred_protect_level: Option<u8> = None;
        let mut pin_uv_auth_param: Option<&[u8]> = None;
        let mut pin_uv_auth_protocol: Option<i32> = None;

        for _ in 0..map_len {
            let key = match p.read_int() {
                Some(k) => k,
                None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
            };
            match key {
                0x01 => {
                    client_data_hash = p.read_bytes();
                    if client_data_hash.is_none() {
                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                    }
                }
                0x02 => {
                    let rp_map_len = match p.read_map_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..rp_map_len {
                        let field = p.read_text();
                        match field {
                            Some("id") => {
                                rp_id = p.read_text();
                                if rp_id.is_none() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                            _ => {
                                if !p.skip_value() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                        }
                    }
                }
                0x03 => {
                    let user_map_len = match p.read_map_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..user_map_len {
                        let field = p.read_text();
                        match field {
                            Some("id") => {
                                user_id = p.read_bytes();
                                if user_id.is_none() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                            _ => {
                                if !p.skip_value() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                        }
                    }
                }
                0x04 => {
                    let arr_len = match p.read_array_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..arr_len {
                        let entry_map_len = match p.read_map_len() {
                            Some(l) => l,
                            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                        };
                        let mut alg: Option<i32> = None;
                        for _ in 0..entry_map_len {
                            let k = p.read_text();
                            match k {
                                Some("alg") => {
                                    alg = p.read_int();
                                }
                                _ => {
                                    if !p.skip_value() {
                                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                    }
                                }
                            }
                        }
                        if alg == Some(-7) {
                            has_es256 = true;
                        }
                    }
                }
                0x05 => {
                    let arr_len = match p.read_array_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..arr_len {
                        let desc_map_len = match p.read_map_len() {
                            Some(l) => l,
                            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                        };
                        let mut cred_id_bytes: Option<&[u8]> = None;
                        for _ in 0..desc_map_len {
                            let k = p.read_text();
                            match k {
                                Some("id") => {
                                    cred_id_bytes = p.read_bytes();
                                }
                                _ => {
                                    if !p.skip_value() {
                                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                    }
                                }
                            }
                        }
                        if let Some(id) = cred_id_bytes {
                            exclude_list.push(id).ok();
                        }
                    }
                }
                0x06 => {
                    let ext_map_len = match p.read_map_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..ext_map_len {
                        let field = p.read_text();
                        match field {
                            Some("hmac-secret") => {
                                if let Some(0xF5) = p.read_u8() {
                                    hmac_secret_requested = true;
                                }
                            }
                            Some("credProtect") => {
                                if let Some(v) = p.read_int() {
                                    cred_protect_level = Some(v as u8);
                                }
                            }
                            _ => {
                                if !p.skip_value() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                        }
                    }
                }
                0x07 => {
                    let opts_map_len = match p.read_map_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..opts_map_len {
                        let field = p.read_text();
                        match field {
                            Some("rk") => match p.read_u8() {
                                Some(0xF5) => rk_requested = true,
                                Some(0xF4) => {}
                                _ => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                            },
                            _ => {
                                if !p.skip_value() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                        }
                    }
                }
                0x08 => {
                    pin_uv_auth_param = p.read_bytes();
                }
                0x09 => {
                    pin_uv_auth_protocol = p.read_int();
                }
                _ => {
                    if !p.skip_value() {
                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                    }
                }
            }
        }

        let client_data_hash = match client_data_hash {
            Some(h) if h.len() == 32 => h,
            Some(_) => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
            None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };
        let rp_id = match rp_id {
            Some(id) => id,
            None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };
        if !has_es256 {
            return Self::error_response(CTAP2_ERR_UNSUPPORTED_ALGORITHM);
        }

        let rp_id_hash = crypto::sha256(rp_id.as_bytes());
        let rp_id_hash_typed = RpIdHash(rp_id_hash);

        for &id_bytes in exclude_list.iter() {
            let mut raw: Vec<u8, 128> = Vec::new();
            if raw.extend_from_slice(id_bytes).is_err() {
                continue;
            }
            let cred_id = CredentialId(raw);
            if storage::unwrap_credential(&cred_id, &rp_id_hash_typed, &self.master_secret).is_ok()
            {
                return Self::error_response(CTAP2_ERR_CREDENTIAL_EXCLUDED);
            }
        }

        let mut flags: u8 = 0x41;
        if let Some(auth_param) = pin_uv_auth_param {
            if pin_uv_auth_protocol != Some(1) {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }
            if auth_param.len() < 16 {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }
            let mac = crypto::hmac_sha256(&self.pin_token, client_data_hash);
            if !crypto::ct_eq(&mac[..16], auth_param) {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }
            flags |= 0x04;
        } else if storage::is_pin_set(self.storage).unwrap_or(false) {
            return Self::error_response(CTAP2_ERR_PIN_REQUIRED);
        }

        match self.user_presence.wait(USER_PRESENCE_TIMEOUT_MS).await {
            UserPresenceResult::Confirmed => {}
            UserPresenceResult::TimedOut => {
                return Self::error_response(CTAP2_ERR_USER_ACTION_TIMEOUT)
            }
            UserPresenceResult::Cancelled => {
                return Self::error_response(CTAP2_ERR_KEEPALIVE_CANCEL)
            }
        }

        let (priv_bytes, verifying_key) = crypto::generate_keypair(self.rng);
        Timer::after(Duration::from_millis(1)).await;

        let signing_key = match SigningKey::from_bytes(FieldBytes::from_slice(priv_bytes.as_ref()))
        {
            Ok(sk) => sk,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        let cred_id = match storage::wrap_credential(
            &signing_key,
            &rp_id_hash_typed,
            &self.master_secret,
            self.rng,
        ) {
            Ok(id) => id,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };
        Timer::after(Duration::from_millis(1)).await;

        if rk_requested {
            let uid = user_id.unwrap_or(&[]);
            if storage::store_resident_key(
                self.storage,
                &rp_id_hash_typed,
                &cred_id,
                uid,
                cred_protect_level.unwrap_or(0x01),
                rp_id.as_bytes(),
            )
            .is_err()
            {
                return Self::error_response(CTAP2_ERR_PROCESSING);
            }
        }

        let sign_count = match storage::increment_counter(self.storage) {
            Ok(c) => c,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        let cose_key = crypto::encode_cose_pubkey(&verifying_key);

        let mut ext_count = 0u8;
        if hmac_secret_requested {
            ext_count += 1;
            flags |= 0x80;
        }
        if cred_protect_level.is_some() {
            ext_count += 1;
            flags |= 0x80;
        }

        let mut auth_data = build_auth_data_make(
            &rp_id_hash,
            flags,
            sign_count,
            &cred_id.0,
            cose_key.as_ref(),
        );

        if ext_count > 0 {
            auth_data.push(0xA0 | ext_count).ok();
            if let Some(level) = cred_protect_level {
                auth_data.push(0x6B).ok();
                auth_data.extend_from_slice(b"credProtect").ok();
                auth_data.push(level).ok();
            }
            if hmac_secret_requested {
                auth_data.push(0x6B).ok();
                auth_data.extend_from_slice(b"hmac-secret").ok();
                auth_data.push(0xF5).ok();
            }
        }

        let mut sig_input: Vec<u8, 512> = Vec::new();
        sig_input.extend_from_slice(&auth_data).ok();
        sig_input.extend_from_slice(client_data_hash).ok();

        let sig = match crypto::sign(&priv_bytes, &sig_input) {
            Ok(s) => s,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };
        Timer::after(Duration::from_millis(1)).await;

        let mut att_stmt = CborWriter::new();
        att_stmt.map(2);
        att_stmt.text("alg");
        att_stmt.negative(-7);
        att_stmt.text("sig");
        att_stmt.bytes(&sig);
        let att_stmt_bytes = att_stmt.into_vec();

        let mut att_obj = CborWriter::new();
        att_obj.map(3);
        att_obj.unsigned(0x01);
        att_obj.text("packed");
        att_obj.unsigned(0x02);
        att_obj.bytes(&auth_data);
        att_obj.unsigned(0x03);
        att_obj.raw(&att_stmt_bytes);
        let att_cbor = att_obj.into_vec();

        let mut resp: Vec<u8, 512> = Vec::new();
        resp.push(CTAP2_OK).ok();
        resp.extend_from_slice(&att_cbor).ok();
        resp
    }

    async fn cmd_get_assertion(&mut self, data: &[u8]) -> Vec<u8, 512> {
        let mut p = CborParser::new(data);

        let map_len = match p.read_map_len() {
            Some(l) => l,
            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
        };

        let mut rp_id: Option<&str> = None;
        let mut client_data_hash: Option<&[u8]> = None;
        let mut allow_list: Vec<&[u8], 8> = Vec::new();
        let mut hs_key_x: Option<[u8; 32]> = None;
        let mut hs_key_y: Option<[u8; 32]> = None;
        let mut hs_salt_enc: Option<&[u8]> = None;
        let mut hs_salt_auth: Option<&[u8]> = None;
        let mut pin_uv_auth_param: Option<&[u8]> = None;
        let mut pin_uv_auth_protocol: Option<i32> = None;

        for _ in 0..map_len {
            let key = match p.read_int() {
                Some(k) => k,
                None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
            };
            match key {
                0x01 => {
                    rp_id = p.read_text();
                    if rp_id.is_none() {
                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                    }
                }
                0x02 => {
                    client_data_hash = p.read_bytes();
                    if client_data_hash.is_none() {
                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                    }
                }
                0x03 => {
                    let arr_len = match p.read_array_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..arr_len {
                        let desc_map_len = match p.read_map_len() {
                            Some(l) => l,
                            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                        };
                        let mut cred_id_bytes: Option<&[u8]> = None;
                        for _ in 0..desc_map_len {
                            let k = p.read_text();
                            match k {
                                Some("id") => {
                                    cred_id_bytes = p.read_bytes();
                                }
                                _ => {
                                    if !p.skip_value() {
                                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                    }
                                }
                            }
                        }
                        if let Some(id) = cred_id_bytes {
                            allow_list.push(id).ok();
                        }
                    }
                }
                0x04 => {
                    let ext_map_len = match p.read_map_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..ext_map_len {
                        let field = p.read_text();
                        match field {
                            Some("hmac-secret") => {
                                let hs_map_len = match p.read_map_len() {
                                    Some(l) => l,
                                    None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                                };
                                for _ in 0..hs_map_len {
                                    let hs_key = match p.read_int() {
                                        Some(k) => k,
                                        None => {
                                            return Self::error_response(CTAP2_ERR_INVALID_CBOR)
                                        }
                                    };
                                    match hs_key {
                                        0x01 => {
                                            let ka_map_len = match p.read_map_len() {
                                                Some(l) => l,
                                                None => {
                                                    return Self::error_response(
                                                        CTAP2_ERR_INVALID_CBOR,
                                                    )
                                                }
                                            };
                                            for _ in 0..ka_map_len {
                                                let k = match p.read_int() {
                                                    Some(k) => k,
                                                    None => {
                                                        return Self::error_response(
                                                            CTAP2_ERR_INVALID_CBOR,
                                                        )
                                                    }
                                                };
                                                match k {
                                                    -2 => {
                                                        if let Some(bytes) = p.read_bytes() {
                                                            if bytes.len() == 32 {
                                                                let mut x = [0u8; 32];
                                                                x.copy_from_slice(bytes);
                                                                hs_key_x = Some(x);
                                                            }
                                                        }
                                                    }
                                                    -3 => {
                                                        if let Some(bytes) = p.read_bytes() {
                                                            if bytes.len() == 32 {
                                                                let mut y = [0u8; 32];
                                                                y.copy_from_slice(bytes);
                                                                hs_key_y = Some(y);
                                                            }
                                                        }
                                                    }
                                                    _ => {
                                                        if !p.skip_value() {
                                                            return Self::error_response(
                                                                CTAP2_ERR_INVALID_CBOR,
                                                            );
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        0x02 => {
                                            hs_salt_enc = p.read_bytes();
                                        }
                                        0x03 => {
                                            hs_salt_auth = p.read_bytes();
                                        }
                                        _ => {
                                            if !p.skip_value() {
                                                return Self::error_response(
                                                    CTAP2_ERR_INVALID_CBOR,
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                            _ => {
                                if !p.skip_value() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                        }
                    }
                }
                0x05 => {
                    let opts_map_len = match p.read_map_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..opts_map_len {
                        if !p.skip_value() || !p.skip_value() {
                            return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                        }
                    }
                }
                0x06 => {
                    pin_uv_auth_param = p.read_bytes();
                }
                0x07 => {
                    pin_uv_auth_protocol = p.read_int();
                }
                _ => {
                    if !p.skip_value() {
                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                    }
                }
            }
        }

        let rp_id = match rp_id {
            Some(id) => id,
            None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };
        let client_data_hash = match client_data_hash {
            Some(h) if h.len() == 32 => h,
            Some(_) => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
            None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };

        let rp_id_hash = crypto::sha256(rp_id.as_bytes());
        let rp_id_hash_typed = RpIdHash(rp_id_hash);

        let mut rk_cred_id: Option<CredentialId> = None;
        let mut rk_user_id: Option<heapless::Vec<u8, 64>> = None;
        let mut found_cred: Option<Credential> = None;
        let mut matched_id_ref: Option<&[u8]> = None;

        let uv_performed = pin_uv_auth_param.is_some();

        if !allow_list.is_empty() {
            for &id_bytes in allow_list.iter() {
                let mut raw: Vec<u8, 128> = Vec::new();
                if raw.extend_from_slice(id_bytes).is_err() {
                    continue;
                }
                let cred_id = CredentialId(raw);
                if let Ok(cred) =
                    storage::unwrap_credential(&cred_id, &rp_id_hash_typed, &self.master_secret)
                {
                    found_cred = Some(cred);
                    matched_id_ref = Some(id_bytes);
                    break;
                }
            }
            if found_cred.is_some() && !uv_performed {
                if let Ok(Some((_, _, cp, _))) =
                    storage::find_resident_key(self.storage, &rp_id_hash_typed)
                {
                    if cp >= 3 {
                        return Self::error_response(CTAP2_ERR_NO_CREDENTIALS);
                    }
                }
            }
        } else {
            match storage::find_resident_key(self.storage, &rp_id_hash_typed) {
                Ok(Some((cid, uid, cred_protect, _rp_id))) => {
                    if !uv_performed && cred_protect >= 2 {
                        return Self::error_response(CTAP2_ERR_NO_CREDENTIALS);
                    }
                    match storage::unwrap_credential(&cid, &rp_id_hash_typed, &self.master_secret) {
                        Ok(cred) => {
                            found_cred = Some(cred);
                            rk_user_id = Some(uid);
                            rk_cred_id = Some(cid);
                        }
                        Err(_) => return Self::error_response(CTAP2_ERR_NO_CREDENTIALS),
                    }
                }
                Ok(None) => return Self::error_response(CTAP2_ERR_NO_CREDENTIALS),
                Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
            }
        }

        let cred = match found_cred {
            Some(c) => c,
            None => return Self::error_response(CTAP2_ERR_NO_CREDENTIALS),
        };

        let mut flags: u8 = 0x01;
        if let Some(auth_param) = pin_uv_auth_param {
            if pin_uv_auth_protocol != Some(1) {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }
            if auth_param.len() < 16 {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }
            let mac = crypto::hmac_sha256(&self.pin_token, client_data_hash);
            if !crypto::ct_eq(&mac[..16], auth_param) {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }
            flags |= 0x04;
        } else if storage::is_pin_set(self.storage).unwrap_or(false) {
            return Self::error_response(CTAP2_ERR_PIN_REQUIRED);
        }

        match self.user_presence.wait(USER_PRESENCE_TIMEOUT_MS).await {
            UserPresenceResult::Confirmed => {}
            UserPresenceResult::TimedOut => {
                return Self::error_response(CTAP2_ERR_USER_ACTION_TIMEOUT)
            }
            UserPresenceResult::Cancelled => {
                return Self::error_response(CTAP2_ERR_KEEPALIVE_CANCEL)
            }
        }

        let sign_count = match storage::increment_counter(self.storage) {
            Ok(c) => c,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        let mut hs_output: Option<Vec<u8, 64>> = None;
        if let (Some(hx), Some(hy)) = (hs_key_x, hs_key_y) {
            let salt_enc = match hs_salt_enc {
                Some(s) if s.len() == 32 || s.len() == 64 => s,
                _ => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
            };
            let salt_auth = match hs_salt_auth {
                Some(a) if a.len() >= 16 => a,
                _ => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
            };

            let shared_secret = match crypto::ecdh_shared_secret(&self.pin_key_priv, &hx, &hy) {
                Ok(s) => s,
                Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
            };

            let mac = crypto::hmac_sha256(shared_secret.as_slice(), salt_enc);
            if !crypto::ct_eq(&mac[..16], salt_auth) {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }

            let iv = [0u8; 16];
            let decrypted = match crypto::aes256_cbc_decrypt_raw(&shared_secret, &iv, salt_enc) {
                Ok(d) => d,
                Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
            };

            let hmac_key = crypto::hmac_sha256(cred.private_key.as_slice(), b"hmac-secret");
            let mut output: Vec<u8, 64> = Vec::new();
            let out1 = crypto::hmac_sha256(&hmac_key, &decrypted[..32]);
            output.extend_from_slice(&out1).ok();
            if decrypted.len() == 64 {
                let out2 = crypto::hmac_sha256(&hmac_key, &decrypted[32..64]);
                output.extend_from_slice(&out2).ok();
            }

            let enc_output = match crypto::aes256_cbc_encrypt_raw(&shared_secret, &iv, &output) {
                Ok(e) => e,
                Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
            };

            let mut hs_out: Vec<u8, 64> = Vec::new();
            hs_out.extend_from_slice(&enc_output[..output.len()]).ok();
            hs_output = Some(hs_out);
            flags |= 0x80;
        }

        let mut auth_data = build_auth_data_assert(&cred.rp_id_hash.0, flags, sign_count);

        if let Some(ref hs_out) = hs_output {
            auth_data.push(0xA1).ok();
            auth_data.push(0x6B).ok();
            auth_data.extend_from_slice(b"hmac-secret").ok();
            auth_data.push(0x58).ok();
            auth_data.push(hs_out.len() as u8).ok();
            auth_data.extend_from_slice(hs_out).ok();
        }

        let mut sig_input: Vec<u8, 256> = Vec::new();
        sig_input.extend_from_slice(&auth_data).ok();
        sig_input.extend_from_slice(client_data_hash).ok();

        let sig = match crypto::sign(&cred.private_key, &sig_input) {
            Ok(s) => s,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };
        Timer::after(Duration::from_millis(1)).await;

        let has_user = rk_user_id.is_some();
        let resp_map_size = if has_user { 4 } else { 3 };

        let cred_id_bytes: &[u8] = if let Some(ref id) = rk_cred_id {
            &id.0
        } else {
            matched_id_ref.unwrap_or(&[])
        };

        let mut w = CborWriter::new();
        w.map(resp_map_size);

        w.unsigned(0x01);
        w.map(2);
        w.text("id");
        w.bytes(cred_id_bytes);
        w.text("type");
        w.text("public-key");

        w.unsigned(0x02);
        w.bytes(&auth_data);

        w.unsigned(0x03);
        w.bytes(&sig);

        if let Some(ref uid) = rk_user_id {
            w.unsigned(0x04);
            w.map(1);
            w.text("id");
            w.bytes(uid);
        }

        let cbor = w.into_vec();
        let mut resp: Vec<u8, 512> = Vec::new();
        resp.push(CTAP2_OK).ok();
        resp.extend_from_slice(&cbor).ok();
        resp
    }

    async fn cmd_reset(&mut self) -> Vec<u8, 512> {
        if Instant::now() - self.boot_time > Duration::from_secs(10) {
            return Self::error_response(CTAP2_ERR_NOT_ALLOWED);
        }
        match self.user_presence.wait(USER_PRESENCE_TIMEOUT_MS).await {
            UserPresenceResult::Confirmed => {}
            UserPresenceResult::TimedOut => {
                return Self::error_response(CTAP2_ERR_USER_ACTION_TIMEOUT)
            }
            UserPresenceResult::Cancelled => {
                return Self::error_response(CTAP2_ERR_KEEPALIVE_CANCEL)
            }
        }

        match storage::reset_master_secret(self.storage, self.rng) {
            Ok(new_secret) => self.master_secret = new_secret,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        }
        storage::clear_resident_keys(self.storage).ok();

        Self::error_response(CTAP2_OK)
    }

    async fn cmd_client_pin(&mut self, data: &[u8]) -> Vec<u8, 512> {
        let mut p = CborParser::new(data);

        let map_len = match p.read_map_len() {
            Some(l) => l,
            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
        };

        let mut pin_protocol: Option<i32> = None;
        let mut sub_command: Option<i32> = None;
        let mut key_agreement_x: Option<[u8; 32]> = None;
        let mut key_agreement_y: Option<[u8; 32]> = None;
        let mut pin_uv_auth_param: Option<&[u8]> = None;
        let mut new_pin_enc: Option<&[u8]> = None;
        let mut pin_hash_enc: Option<&[u8]> = None;

        for _ in 0..map_len {
            let key = match p.read_int() {
                Some(k) => k,
                None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
            };
            match key {
                0x01 => {
                    pin_protocol = p.read_int();
                }
                0x02 => {
                    sub_command = p.read_int();
                }
                0x03 => {
                    let ka_map_len = match p.read_map_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..ka_map_len {
                        let k = match p.read_int() {
                            Some(k) => k,
                            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                        };
                        match k {
                            -2 => {
                                if let Some(bytes) = p.read_bytes() {
                                    if bytes.len() == 32 {
                                        let mut x = [0u8; 32];
                                        x.copy_from_slice(bytes);
                                        key_agreement_x = Some(x);
                                    }
                                }
                            }
                            -3 => {
                                if let Some(bytes) = p.read_bytes() {
                                    if bytes.len() == 32 {
                                        let mut y = [0u8; 32];
                                        y.copy_from_slice(bytes);
                                        key_agreement_y = Some(y);
                                    }
                                }
                            }
                            _ => {
                                if !p.skip_value() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                        }
                    }
                }
                0x04 => {
                    pin_uv_auth_param = p.read_bytes();
                }
                0x05 => {
                    new_pin_enc = p.read_bytes();
                }
                0x06 => {
                    pin_hash_enc = p.read_bytes();
                }
                _ => {
                    if !p.skip_value() {
                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                    }
                }
            }
        }

        let sub_cmd = match sub_command {
            Some(c) => c,
            None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };

        defmt::debug!("clientPIN subCmd={}", sub_cmd);

        match sub_cmd {
            0x01 => self.pin_get_retries(),
            0x02 => self.pin_get_key_agreement(),
            0x03..=0x05 => {
                if pin_protocol != Some(1) {
                    return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
                }
                let (peer_x, peer_y) = match (key_agreement_x, key_agreement_y) {
                    (Some(x), Some(y)) => (x, y),
                    _ => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
                };
                let shared_secret =
                    match crypto::ecdh_shared_secret(&self.pin_key_priv, &peer_x, &peer_y) {
                        Ok(s) => s,
                        Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
                    };
                Timer::after(Duration::from_millis(1)).await;
                match sub_cmd {
                    0x03 => self.pin_set_pin(&shared_secret, pin_uv_auth_param, new_pin_enc),
                    0x04 => self.pin_change_pin(
                        &shared_secret,
                        pin_uv_auth_param,
                        new_pin_enc,
                        pin_hash_enc,
                    ),
                    0x05 => self.pin_get_pin_token(&shared_secret, pin_hash_enc),
                    _ => unreachable!(),
                }
            }
            _ => Self::error_response(ERR_INVALID_CMD),
        }
    }

    fn pin_get_retries(&self) -> Vec<u8, 512> {
        let retries = match storage::get_pin_retries(self.storage) {
            Ok(r) => r,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };
        let mut w = CborWriter::new();
        w.map(1);
        w.unsigned(0x03);
        w.unsigned(retries as u64);
        let cbor = w.into_vec();
        let mut resp: Vec<u8, 512> = Vec::new();
        resp.push(CTAP2_OK).ok();
        resp.extend_from_slice(&cbor).ok();
        resp
    }

    fn pin_get_key_agreement(&self) -> Vec<u8, 512> {
        let cose = crypto::encode_cose_key_agreement(&self.pin_key_pub);
        let mut w = CborWriter::new();
        w.map(1);
        w.unsigned(0x01);
        w.raw(&cose);
        let cbor = w.into_vec();
        let mut resp: Vec<u8, 512> = Vec::new();
        resp.push(CTAP2_OK).ok();
        resp.extend_from_slice(&cbor).ok();
        resp
    }

    fn pin_set_pin(
        &mut self,
        shared_secret: &[u8; 32],
        pin_auth: Option<&[u8]>,
        new_pin_enc: Option<&[u8]>,
    ) -> Vec<u8, 512> {
        match storage::is_pin_set(self.storage) {
            Ok(true) => return Self::error_response(CTAP2_ERR_NOT_ALLOWED),
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
            _ => {}
        }

        let pin_auth = match pin_auth {
            Some(a) if a.len() >= 16 => a,
            _ => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };
        let new_pin_enc = match new_pin_enc {
            Some(e) => e,
            None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };

        let mac = crypto::hmac_sha256(shared_secret, new_pin_enc);
        if !crypto::ct_eq(&mac[..16], pin_auth) {
            return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
        }

        let iv = [0u8; 16];
        let decrypted = match crypto::aes256_cbc_decrypt_raw(shared_secret, &iv, new_pin_enc) {
            Ok(d) => d,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        let pin_len = decrypted
            .iter()
            .rposition(|&b| b != 0x00)
            .map(|i| i + 1)
            .unwrap_or(0);
        if !(4..=63).contains(&pin_len) {
            return Self::error_response(CTAP2_ERR_PIN_POLICY_VIOLATION);
        }

        let pin_hash_full = crypto::sha256(&decrypted[..pin_len]);
        let mut pin_hash = [0u8; 16];
        pin_hash.copy_from_slice(&pin_hash_full[..16]);

        if storage::store_pin_and_reset_retries(self.storage, &pin_hash).is_err() {
            return Self::error_response(CTAP2_ERR_PROCESSING);
        }

        Self::error_response(CTAP2_OK)
    }

    fn pin_change_pin(
        &mut self,
        shared_secret: &[u8; 32],
        pin_auth: Option<&[u8]>,
        new_pin_enc: Option<&[u8]>,
        pin_hash_enc: Option<&[u8]>,
    ) -> Vec<u8, 512> {
        match storage::is_pin_set(self.storage) {
            Ok(false) => return Self::error_response(CTAP2_ERR_PIN_NOT_SET),
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
            _ => {}
        }

        let pin_auth = match pin_auth {
            Some(a) if a.len() >= 16 => a,
            _ => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };
        let new_pin_enc = match new_pin_enc {
            Some(e) => e,
            None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };
        let pin_hash_enc = match pin_hash_enc {
            Some(e) if e.len() == 16 => e,
            _ => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };

        let mut concat = [0u8; 128];
        let total = new_pin_enc.len() + pin_hash_enc.len();
        if total > 128 {
            return Self::error_response(CTAP2_ERR_PROCESSING);
        }
        concat[..new_pin_enc.len()].copy_from_slice(new_pin_enc);
        concat[new_pin_enc.len()..total].copy_from_slice(pin_hash_enc);
        let mac = crypto::hmac_sha256(shared_secret, &concat[..total]);
        if !crypto::ct_eq(&mac[..16], pin_auth) {
            return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
        }

        let retries = match storage::decrement_pin_retries(self.storage) {
            Ok(r) => r,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };
        if retries == 0 {
            return Self::error_response(CTAP2_ERR_PIN_BLOCKED);
        }

        let iv = [0u8; 16];
        let decrypted_hash = match crypto::aes256_cbc_decrypt_raw(shared_secret, &iv, pin_hash_enc)
        {
            Ok(d) => d,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        let stored_hash = match storage::read_pin_hash(self.storage) {
            Ok(h) => h,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        if !crypto::ct_eq(&decrypted_hash[..16], &stored_hash) {
            return Self::error_response(CTAP2_ERR_PIN_INVALID);
        }

        let decrypted_pin = match crypto::aes256_cbc_decrypt_raw(shared_secret, &iv, new_pin_enc) {
            Ok(d) => d,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        let pin_len = decrypted_pin
            .iter()
            .rposition(|&b| b != 0x00)
            .map(|i| i + 1)
            .unwrap_or(0);
        if !(4..=63).contains(&pin_len) {
            return Self::error_response(CTAP2_ERR_PIN_POLICY_VIOLATION);
        }

        let pin_hash_full = crypto::sha256(&decrypted_pin[..pin_len]);
        let mut new_hash = [0u8; 16];
        new_hash.copy_from_slice(&pin_hash_full[..16]);

        if storage::store_pin_and_reset_retries(self.storage, &new_hash).is_err() {
            return Self::error_response(CTAP2_ERR_PROCESSING);
        }

        Self::error_response(CTAP2_OK)
    }

    fn pin_get_pin_token(
        &mut self,
        shared_secret: &[u8; 32],
        pin_hash_enc: Option<&[u8]>,
    ) -> Vec<u8, 512> {
        match storage::is_pin_set(self.storage) {
            Ok(false) => return Self::error_response(CTAP2_ERR_PIN_NOT_SET),
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
            _ => {}
        }

        let pin_hash_enc = match pin_hash_enc {
            Some(e) if e.len() == 16 => e,
            _ => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };

        let retries = match storage::decrement_pin_retries(self.storage) {
            Ok(r) => r,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };
        if retries == 0 {
            return Self::error_response(CTAP2_ERR_PIN_BLOCKED);
        }

        let iv = [0u8; 16];
        let decrypted_hash = match crypto::aes256_cbc_decrypt_raw(shared_secret, &iv, pin_hash_enc)
        {
            Ok(d) => d,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        let stored_hash = match storage::read_pin_hash(self.storage) {
            Ok(h) => h,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        if !crypto::ct_eq(&decrypted_hash[..16], &stored_hash) {
            return Self::error_response(CTAP2_ERR_PIN_INVALID);
        }

        if storage::reset_pin_retries(self.storage).is_err() {
            return Self::error_response(CTAP2_ERR_PROCESSING);
        }

        let enc_token = match crypto::aes256_cbc_encrypt_raw(shared_secret, &iv, &self.pin_token) {
            Ok(e) => e,
            Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
        };

        let mut w = CborWriter::new();
        w.map(1);
        w.unsigned(0x02);
        w.bytes(&enc_token);
        let cbor = w.into_vec();
        let mut resp: Vec<u8, 512> = Vec::new();
        resp.push(CTAP2_OK).ok();
        resp.extend_from_slice(&cbor).ok();
        resp
    }

    async fn cmd_credential_management(&mut self, data: &[u8]) -> Vec<u8, 512> {
        let mut p = CborParser::new(data);

        let map_len = match p.read_map_len() {
            Some(l) => l,
            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
        };

        let mut sub_command: Option<i32> = None;
        let mut sub_command_params_rp_id_hash: Option<[u8; 32]> = None;
        let mut sub_command_params_cred_id: Option<&[u8]> = None;
        let mut pin_uv_auth_protocol: Option<i32> = None;
        let mut pin_uv_auth_param: Option<&[u8]> = None;

        for _ in 0..map_len {
            let key = match p.read_int() {
                Some(k) => k,
                None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
            };
            match key {
                0x01 => {
                    sub_command = p.read_int();
                }
                0x02 => {
                    let params_map_len = match p.read_map_len() {
                        Some(l) => l,
                        None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                    };
                    for _ in 0..params_map_len {
                        let pk = match p.read_int() {
                            Some(k) => k,
                            None => return Self::error_response(CTAP2_ERR_INVALID_CBOR),
                        };
                        match pk {
                            0x01 => {
                                let next = p.peek_u8().unwrap_or(0);
                                let major = next >> 5;
                                if major == 2 {
                                    if let Some(bytes) = p.read_bytes() {
                                        if bytes.len() == 32 {
                                            let mut h = [0u8; 32];
                                            h.copy_from_slice(bytes);
                                            sub_command_params_rp_id_hash = Some(h);
                                        }
                                    }
                                } else if major == 5 {
                                    let desc_map_len = match p.read_map_len() {
                                        Some(l) => l,
                                        None => {
                                            return Self::error_response(CTAP2_ERR_INVALID_CBOR)
                                        }
                                    };
                                    for _ in 0..desc_map_len {
                                        let dk = p.read_text();
                                        match dk {
                                            Some("id") => {
                                                sub_command_params_cred_id = p.read_bytes();
                                            }
                                            _ => {
                                                if !p.skip_value() {
                                                    return Self::error_response(
                                                        CTAP2_ERR_INVALID_CBOR,
                                                    );
                                                }
                                            }
                                        }
                                    }
                                } else if !p.skip_value() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                            _ => {
                                if !p.skip_value() {
                                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                                }
                            }
                        }
                    }
                }
                0x03 => {
                    pin_uv_auth_protocol = p.read_int();
                }
                0x04 => {
                    pin_uv_auth_param = p.read_bytes();
                }
                _ => {
                    if !p.skip_value() {
                        return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                    }
                }
            }
        }

        let sub_cmd = match sub_command {
            Some(c) => c,
            None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
        };

        let needs_pin_auth = matches!(sub_cmd, 0x02 | 0x04 | 0x06);
        if needs_pin_auth {
            if pin_uv_auth_protocol != Some(1) {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }
            let auth_param = match pin_uv_auth_param {
                Some(a) if a.len() >= 16 => a,
                _ => return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID),
            };
            let all_zero = self.pin_token.iter().all(|&b| b == 0);
            if all_zero {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }
            let mut auth_data: Vec<u8, 256> = Vec::new();
            auth_data.push(sub_cmd as u8).ok();
            if sub_cmd == 0x04 {
                if let Some(ref h) = sub_command_params_rp_id_hash {
                    let mut sw = CborWriter::new();
                    sw.map(1);
                    sw.unsigned(0x01);
                    sw.bytes(h);
                    let serialized = sw.into_vec();
                    auth_data.extend_from_slice(&serialized).ok();
                }
            }
            if sub_cmd == 0x06 {
                if let Some(cid_bytes) = sub_command_params_cred_id {
                    let mut sw = CborWriter::new();
                    sw.map(1);
                    sw.unsigned(0x01);
                    sw.map(2);
                    sw.text("id");
                    sw.bytes(cid_bytes);
                    sw.text("type");
                    sw.text("public-key");
                    let serialized = sw.into_vec();
                    auth_data.extend_from_slice(&serialized).ok();
                }
            }
            let expected = crypto::hmac_sha256(&self.pin_token, &auth_data);
            if !crypto::ct_eq(&expected[..16], auth_param) {
                return Self::error_response(CTAP2_ERR_PIN_AUTH_INVALID);
            }
        }

        match sub_cmd {
            0x02 => {
                self.rp_list = match storage::list_resident_rps(self.storage) {
                    Ok(l) => l,
                    Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
                };
                if self.rp_list.is_empty() {
                    return Self::error_response(CTAP2_ERR_NO_CREDENTIALS);
                }
                self.rp_index = 1;
                let total = self.rp_list.len();
                let (ref rp_hash, ref rp_id) = self.rp_list[0];

                let mut w = CborWriter::new();
                w.map(3);
                w.unsigned(0x03);
                w.map(1);
                w.text("id");
                if let Ok(s) = core::str::from_utf8(rp_id) {
                    w.text(s);
                } else {
                    w.bytes(rp_id);
                }
                w.unsigned(0x04);
                w.bytes(&rp_hash.0);
                w.unsigned(0x05);
                w.unsigned(total as u64);

                let cbor = w.into_vec();
                let mut resp: Vec<u8, 512> = Vec::new();
                resp.push(CTAP2_OK).ok();
                resp.extend_from_slice(&cbor).ok();
                resp
            }
            0x03 => {
                if self.rp_index >= self.rp_list.len() {
                    return Self::error_response(CTAP2_ERR_NO_CREDENTIALS);
                }
                let (ref rp_hash, ref rp_id) = self.rp_list[self.rp_index];
                self.rp_index += 1;

                let mut w = CborWriter::new();
                w.map(2);
                w.unsigned(0x03);
                w.map(1);
                w.text("id");
                if let Ok(s) = core::str::from_utf8(rp_id) {
                    w.text(s);
                } else {
                    w.bytes(rp_id);
                }
                w.unsigned(0x04);
                w.bytes(&rp_hash.0);

                let cbor = w.into_vec();
                let mut resp: Vec<u8, 512> = Vec::new();
                resp.push(CTAP2_OK).ok();
                resp.extend_from_slice(&cbor).ok();
                resp
            }
            0x04 => {
                let rp_id_hash = match sub_command_params_rp_id_hash {
                    Some(h) => RpIdHash(h),
                    None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
                };
                self.cred_list = match storage::list_credentials_for_rp(self.storage, &rp_id_hash) {
                    Ok(l) => l,
                    Err(_) => return Self::error_response(CTAP2_ERR_PROCESSING),
                };
                if self.cred_list.is_empty() {
                    return Self::error_response(CTAP2_ERR_NO_CREDENTIALS);
                }
                self.cred_index = 1;
                let total = self.cred_list.len();
                let (ref cred_id, ref user_id, cred_protect) = self.cred_list[0];

                let map_size = if cred_protect > 1 { 4 } else { 3 };
                let mut w = CborWriter::new();
                w.map(map_size);
                w.unsigned(0x06);
                w.map(1);
                w.text("id");
                w.bytes(user_id);
                w.unsigned(0x07);
                w.map(2);
                w.text("id");
                w.bytes(&cred_id.0);
                w.text("type");
                w.text("public-key");
                w.unsigned(0x09);
                w.unsigned(total as u64);
                if cred_protect > 1 {
                    w.unsigned(0x0A);
                    w.unsigned(cred_protect as u64);
                }

                let cbor = w.into_vec();
                let mut resp: Vec<u8, 512> = Vec::new();
                resp.push(CTAP2_OK).ok();
                resp.extend_from_slice(&cbor).ok();
                resp
            }
            0x05 => {
                if self.cred_index >= self.cred_list.len() {
                    return Self::error_response(CTAP2_ERR_NO_CREDENTIALS);
                }
                let (ref cred_id, ref user_id, cred_protect) = self.cred_list[self.cred_index];
                self.cred_index += 1;

                let map_size = if cred_protect > 1 { 3 } else { 2 };
                let mut w = CborWriter::new();
                w.map(map_size);
                w.unsigned(0x06);
                w.map(1);
                w.text("id");
                w.bytes(user_id);
                w.unsigned(0x07);
                w.map(2);
                w.text("id");
                w.bytes(&cred_id.0);
                w.text("type");
                w.text("public-key");
                if cred_protect > 1 {
                    w.unsigned(0x0A);
                    w.unsigned(cred_protect as u64);
                }

                let cbor = w.into_vec();
                let mut resp: Vec<u8, 512> = Vec::new();
                resp.push(CTAP2_OK).ok();
                resp.extend_from_slice(&cbor).ok();
                resp
            }
            0x06 => {
                let cred_id_bytes = match sub_command_params_cred_id {
                    Some(b) => b,
                    None => return Self::error_response(CTAP2_ERR_MISSING_PARAMETER),
                };
                let mut raw: heapless::Vec<u8, 128> = heapless::Vec::new();
                if raw.extend_from_slice(cred_id_bytes).is_err() {
                    return Self::error_response(CTAP2_ERR_INVALID_CBOR);
                }
                let cred_id = CredentialId(raw);
                match storage::delete_resident_key_by_cred_id(self.storage, &cred_id) {
                    Ok(true) => Self::error_response(CTAP2_OK),
                    Ok(false) => Self::error_response(CTAP2_ERR_NO_CREDENTIALS),
                    Err(_) => Self::error_response(CTAP2_ERR_PROCESSING),
                }
            }
            _ => Self::error_response(CTAP2_ERR_INVALID_CBOR),
        }
    }

    async fn u2f_register(&mut self, data: &[u8]) -> Vec<u8, 512> {
        if data.len() != 64 {
            return Self::sw_response(U2F_SW_WRONG_LENGTH);
        }
        let challenge = &data[..32];
        let app_param = &data[32..64];

        match self.user_presence.wait(USER_PRESENCE_TIMEOUT_MS).await {
            UserPresenceResult::Confirmed => {}
            UserPresenceResult::TimedOut => {
                return Self::sw_response(U2F_SW_CONDITIONS_NOT_SATISFIED)
            }
            UserPresenceResult::Cancelled => {
                return Self::sw_response(U2F_SW_CONDITIONS_NOT_SATISFIED)
            }
        }

        let (priv_bytes, verifying_key) = crypto::generate_keypair(self.rng);

        let signing_key = match SigningKey::from_bytes(FieldBytes::from_slice(priv_bytes.as_ref()))
        {
            Ok(sk) => sk,
            Err(_) => return Self::sw_response(U2F_SW_WRONG_DATA),
        };

        let rp_id_hash_typed = RpIdHash(app_param.try_into().expect("app_param is 32 bytes"));
        let cred_id = match storage::wrap_credential(
            &signing_key,
            &rp_id_hash_typed,
            &self.master_secret,
            self.rng,
        ) {
            Ok(id) => id,
            Err(_) => return Self::sw_response(U2F_SW_WRONG_DATA),
        };

        use p256::EncodedPoint;
        let point = EncodedPoint::from(&verifying_key);
        let pub_key_uncompressed: &[u8] = point.as_bytes();

        let att_signing_key = match SigningKey::from_bytes(FieldBytes::from_slice(&ATTESTATION_KEY))
        {
            Ok(sk) => sk,
            Err(_) => return Self::sw_response(U2F_SW_WRONG_DATA),
        };
        let att_compressed_point = att_signing_key.verifying_key().to_encoded_point(true);
        let att_pub_compressed: &[u8] = att_compressed_point.as_bytes();

        let mut tbs: Vec<u8, 256> = Vec::new();
        tbs.extend_from_slice(&TBS_CERT_PREFIX).ok();
        tbs.extend_from_slice(att_pub_compressed).ok();

        let tbs_sig = match crypto::sign(&ATTESTATION_KEY, &tbs) {
            Ok(s) => s,
            Err(_) => return Self::sw_response(U2F_SW_WRONG_DATA),
        };

        let cert_content_len = tbs.len() + SIG_ALG_DER.len() + 2 + 1 + tbs_sig.len();
        let mut cert: Vec<u8, 256> = Vec::new();
        if cert_content_len <= 127 {
            cert.push(0x30).ok();
            cert.push(cert_content_len as u8).ok();
        } else {
            cert.push(0x30).ok();
            cert.push(0x81).ok();
            cert.push(cert_content_len as u8).ok();
        }
        cert.extend_from_slice(&tbs).ok();
        cert.extend_from_slice(&SIG_ALG_DER).ok();
        cert.push(0x03).ok();
        cert.push((1 + tbs_sig.len()) as u8).ok();
        cert.push(0x00).ok();
        cert.extend_from_slice(&tbs_sig).ok();

        let mut sig_input: Vec<u8, 512> = Vec::new();
        sig_input.push(0x00).ok();
        sig_input.extend_from_slice(app_param).ok();
        sig_input.extend_from_slice(challenge).ok();
        sig_input.extend_from_slice(&cred_id.0).ok();
        sig_input.extend_from_slice(pub_key_uncompressed).ok();

        let sig = match crypto::sign(&ATTESTATION_KEY, &sig_input) {
            Ok(s) => s,
            Err(_) => return Self::sw_response(U2F_SW_WRONG_DATA),
        };

        let mut resp: Vec<u8, 512> = Vec::new();
        resp.push(0x05).ok();
        resp.extend_from_slice(pub_key_uncompressed).ok();
        resp.push(cred_id.0.len() as u8).ok();
        resp.extend_from_slice(&cred_id.0).ok();
        resp.extend_from_slice(&cert).ok();
        resp.extend_from_slice(&sig).ok();
        resp.extend_from_slice(&U2F_SW_NO_ERROR.to_be_bytes()).ok();
        resp
    }

    async fn u2f_authenticate(&mut self, p1: u8, data: &[u8]) -> Vec<u8, 512> {
        if data.len() < 65 {
            return Self::sw_response(U2F_SW_WRONG_LENGTH);
        }
        let challenge = &data[..32];
        let app_param = &data[32..64];
        let kh_len = data[64] as usize;
        if data.len() < 65 + kh_len {
            return Self::sw_response(U2F_SW_WRONG_LENGTH);
        }
        let kh_bytes = &data[65..65 + kh_len];

        let mut raw: Vec<u8, 128> = Vec::new();
        if raw.extend_from_slice(kh_bytes).is_err() {
            return Self::sw_response(U2F_SW_WRONG_DATA);
        }
        let cred_id = CredentialId(raw);
        let rp_id_hash_typed = RpIdHash(app_param.try_into().expect("app_param is 32 bytes"));

        let cred =
            match storage::unwrap_credential(&cred_id, &rp_id_hash_typed, &self.master_secret) {
                Ok(c) => c,
                Err(_) => return Self::sw_response(U2F_SW_WRONG_DATA),
            };

        if p1 == U2F_P1_CHECK_ONLY {
            return Self::sw_response(U2F_SW_CONDITIONS_NOT_SATISFIED);
        }

        match self.user_presence.wait(USER_PRESENCE_TIMEOUT_MS).await {
            UserPresenceResult::Confirmed => {}
            UserPresenceResult::TimedOut => {
                return Self::sw_response(U2F_SW_CONDITIONS_NOT_SATISFIED)
            }
            UserPresenceResult::Cancelled => {
                return Self::sw_response(U2F_SW_CONDITIONS_NOT_SATISFIED)
            }
        }

        let sign_count = match storage::increment_counter(self.storage) {
            Ok(c) => c,
            Err(_) => return Self::sw_response(U2F_SW_WRONG_DATA),
        };

        let user_presence_byte: u8 = 0x01;
        let counter_bytes = sign_count.to_be_bytes();

        let mut sig_input: Vec<u8, 128> = Vec::new();
        sig_input.extend_from_slice(app_param).ok();
        sig_input.push(user_presence_byte).ok();
        sig_input.extend_from_slice(&counter_bytes).ok();
        sig_input.extend_from_slice(challenge).ok();

        let sig = match crypto::sign(&cred.private_key, &sig_input) {
            Ok(s) => s,
            Err(_) => return Self::sw_response(U2F_SW_WRONG_DATA),
        };

        let mut resp: Vec<u8, 512> = Vec::new();
        resp.push(user_presence_byte).ok();
        resp.extend_from_slice(&counter_bytes).ok();
        resp.extend_from_slice(&sig).ok();
        resp.extend_from_slice(&U2F_SW_NO_ERROR.to_be_bytes()).ok();
        resp
    }

    fn error_response(status: u8) -> Vec<u8, 512> {
        let mut v: Vec<u8, 512> = Vec::new();
        v.push(status).ok();
        v
    }

    fn sw_response(sw: u16) -> Vec<u8, 512> {
        let mut v: Vec<u8, 512> = Vec::new();
        v.extend_from_slice(&sw.to_be_bytes()).ok();
        v
    }
}
