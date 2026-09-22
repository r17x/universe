use p256::ecdsa::SigningKey;
use p256::FieldBytes;
use zeroize::Zeroizing;

use crate::crypto::{self, Entropy};
use crate::types::{Credential, CredentialId, CryptoError, FlashError, RpIdHash};

const FLASH_SECTOR_SIZE: u32 = 4096;
const FLASH_TOTAL_SIZE: u32 = 2 * 1024 * 1024;

const KEY_STORAGE_BASE: u32 = 0x40000;
const KEY_STORAGE_SIZE: u32 = FLASH_SECTOR_SIZE;

const MASTER_SECRET_OFFSET: u32 = 0;
const FLASH_MAGIC_OFFSET: u32 = 256;
const FLASH_MAGIC: [u8; 4] = [0x52, 0x31, 0x37, 0x46];
const COUNTER_PAGE_OFFSET: u32 = FLASH_SECTOR_SIZE;

const PIN_HASH_OFFSET: u32 = 32;
const PIN_RETRIES_OFFSET: u32 = 48;
const MAX_PIN_RETRIES: u8 = 8;
const COUNTER_PAGE_ENTRIES: u32 = FLASH_SECTOR_SIZE / 4;

pub trait Storage {
    fn read(&self, offset: u32, buf: &mut [u8]) -> Result<(), FlashError>;
    fn write(&mut self, offset: u32, data: &[u8]) -> Result<(), FlashError>;
    fn erase(&mut self, offset: u32, len: u32) -> Result<(), FlashError>;
}

pub fn validate_flash_layout(storage: &impl Storage) -> Result<bool, FlashError> {
    let mut magic = [0u8; 4];
    storage.read(KEY_STORAGE_BASE + FLASH_MAGIC_OFFSET, &mut magic)?;
    Ok(magic == FLASH_MAGIC)
}

pub fn initialize_flash_layout(storage: &mut impl Storage) -> Result<(), FlashError> {
    storage.erase(KEY_STORAGE_BASE, 4096)?;
    storage.erase(KEY_STORAGE_BASE + COUNTER_PAGE_OFFSET, 4096)?;
    storage.erase(RK_STORAGE_BASE, 4096)?;
    storage.erase(OATH_STORAGE_BASE, 4096)?;
    storage.write(KEY_STORAGE_BASE + FLASH_MAGIC_OFFSET, &FLASH_MAGIC)
}

pub fn init_master_secret(
    storage: &mut impl Storage,
    rng: &mut impl Entropy,
) -> Result<Zeroizing<[u8; 32]>, FlashError> {
    let mut buf = Zeroizing::new([0u8; 32]);
    storage.read(KEY_STORAGE_BASE + MASTER_SECRET_OFFSET, buf.as_mut())?;

    if buf.iter().all(|&b| b == 0xFF) {
        rng.fill_random(buf.as_mut());
        storage.write(KEY_STORAGE_BASE + MASTER_SECRET_OFFSET, buf.as_ref())?;
    }

    Ok(buf)
}

pub fn reset_master_secret(
    storage: &mut impl Storage,
    rng: &mut impl Entropy,
) -> Result<Zeroizing<[u8; 32]>, FlashError> {
    storage.erase(KEY_STORAGE_BASE, 4096)?;
    let mut buf = Zeroizing::new([0u8; 32]);
    rng.fill_random(buf.as_mut());
    storage.write(KEY_STORAGE_BASE + MASTER_SECRET_OFFSET, buf.as_ref())?;
    storage.write(KEY_STORAGE_BASE + FLASH_MAGIC_OFFSET, &FLASH_MAGIC)?;
    Ok(buf)
}

pub fn is_pin_set(storage: &impl Storage) -> Result<bool, FlashError> {
    let mut buf = [0u8; 16];
    storage.read(KEY_STORAGE_BASE + PIN_HASH_OFFSET, &mut buf)?;
    Ok(!buf.iter().all(|&b| b == 0xFF))
}

pub fn read_pin_hash(storage: &impl Storage) -> Result<[u8; 16], FlashError> {
    let mut buf = [0u8; 16];
    storage.read(KEY_STORAGE_BASE + PIN_HASH_OFFSET, &mut buf)?;
    Ok(buf)
}

pub fn get_pin_retries(storage: &impl Storage) -> Result<u8, FlashError> {
    let mut buf = [0u8; 8];
    storage.read(KEY_STORAGE_BASE + PIN_RETRIES_OFFSET, &mut buf)?;
    let failures = buf.iter().filter(|&&b| b == 0x00).count() as u8;
    Ok(MAX_PIN_RETRIES.saturating_sub(failures))
}

pub fn decrement_pin_retries(storage: &mut impl Storage) -> Result<u8, FlashError> {
    let mut buf = [0u8; 8];
    storage.read(KEY_STORAGE_BASE + PIN_RETRIES_OFFSET, &mut buf)?;
    let failures = buf.iter().filter(|&&b| b == 0x00).count() as u8;
    if failures >= MAX_PIN_RETRIES {
        return Ok(0);
    }
    storage.write(
        KEY_STORAGE_BASE + PIN_RETRIES_OFFSET + failures as u32,
        &[0x00],
    )?;
    Ok(MAX_PIN_RETRIES - failures - 1)
}

pub fn store_pin_and_reset_retries(
    storage: &mut impl Storage,
    pin_hash: &[u8; 16],
) -> Result<(), FlashError> {
    let mut master = Zeroizing::new([0u8; 32]);
    storage.read(KEY_STORAGE_BASE + MASTER_SECRET_OFFSET, master.as_mut())?;
    storage.erase(KEY_STORAGE_BASE, 4096)?;
    storage.write(KEY_STORAGE_BASE + MASTER_SECRET_OFFSET, master.as_ref())?;
    storage.write(KEY_STORAGE_BASE + PIN_HASH_OFFSET, pin_hash)?;
    storage.write(KEY_STORAGE_BASE + FLASH_MAGIC_OFFSET, &FLASH_MAGIC)
}

