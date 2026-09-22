use heapless::Vec;
use zeroize::Zeroizing;

#[derive(Clone, Copy, Debug, PartialEq, Eq, defmt::Format)]
pub struct ChannelId(pub u32);

impl ChannelId {
    pub fn to_be_bytes(self) -> [u8; 4] {
        self.0.to_be_bytes()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, defmt::Format)]
pub struct RpIdHash(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CredentialId(pub Vec<u8, 128>);

#[derive(Clone, Copy, Debug, PartialEq, Eq, defmt::Format)]
pub struct Aaguid(pub [u8; 16]);

pub struct Credential {
    pub private_key: Zeroizing<[u8; 32]>,
    pub rp_id_hash: RpIdHash,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, defmt::Format)]
pub enum UserPresenceResult {
    Confirmed,
    TimedOut,
    Cancelled,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, defmt::Format)]
pub enum ChannelState {
    Idle,
    Receiving {
        cmd: u8,
        expected: u16,
        received: usize,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, defmt::Format)]
pub enum FlashError {
    EraseFailed,
    WriteFailed,
    ReadCorrupted,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, defmt::Format)]
pub enum CryptoError {
    InvalidKey,
    MacMismatch,
}

pub const CTAP2_OK: u8 = 0x00;
pub const CTAP2_ERR_INVALID_CBOR: u8 = 0x12;
pub const CTAP2_ERR_MISSING_PARAMETER: u8 = 0x14;
pub const CTAP2_ERR_PROCESSING: u8 = 0x21;
pub const CTAP2_ERR_UNSUPPORTED_ALGORITHM: u8 = 0x26;
pub const CTAP2_ERR_NO_CREDENTIALS: u8 = 0x2E;
pub const CTAP2_ERR_USER_ACTION_TIMEOUT: u8 = 0x2F;
pub const CTAP2_ERR_KEEPALIVE_CANCEL: u8 = 0x2D;
pub const CTAP2_ERR_CREDENTIAL_EXCLUDED: u8 = 0x19;
pub const CTAP2_ERR_NOT_ALLOWED: u8 = 0x30;
pub const CTAP2_ERR_PIN_INVALID: u8 = 0x31;
pub const CTAP2_ERR_PIN_BLOCKED: u8 = 0x32;
pub const CTAP2_ERR_PIN_AUTH_INVALID: u8 = 0x33;
pub const CTAP2_ERR_PIN_NOT_SET: u8 = 0x35;
pub const CTAP2_ERR_PIN_REQUIRED: u8 = 0x36;
pub const CTAP2_ERR_PIN_POLICY_VIOLATION: u8 = 0x37;

pub const ERR_INVALID_CMD: u8 = 0x01;
pub const ERR_INVALID_LEN: u8 = 0x03;
pub const ERR_INVALID_SEQ: u8 = 0x04;
pub const ERR_MSG_TIMEOUT: u8 = 0x05;
pub const ERR_CHANNEL_BUSY: u8 = 0x06;
pub const ERR_INVALID_CHANNEL: u8 = 0x0B;

pub const CTAPHID_PING: u8 = 0x01 | 0x80;
pub const CTAPHID_MSG: u8 = 0x03 | 0x80;
pub const CTAPHID_LOCK: u8 = 0x04 | 0x80;
pub const CTAPHID_INIT: u8 = 0x06 | 0x80;
pub const CTAPHID_WINK: u8 = 0x08 | 0x80;
pub const CTAPHID_CBOR: u8 = 0x10 | 0x80;
pub const CTAPHID_CANCEL: u8 = 0x11 | 0x80;
pub const CTAPHID_ERROR: u8 = 0x3F | 0x80;
pub const CTAPHID_KEEPALIVE: u8 = 0x3B | 0x80;

pub const AAGUID: Aaguid = Aaguid([
    0x72, 0x31, 0x37, 0x63, 0xF1, 0xD0, 0x4A, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
]);
