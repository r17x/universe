use hmac::{Hmac, Mac};
use sha1::Sha1;

pub fn hotp(secret: &[u8], counter: u64, digits: u8) -> u32 {
    let mut mac = Hmac::<Sha1>::new_from_slice(secret).expect("HMAC accepts any key length");
    mac.update(&counter.to_be_bytes());
    let result = mac.finalize().into_bytes();

    let offset = (result[19] & 0x0F) as usize;
    let code = ((result[offset] as u32 & 0x7F) << 24)
        | ((result[offset + 1] as u32) << 16)
        | ((result[offset + 2] as u32) << 8)
        | (result[offset + 3] as u32);

    let modulus = 10u32.pow(digits as u32);
    code % modulus
}

pub fn totp(secret: &[u8], time: u64, period: u64, digits: u8) -> u32 {
    hotp(secret, time / period, digits)
}