pub fn reset_pin_retries(storage: &mut impl Storage) -> Result<(), FlashError> {
    let mut buf = [0u8; 8];
    storage.read(KEY_STORAGE_BASE + PIN_RETRIES_OFFSET, &mut buf)?;
    let failures = buf.iter().filter(|&&b| b == 0x00).count();
    if failures == 0 {
        return Ok(());
    }
    let mut master = Zeroizing::new([0u8; 32]);
    storage.read(KEY_STORAGE_BASE + MASTER_SECRET_OFFSET, master.as_mut())?;
    let pin_hash = read_pin_hash(storage)?;
    storage.erase(KEY_STORAGE_BASE, 4096)?;
    storage.write(KEY_STORAGE_BASE + MASTER_SECRET_OFFSET, master.as_ref())?;
    storage.write(KEY_STORAGE_BASE + PIN_HASH_OFFSET, &pin_hash)?;
    storage.write(KEY_STORAGE_BASE + FLASH_MAGIC_OFFSET, &FLASH_MAGIC)
}

fn derive_keys(master_secret: &[u8; 32]) -> (Zeroizing<[u8; 32]>, Zeroizing<[u8; 32]>) {
    let cred_key = Zeroizing::new(crypto::hmac_sha256(master_secret, b"r17c:credkey"));
    let mac_key = Zeroizing::new(crypto::hmac_sha256(master_secret, b"r17c:mackey"));
    (cred_key, mac_key)
}

pub fn wrap_credential(
    signing_key: &SigningKey,
    rp_id_hash: &RpIdHash,
    master_secret: &[u8; 32],
    rng: &mut impl Entropy,
) -> Result<CredentialId, CryptoError> {
    let (cred_key, mac_key) = derive_keys(master_secret);

    let d: FieldBytes = signing_key.to_bytes();
    let mut plaintext = Zeroizing::new([0u8; 65]);
    plaintext[..32].copy_from_slice(d.as_slice());
    plaintext[32..64].copy_from_slice(&rp_id_hash.0);
    plaintext[64] = 0x00;

    let mut iv = [0u8; 16];
    rng.fill_random(&mut iv);

    let ciphertext = crypto::aes256_cbc_encrypt(&cred_key, &iv, plaintext.as_ref())?;

    let mut mac_input = [0u8; 96];
    mac_input[..16].copy_from_slice(&iv);
    mac_input[16..16 + ciphertext.len()].copy_from_slice(&ciphertext);
    let mac = crypto::hmac_sha256(mac_key.as_ref(), &mac_input[..16 + ciphertext.len()]);

    let mut raw: heapless::Vec<u8, 128> = heapless::Vec::new();
    raw.extend_from_slice(&iv)
        .map_err(|_| CryptoError::InvalidKey)?;
    raw.extend_from_slice(&ciphertext)
        .map_err(|_| CryptoError::InvalidKey)?;
    raw.extend_from_slice(&mac)
        .map_err(|_| CryptoError::InvalidKey)?;

    Ok(CredentialId(raw))
}

pub fn unwrap_credential(
    credential_id: &CredentialId,
    rp_id_hash: &RpIdHash,
    master_secret: &[u8; 32],
) -> Result<Credential, CryptoError> {
    let raw = &credential_id.0;
    if raw.len() != 128 {
        return Err(CryptoError::MacMismatch);
    }

    let iv: &[u8; 16] = raw[..16].try_into().map_err(|_| CryptoError::MacMismatch)?;
    let ciphertext = &raw[16..96];
    let stored_mac = &raw[96..128];

    let (cred_key, mac_key) = derive_keys(master_secret);

    let mut mac_input = [0u8; 96];
    mac_input[..16].copy_from_slice(iv);
    mac_input[16..96].copy_from_slice(ciphertext);
    let computed_mac = crypto::hmac_sha256(mac_key.as_ref(), &mac_input);

    if !crypto::ct_eq(&computed_mac, stored_mac) {
        return Err(CryptoError::MacMismatch);
    }

    let plaintext = crypto::aes256_cbc_decrypt(&cred_key, iv, ciphertext)?;
    if plaintext.len() < 65 {
        return Err(CryptoError::MacMismatch);
    }

    let mut private_key = Zeroizing::new([0u8; 32]);
    private_key.copy_from_slice(&plaintext[..32]);

    let extracted_rp_id_hash: [u8; 32] = plaintext[32..64]
        .try_into()
        .map_err(|_| CryptoError::MacMismatch)?;

    if !crypto::ct_eq(&extracted_rp_id_hash, &rp_id_hash.0) {
        return Err(CryptoError::MacMismatch);
    }

    Ok(Credential {
        private_key,
        rp_id_hash: RpIdHash(extracted_rp_id_hash),
    })
}

pub fn increment_counter(storage: &mut impl Storage) -> Result<u32, FlashError> {
    let mut lo: u32 = 0;
    let mut hi: u32 = COUNTER_PAGE_ENTRIES;
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        let mut word = [0u8; 4];
        storage.read(KEY_STORAGE_BASE + COUNTER_PAGE_OFFSET + mid * 4, &mut word)?;
        if u32::from_le_bytes(word) == 0xFFFFFFFF {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }

    let last_value = if lo > 0 {
        let mut word = [0u8; 4];
        storage.read(
            KEY_STORAGE_BASE + COUNTER_PAGE_OFFSET + (lo - 1) * 4,
            &mut word,
        )?;
        u32::from_le_bytes(word)
    } else {
        0
    };

    let new_value = last_value + 1;

    if lo >= COUNTER_PAGE_ENTRIES {
        storage.erase(KEY_STORAGE_BASE + COUNTER_PAGE_OFFSET, 4096)?;
        storage.write(
            KEY_STORAGE_BASE + COUNTER_PAGE_OFFSET,
            &new_value.to_le_bytes(),
        )?;
    } else {
        storage.write(
            KEY_STORAGE_BASE + COUNTER_PAGE_OFFSET + lo * 4,
            &new_value.to_le_bytes(),
        )?;
    }

    Ok(new_value)
}

const RK_STORAGE_BASE: u32 = 0x42000;
const RK_STORAGE_SIZE: u32 = FLASH_SECTOR_SIZE;
const RK_SLOT_SIZE: u32 = 256;
const RK_MAX_SLOTS: u32 = 16;
const RK_STAGING_BASE: u32 = 0x43000;
const RK_STAGING_SIZE: u32 = FLASH_SECTOR_SIZE;

const RK_STATE: u32 = 0;
const RK_RP_HASH: u32 = 1;
const RK_CRED_ID: u32 = 33;
const RK_UID_LEN: u32 = 161;
const RK_UID: u32 = 162;
const RK_CRED_PROTECT: u32 = 226;
const RK_RP_ID_LEN: u32 = 227;
const RK_RP_ID: u32 = 228;

pub fn store_resident_key(
    storage: &mut impl Storage,
    rp_id_hash: &RpIdHash,
    credential_id: &CredentialId,
    user_id: &[u8],
    cred_protect: u8,
    rp_id: &[u8],
) -> Result<(), FlashError> {
    if credential_id.0.len() != 128 || user_id.len() > 64 {
        return Err(FlashError::WriteFailed);
    }

    let mut empty_slot: Option<u32> = None;

    for i in 0..RK_MAX_SLOTS {
        let offset = RK_STORAGE_BASE + i * RK_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;

        match state[0] {
            0xFF => {
                if empty_slot.is_none() {
                    empty_slot = Some(i);
                }
            }
            0x01 => {
                let mut stored_rp = [0u8; 32];
                storage.read(offset + RK_RP_HASH, &mut stored_rp)?;
                if stored_rp == rp_id_hash.0 {
                    let mut uid_len_buf = [0u8; 1];
                    storage.read(offset + RK_UID_LEN, &mut uid_len_buf)?;
                    let len = uid_len_buf[0] as usize;
                    if len == user_id.len() && len <= 64 {
                        let mut stored_uid = [0u8; 64];
                        storage.read(offset + RK_UID, &mut stored_uid[..len])?;
                        if &stored_uid[..len] == user_id {
                            storage.write(offset, &[0x00])?;
                        }
                    }
                }
            }
            _ => {}
        }
    }

    if empty_slot.is_none() {
        compact_resident_keys(storage)?;
        for i in 0..RK_MAX_SLOTS {
            let offset = RK_STORAGE_BASE + i * RK_SLOT_SIZE;
            let mut state = [0u8; 1];
            storage.read(offset, &mut state)?;
            if state[0] == 0xFF {
                empty_slot = Some(i);
                break;
            }
        }
    }

    let slot = match empty_slot {
        Some(s) => s,
        None => return Err(FlashError::WriteFailed),
    };

    let offset = RK_STORAGE_BASE + slot * RK_SLOT_SIZE;
    let mut buf = [0xFFu8; 256];
    buf[RK_STATE as usize] = 0x01;
    buf[RK_RP_HASH as usize..RK_CRED_ID as usize].copy_from_slice(&rp_id_hash.0);
    buf[RK_CRED_ID as usize..RK_UID_LEN as usize].copy_from_slice(&credential_id.0);
    buf[RK_UID_LEN as usize] = user_id.len() as u8;
    buf[RK_UID as usize..RK_UID as usize + user_id.len()].copy_from_slice(user_id);
    buf[RK_CRED_PROTECT as usize] = cred_protect;

    let rp_id_trimmed = if rp_id.len() > 28 {
        &rp_id[..28]
    } else {
        rp_id
    };
    buf[RK_RP_ID_LEN as usize] = rp_id_trimmed.len() as u8;
    buf[RK_RP_ID as usize..RK_RP_ID as usize + rp_id_trimmed.len()].copy_from_slice(rp_id_trimmed);

    storage.write(offset, &buf)
}

pub fn find_resident_key(
    storage: &impl Storage,
    rp_id_hash: &RpIdHash,
) -> Result<Option<ResidentKeyEntry>, FlashError> {
    for i in (0..RK_MAX_SLOTS).rev() {
        let offset = RK_STORAGE_BASE + i * RK_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] != 0x01 {
            continue;
        }

        let mut stored_rp = [0u8; 32];
        storage.read(offset + RK_RP_HASH, &mut stored_rp)?;
        if stored_rp != rp_id_hash.0 {
            continue;
        }

        let mut cred_bytes = [0u8; 128];
        storage.read(offset + RK_CRED_ID, &mut cred_bytes)?;
        let mut cred_vec: heapless::Vec<u8, 128> = heapless::Vec::new();
        cred_vec.extend_from_slice(&cred_bytes).ok();

        let mut uid_len_buf = [0u8; 1];
        storage.read(offset + RK_UID_LEN, &mut uid_len_buf)?;
        let len = (uid_len_buf[0] as usize).min(64);
        let mut user_id: heapless::Vec<u8, 64> = heapless::Vec::new();
        if len > 0 {
            let mut uid_buf = [0u8; 64];
            storage.read(offset + RK_UID, &mut uid_buf[..len])?;
            user_id.extend_from_slice(&uid_buf[..len]).ok();
        }

        let mut cp_buf = [0u8; 1];
        storage.read(offset + RK_CRED_PROTECT, &mut cp_buf)?;
        let cred_protect = if cp_buf[0] == 0xFF { 0x01 } else { cp_buf[0] };

        let rp_id = read_rp_id_from_slot(storage, offset)?;

        return Ok(Some((CredentialId(cred_vec), user_id, cred_protect, rp_id)));
    }

    Ok(None)
}

fn read_rp_id_from_slot(
    storage: &impl Storage,
    offset: u32,
) -> Result<heapless::Vec<u8, 28>, FlashError> {
    let mut rp_id_len_buf = [0u8; 1];
    storage.read(offset + RK_RP_ID_LEN, &mut rp_id_len_buf)?;
    let rp_id_len = rp_id_len_buf[0];
    let mut rp_id: heapless::Vec<u8, 28> = heapless::Vec::new();
    if rp_id_len != 0xFF && rp_id_len <= 28 {
        let len = rp_id_len as usize;
        let mut rp_buf = [0u8; 28];
        storage.read(offset + RK_RP_ID, &mut rp_buf[..len])?;
        rp_id.extend_from_slice(&rp_buf[..len]).ok();
    }
    Ok(rp_id)
}

pub fn list_resident_rps(
    storage: &impl Storage,
) -> Result<heapless::Vec<(RpIdHash, heapless::Vec<u8, 28>), 16>, FlashError> {
    let mut result: heapless::Vec<(RpIdHash, heapless::Vec<u8, 28>), 16> = heapless::Vec::new();
    for i in 0..RK_MAX_SLOTS {
        let offset = RK_STORAGE_BASE + i * RK_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] != 0x01 {
            continue;
        }

        let mut stored_rp = [0u8; 32];
        storage.read(offset + RK_RP_HASH, &mut stored_rp)?;

        let already_seen = result.iter().any(|(h, _)| h.0 == stored_rp);
        if already_seen {
            continue;
        }

        let rp_id = read_rp_id_from_slot(storage, offset)?;
        result.push((RpIdHash(stored_rp), rp_id)).ok();
    }
    Ok(result)
}

pub fn list_credentials_for_rp(
    storage: &impl Storage,
    rp_id_hash: &RpIdHash,
) -> Result<heapless::Vec<(CredentialId, heapless::Vec<u8, 64>, u8), 16>, FlashError> {
    let mut result: heapless::Vec<(CredentialId, heapless::Vec<u8, 64>, u8), 16> =
        heapless::Vec::new();
    for i in 0..RK_MAX_SLOTS {
        let offset = RK_STORAGE_BASE + i * RK_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] != 0x01 {
            continue;
        }

        let mut stored_rp = [0u8; 32];
        storage.read(offset + RK_RP_HASH, &mut stored_rp)?;
        if stored_rp != rp_id_hash.0 {
            continue;
        }

        let mut cred_bytes = [0u8; 128];
        storage.read(offset + RK_CRED_ID, &mut cred_bytes)?;
        let mut cred_vec: heapless::Vec<u8, 128> = heapless::Vec::new();
        cred_vec.extend_from_slice(&cred_bytes).ok();

        let mut uid_len_buf = [0u8; 1];
        storage.read(offset + RK_UID_LEN, &mut uid_len_buf)?;
        let len = (uid_len_buf[0] as usize).min(64);
        let mut user_id: heapless::Vec<u8, 64> = heapless::Vec::new();
        if len > 0 {
            let mut uid_buf = [0u8; 64];
            storage.read(offset + RK_UID, &mut uid_buf[..len])?;
            user_id.extend_from_slice(&uid_buf[..len]).ok();
        }

        let mut cp_buf = [0u8; 1];
        storage.read(offset + RK_CRED_PROTECT, &mut cp_buf)?;
        let cred_protect = if cp_buf[0] == 0xFF { 0x01 } else { cp_buf[0] };

        result
            .push((CredentialId(cred_vec), user_id, cred_protect))
            .ok();
    }
    Ok(result)
}

pub fn delete_resident_key_by_cred_id(
    storage: &mut impl Storage,
    credential_id: &CredentialId,
) -> Result<bool, FlashError> {
    for i in 0..RK_MAX_SLOTS {
        let offset = RK_STORAGE_BASE + i * RK_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] != 0x01 {
            continue;
        }

        let mut cred_bytes = [0u8; 128];
        storage.read(offset + RK_CRED_ID, &mut cred_bytes)?;
        if cred_bytes[..] == credential_id.0[..] {
            storage.write(offset, &[0x00])?;
            return Ok(true);
        }
    }
    Ok(false)
}

pub fn clear_resident_keys(storage: &mut impl Storage) -> Result<(), FlashError> {
    storage.erase(RK_STORAGE_BASE, 4096)?;
    storage.erase(RK_STAGING_BASE, 4096)
}

fn compact_resident_keys(storage: &mut impl Storage) -> Result<(), FlashError> {
    storage.erase(RK_STAGING_BASE, 4096)?;

    let mut write_idx = 0u32;
    for i in 0..RK_MAX_SLOTS {
        let offset = RK_STORAGE_BASE + i * RK_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] == 0x01 {
            let mut buf = [0u8; 256];
            storage.read(offset, &mut buf)?;
            storage.write(RK_STAGING_BASE + write_idx * RK_SLOT_SIZE, &buf)?;
            write_idx += 1;
        }
    }

    storage.erase(RK_STORAGE_BASE, 4096)?;

    for i in 0..write_idx {
        let mut buf = [0u8; 256];
        storage.read(RK_STAGING_BASE + i * RK_SLOT_SIZE, &mut buf)?;
        storage.write(RK_STORAGE_BASE + i * RK_SLOT_SIZE, &buf)?;
    }

    storage.erase(RK_STAGING_BASE, 4096)
}

const OATH_STORAGE_BASE: u32 = 0x60000;
const OATH_STORAGE_SIZE: u32 = FLASH_SECTOR_SIZE;
const OATH_SLOT_SIZE: u32 = 192;
const OATH_MAX_SLOTS: u32 = 16;
const OATH_STAGING_BASE: u32 = 0x61000;
const OATH_STAGING_SIZE: u32 = FLASH_SECTOR_SIZE;

const OATH_STATE: u32 = 0;
const OATH_NAME_LEN: u32 = 1;
const OATH_NAME: u32 = 2;
const OATH_TYPE_ALGO: u32 = 66;
const OATH_DIGITS: u32 = 67;
const OATH_SECRET_LEN: u32 = 68;
const OATH_SECRET: u32 = 69;
const OATH_COUNTER: u32 = 133;

const _: () = assert!(KEY_STORAGE_BASE.is_multiple_of(FLASH_SECTOR_SIZE));
const _: () = assert!(RK_STORAGE_BASE.is_multiple_of(FLASH_SECTOR_SIZE));
const _: () = assert!(RK_STAGING_BASE.is_multiple_of(FLASH_SECTOR_SIZE));
const _: () = assert!(OATH_STORAGE_BASE.is_multiple_of(FLASH_SECTOR_SIZE));
const _: () = assert!(OATH_STAGING_BASE.is_multiple_of(FLASH_SECTOR_SIZE));

const _: () = assert!(KEY_STORAGE_BASE + KEY_STORAGE_SIZE + FLASH_SECTOR_SIZE <= RK_STORAGE_BASE);
const _: () = assert!(RK_STORAGE_BASE + RK_STORAGE_SIZE <= RK_STAGING_BASE);
const _: () = assert!(RK_STAGING_BASE + RK_STAGING_SIZE <= OATH_STORAGE_BASE);
const _: () = assert!(OATH_STORAGE_BASE + OATH_STORAGE_SIZE <= OATH_STAGING_BASE);
const _: () = assert!(OATH_STAGING_BASE + OATH_STAGING_SIZE <= FLASH_TOTAL_SIZE);

const _: () = assert!(RK_MAX_SLOTS * RK_SLOT_SIZE <= RK_STORAGE_SIZE);
const _: () = assert!(OATH_MAX_SLOTS * OATH_SLOT_SIZE <= OATH_STORAGE_SIZE);

const _: () = assert!(RK_RP_ID + 28 <= RK_SLOT_SIZE);
const _: () = assert!(OATH_COUNTER + 8 <= OATH_SLOT_SIZE);

const _: () = assert!(MASTER_SECRET_OFFSET + 32 <= PIN_HASH_OFFSET);
const _: () = assert!(PIN_HASH_OFFSET + 16 <= PIN_RETRIES_OFFSET);
const _: () = assert!(PIN_RETRIES_OFFSET + 8 <= FLASH_MAGIC_OFFSET);

pub type ResidentKeyEntry = (
    CredentialId,
    heapless::Vec<u8, 64>,
    u8,
    heapless::Vec<u8, 28>,
);

pub struct OathCredential {
    pub name: heapless::Vec<u8, 64>,
    pub type_algo: u8,
    pub digits: u8,
    pub secret: heapless::Vec<u8, 64>,
    pub counter: u64,
}

pub fn store_oath_credential(
    storage: &mut impl Storage,
    cred: &OathCredential,
) -> Result<(), FlashError> {
    for i in 0..OATH_MAX_SLOTS {
        let offset = OATH_STORAGE_BASE + i * OATH_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] == 0x01 {
            let mut name_len_buf = [0u8; 1];
            storage.read(offset + OATH_NAME_LEN, &mut name_len_buf)?;
            let name_len = (name_len_buf[0] as usize).min(64);
            if name_len == cred.name.len() {
                let mut stored_name = [0u8; 64];
                storage.read(offset + OATH_NAME, &mut stored_name[..name_len])?;
                if &stored_name[..name_len] == cred.name.as_slice() {
                    storage.write(offset, &[0x00])?;
                }
            }
        }
    }

    let mut empty_slot: Option<u32> = None;
    for i in 0..OATH_MAX_SLOTS {
        let offset = OATH_STORAGE_BASE + i * OATH_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] == 0xFF {
            empty_slot = Some(i);
            break;
        }
    }

    if empty_slot.is_none() {
        compact_oath_credentials(storage)?;
        for i in 0..OATH_MAX_SLOTS {
            let offset = OATH_STORAGE_BASE + i * OATH_SLOT_SIZE;
            let mut state = [0u8; 1];
            storage.read(offset, &mut state)?;
            if state[0] == 0xFF {
                empty_slot = Some(i);
                break;
            }
        }
    }

    let slot = match empty_slot {
        Some(s) => s,
        None => return Err(FlashError::WriteFailed),
    };

    let offset = OATH_STORAGE_BASE + slot * OATH_SLOT_SIZE;
    let mut buf = [0xFFu8; 192];
    buf[OATH_STATE as usize] = 0x01;
    buf[OATH_NAME_LEN as usize] = cred.name.len() as u8;
    buf[OATH_NAME as usize..OATH_NAME as usize + cred.name.len()].copy_from_slice(&cred.name);
    buf[OATH_TYPE_ALGO as usize] = cred.type_algo;
    buf[OATH_DIGITS as usize] = cred.digits;
    buf[OATH_SECRET_LEN as usize] = cred.secret.len() as u8;
    buf[OATH_SECRET as usize..OATH_SECRET as usize + cred.secret.len()]
        .copy_from_slice(&cred.secret);
    buf[OATH_COUNTER as usize..OATH_COUNTER as usize + 8]
        .copy_from_slice(&cred.counter.to_le_bytes());

    storage.write(offset, &buf)
}

pub fn list_oath_credentials(
    storage: &impl Storage,
) -> Result<heapless::Vec<(heapless::Vec<u8, 64>, u8), 16>, FlashError> {
    let mut result: heapless::Vec<(heapless::Vec<u8, 64>, u8), 16> = heapless::Vec::new();
    for i in 0..OATH_MAX_SLOTS {
        let offset = OATH_STORAGE_BASE + i * OATH_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] != 0x01 {
            continue;
        }
        let mut name_len_buf = [0u8; 1];
        storage.read(offset + OATH_NAME_LEN, &mut name_len_buf)?;
        let name_len = (name_len_buf[0] as usize).min(64);
        let mut name: heapless::Vec<u8, 64> = heapless::Vec::new();
        if name_len > 0 {
            let mut name_buf = [0u8; 64];
            storage.read(offset + OATH_NAME, &mut name_buf[..name_len])?;
            name.extend_from_slice(&name_buf[..name_len]).ok();
        }
        let mut type_algo_buf = [0u8; 1];
        storage.read(offset + OATH_TYPE_ALGO, &mut type_algo_buf)?;
        result.push((name, type_algo_buf[0])).ok();
    }
    Ok(result)
}

pub fn find_oath_credential(
    storage: &impl Storage,
    name: &[u8],
) -> Result<Option<(OathCredential, u32)>, FlashError> {
    for i in 0..OATH_MAX_SLOTS {
        let offset = OATH_STORAGE_BASE + i * OATH_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] != 0x01 {
            continue;
        }
        let mut name_len_buf = [0u8; 1];
        storage.read(offset + OATH_NAME_LEN, &mut name_len_buf)?;
        let name_len = (name_len_buf[0] as usize).min(64);
        if name_len != name.len() {
            continue;
        }
        let mut stored_name = [0u8; 64];
        storage.read(offset + OATH_NAME, &mut stored_name[..name_len])?;
        if &stored_name[..name_len] != name {
            continue;
        }

        let mut type_algo_buf = [0u8; 1];
        storage.read(offset + OATH_TYPE_ALGO, &mut type_algo_buf)?;
        let mut digits_buf = [0u8; 1];
        storage.read(offset + OATH_DIGITS, &mut digits_buf)?;
        let mut secret_len_buf = [0u8; 1];
        storage.read(offset + OATH_SECRET_LEN, &mut secret_len_buf)?;
        let secret_len = (secret_len_buf[0] as usize).min(64);
        let mut secret_buf = [0u8; 64];
        storage.read(offset + OATH_SECRET, &mut secret_buf[..secret_len])?;
        let mut counter_buf = [0u8; 8];
        storage.read(offset + OATH_COUNTER, &mut counter_buf)?;

        let mut cred_name: heapless::Vec<u8, 64> = heapless::Vec::new();
        cred_name.extend_from_slice(&stored_name[..name_len]).ok();
        let mut secret: heapless::Vec<u8, 64> = heapless::Vec::new();
        secret.extend_from_slice(&secret_buf[..secret_len]).ok();

        let cred = OathCredential {
            name: cred_name,
            type_algo: type_algo_buf[0],
            digits: digits_buf[0],
            secret,
            counter: u64::from_le_bytes(counter_buf),
        };
        return Ok(Some((cred, i)));
    }
    Ok(None)
}

pub fn delete_oath_credential(storage: &mut impl Storage, name: &[u8]) -> Result<bool, FlashError> {
    for i in 0..OATH_MAX_SLOTS {
        let offset = OATH_STORAGE_BASE + i * OATH_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] != 0x01 {
            continue;
        }
        let mut name_len_buf = [0u8; 1];
        storage.read(offset + OATH_NAME_LEN, &mut name_len_buf)?;
        let name_len = (name_len_buf[0] as usize).min(64);
        if name_len != name.len() {
            continue;
        }
        let mut stored_name = [0u8; 64];
        storage.read(offset + OATH_NAME, &mut stored_name[..name_len])?;
        if &stored_name[..name_len] == name {
            storage.write(offset, &[0x00])?;
            return Ok(true);
        }
    }
    Ok(false)
}

fn compact_oath_credentials(storage: &mut impl Storage) -> Result<(), FlashError> {
    storage.erase(OATH_STAGING_BASE, 4096)?;

    let mut write_idx = 0u32;
    for i in 0..OATH_MAX_SLOTS {
        let offset = OATH_STORAGE_BASE + i * OATH_SLOT_SIZE;
        let mut state = [0u8; 1];
        storage.read(offset, &mut state)?;
        if state[0] == 0x01 {
            let mut buf = [0u8; 192];
            storage.read(offset, &mut buf)?;
            storage.write(OATH_STAGING_BASE + write_idx * OATH_SLOT_SIZE, &buf)?;
            write_idx += 1;
        }
    }

    storage.erase(OATH_STORAGE_BASE, 4096)?;

    for i in 0..write_idx {
        let mut buf = [0u8; 192];
        storage.read(OATH_STAGING_BASE + i * OATH_SLOT_SIZE, &mut buf)?;
        storage.write(OATH_STORAGE_BASE + i * OATH_SLOT_SIZE, &buf)?;
    }

    storage.erase(OATH_STAGING_BASE, 4096)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockFlash {
        data: [u8; 0x80000],
    }

    impl MockFlash {
        fn new() -> Self {
            Self {
                data: [0xFF; 0x80000],
            }
        }
    }

    impl Storage for MockFlash {
        fn read(&self, offset: u32, buf: &mut [u8]) -> Result<(), FlashError> {
            let start = offset as usize;
            buf.copy_from_slice(&self.data[start..start + buf.len()]);
            Ok(())
        }

        fn write(&mut self, offset: u32, data: &[u8]) -> Result<(), FlashError> {
            for (i, &byte) in data.iter().enumerate() {
                self.data[offset as usize + i] &= byte;
            }
            Ok(())
        }

        fn erase(&mut self, offset: u32, len: u32) -> Result<(), FlashError> {
            if !offset.is_multiple_of(FLASH_SECTOR_SIZE) || !len.is_multiple_of(FLASH_SECTOR_SIZE) {
                return Err(FlashError::EraseFailed);
            }
            let start = offset as usize;
            self.data[start..start + len as usize].fill(0xFF);
            Ok(())
        }
    }

    struct TestRng(u64);

    impl crypto::Entropy for TestRng {
        fn fill_random(&mut self, buf: &mut [u8]) {
            for byte in buf.iter_mut() {
                self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1);
                *byte = (self.0 >> 33) as u8;
            }
        }
    }

    #[test]
    fn flash_write_only_clears_bits() {
        let mut flash = MockFlash::new();
        flash.write(0x40000, &[0x01]).unwrap();
        assert_eq!(flash.data[0x40000], 0x01);
        flash.write(0x40000, &[0x00]).unwrap();
        assert_eq!(flash.data[0x40000], 0x00);
        flash.write(0x40000, &[0x01]).unwrap();
        assert_eq!(flash.data[0x40000], 0x00);
    }

    #[test]
    fn flash_layout_init_and_validate() {
        let mut flash = MockFlash::new();
        assert!(!validate_flash_layout(&flash).unwrap());
        initialize_flash_layout(&mut flash).unwrap();
        assert!(validate_flash_layout(&flash).unwrap());
    }

    #[test]
    fn master_secret_persists() {
        let mut flash = MockFlash::new();
        let mut rng = TestRng(42);
        initialize_flash_layout(&mut flash).unwrap();
        let s1 = init_master_secret(&mut flash, &mut rng).unwrap();
        let s2 = init_master_secret(&mut flash, &mut rng).unwrap();
        assert_eq!(*s1, *s2);
    }

    #[test]
    fn master_secret_changes_on_reset() {
        let mut flash = MockFlash::new();
        let mut rng = TestRng(42);
        initialize_flash_layout(&mut flash).unwrap();
        let s1 = init_master_secret(&mut flash, &mut rng).unwrap();
        let s2 = reset_master_secret(&mut flash, &mut rng).unwrap();
        assert_ne!(*s1, *s2);
    }

    #[test]
    fn counter_monotonically_increases() {
        let mut flash = MockFlash::new();
        initialize_flash_layout(&mut flash).unwrap();
        assert_eq!(increment_counter(&mut flash).unwrap(), 1);
        assert_eq!(increment_counter(&mut flash).unwrap(), 2);
        assert_eq!(increment_counter(&mut flash).unwrap(), 3);
    }

    #[test]
    fn counter_survives_page_wraparound() {
        let mut flash = MockFlash::new();
        initialize_flash_layout(&mut flash).unwrap();
        for _ in 0..COUNTER_PAGE_ENTRIES + 5 {
            increment_counter(&mut flash).unwrap();
        }
        assert_eq!(
            increment_counter(&mut flash).unwrap(),
            COUNTER_PAGE_ENTRIES + 6
        );
    }

    #[test]
    fn pin_retries_decrement_and_block() {
        let mut flash = MockFlash::new();
        initialize_flash_layout(&mut flash).unwrap();
        store_pin_and_reset_retries(&mut flash, &[0xAA; 16]).unwrap();
        assert_eq!(get_pin_retries(&flash).unwrap(), MAX_PIN_RETRIES);
        for i in 0..MAX_PIN_RETRIES {
            assert_eq!(
                decrement_pin_retries(&mut flash).unwrap(),
                MAX_PIN_RETRIES - i - 1
            );
        }
        assert_eq!(decrement_pin_retries(&mut flash).unwrap(), 0);
    }

    #[test]
    fn pin_retry_reset_preserves_secret_and_hash() {
        let mut flash = MockFlash::new();
        let mut rng = TestRng(99);
        initialize_flash_layout(&mut flash).unwrap();
        let secret = init_master_secret(&mut flash, &mut rng).unwrap();
        let pin_hash = [0xBB; 16];
        store_pin_and_reset_retries(&mut flash, &pin_hash).unwrap();
        decrement_pin_retries(&mut flash).unwrap();
        decrement_pin_retries(&mut flash).unwrap();
        reset_pin_retries(&mut flash).unwrap();
        assert_eq!(get_pin_retries(&flash).unwrap(), MAX_PIN_RETRIES);
        assert_eq!(read_pin_hash(&flash).unwrap(), pin_hash);
        let secret_after = init_master_secret(&mut flash, &mut rng).unwrap();
        assert_eq!(*secret, *secret_after);
    }

    #[test]
    fn credential_wrap_unwrap_roundtrip() {
        let mut rng = TestRng(123);
        let master = [0x42u8; 32];
        let (priv_bytes, _) = crypto::generate_keypair(&mut rng);
        let sk =
            p256::ecdsa::SigningKey::from_bytes(p256::FieldBytes::from_slice(priv_bytes.as_ref()))
                .unwrap();
        let rp = RpIdHash([0x11; 32]);
        let cid = wrap_credential(&sk, &rp, &master, &mut rng).unwrap();
        let cred = unwrap_credential(&cid, &rp, &master).unwrap();
        assert_eq!(cred.rp_id_hash, rp);
        assert_eq!(&*cred.private_key, priv_bytes.as_ref());
    }

    #[test]
    fn credential_unwrap_rejects_wrong_master() {
        let mut rng = TestRng(456);
        let (priv_bytes, _) = crypto::generate_keypair(&mut rng);
        let sk =
            p256::ecdsa::SigningKey::from_bytes(p256::FieldBytes::from_slice(priv_bytes.as_ref()))
                .unwrap();
        let rp = RpIdHash([0x11; 32]);
        let cid = wrap_credential(&sk, &rp, &[0x42; 32], &mut rng).unwrap();
        assert!(unwrap_credential(&cid, &rp, &[0x99; 32]).is_err());
    }

    #[test]
    fn credential_unwrap_rejects_wrong_rp() {
        let mut rng = TestRng(789);
        let (priv_bytes, _) = crypto::generate_keypair(&mut rng);
        let sk =
            p256::ecdsa::SigningKey::from_bytes(p256::FieldBytes::from_slice(priv_bytes.as_ref()))
                .unwrap();
        let rp1 = RpIdHash([0x11; 32]);
        let rp2 = RpIdHash([0x22; 32]);
        let cid = wrap_credential(&sk, &rp1, &[0x42; 32], &mut rng).unwrap();
        assert!(unwrap_credential(&cid, &rp2, &[0x42; 32]).is_err());
    }

    #[test]
    fn resident_key_store_find_roundtrip() {
        let mut flash = MockFlash::new();
        initialize_flash_layout(&mut flash).unwrap();
        let rp = RpIdHash([0xAA; 32]);
        let mut cv: heapless::Vec<u8, 128> = heapless::Vec::new();
        cv.resize(128, 0x55).ok();
        let cid = CredentialId(cv);
        store_resident_key(
            &mut flash,
            &rp,
            &cid,
            b"user@example.com",
            0x01,
            b"example.com",
        )
        .unwrap();
        let (fid, uid, cp, rp_id) = find_resident_key(&flash, &rp).unwrap().unwrap();
        assert_eq!(fid, cid);
        assert_eq!(uid.as_slice(), b"user@example.com");
        assert_eq!(cp, 0x01);
        assert_eq!(rp_id.as_slice(), b"example.com");
    }

    #[test]
    fn resident_key_dedup_same_user() {
        let mut flash = MockFlash::new();
        initialize_flash_layout(&mut flash).unwrap();
        let rp = RpIdHash([0xAA; 32]);
        let mut c1: heapless::Vec<u8, 128> = heapless::Vec::new();
        c1.resize(128, 0x11).ok();
        let mut c2: heapless::Vec<u8, 128> = heapless::Vec::new();
        c2.resize(128, 0x22).ok();
        store_resident_key(&mut flash, &rp, &CredentialId(c1), b"u", 0x01, b"rp").unwrap();
        store_resident_key(
            &mut flash,
            &rp,
            &CredentialId(c2.clone()),
            b"u",
            0x01,
            b"rp",
        )
        .unwrap();
        let (found, _, _, _) = find_resident_key(&flash, &rp).unwrap().unwrap();
        assert_eq!(found.0.as_slice(), c2.as_slice());
    }

    #[test]
    fn oath_store_find_delete_readd() {
        let mut flash = MockFlash::new();
        initialize_flash_layout(&mut flash).unwrap();
        let mut name: heapless::Vec<u8, 64> = heapless::Vec::new();
        name.extend_from_slice(b"github").ok();
        let mut secret: heapless::Vec<u8, 64> = heapless::Vec::new();
        secret.extend_from_slice(b"JBSWY3DPEHPK3PXP").ok();
        let cred = OathCredential {
            name: name.clone(),
            type_algo: 0x21,
            digits: 6,
            secret: secret.clone(),
            counter: 0,
        };
        store_oath_credential(&mut flash, &cred).unwrap();
        let (found, _) = find_oath_credential(&flash, b"github").unwrap().unwrap();
        assert_eq!(found.digits, 6);
        assert_eq!(found.secret.as_slice(), secret.as_slice());
        delete_oath_credential(&mut flash, b"github").unwrap();
        assert!(find_oath_credential(&flash, b"github").unwrap().is_none());
        store_oath_credential(&mut flash, &cred).unwrap();
        assert!(find_oath_credential(&flash, b"github").unwrap().is_some());
    }

    #[test]
    fn oath_bug21_write_after_delete_needs_erase() {
        let mut flash = MockFlash::new();
        initialize_flash_layout(&mut flash).unwrap();
        for i in 0..OATH_MAX_SLOTS {
            let mut name: heapless::Vec<u8, 64> = heapless::Vec::new();
            name.push(b'A' + i as u8).ok();
            let mut secret: heapless::Vec<u8, 64> = heapless::Vec::new();
            secret.extend_from_slice(b"secret").ok();
            store_oath_credential(
                &mut flash,
                &OathCredential {
                    name,
                    type_algo: 0x21,
                    digits: 6,
                    secret,
                    counter: 0,
                },
            )
            .unwrap();
        }
        delete_oath_credential(&mut flash, &[b'H']).unwrap();
        let mut name: heapless::Vec<u8, 64> = heapless::Vec::new();
        name.extend_from_slice(b"new").ok();
        let mut secret: heapless::Vec<u8, 64> = heapless::Vec::new();
        secret.extend_from_slice(b"newsecret").ok();
        store_oath_credential(
            &mut flash,
            &OathCredential {
                name,
                type_algo: 0x21,
                digits: 8,
                secret,
                counter: 0,
            },
        )
        .unwrap();
        let found = find_oath_credential(&flash, b"new").unwrap().unwrap();
        assert_eq!(found.0.digits, 8);
    }
}
