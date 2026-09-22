use aes::Aes256;
use cbc::{
    cipher::{Block, BlockDecryptMut, BlockEncryptMut, KeyIvInit},
    Decryptor, Encryptor,
};
use heapless::Vec;
use hmac::{Hmac, Mac};
use p256::{
    ecdsa::{signature::Signer, DerSignature},
    EncodedPoint, FieldBytes,
};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

pub use p256::ecdsa::VerifyingKey;

use crate::types::CryptoError;

pub trait Entropy {
    fn fill_random(&mut self, buf: &mut [u8]);
}

pub fn generate_keypair(rng: &mut impl Entropy) -> (Zeroizing<[u8; 32]>, VerifyingKey) {
    loop {
        let mut bytes = Zeroizing::new([0u8; 32]);
        rng.fill_random(bytes.as_mut());
        if let Ok(sk) = p256::ecdsa::SigningKey::from_bytes(FieldBytes::from_slice(bytes.as_ref()))
        {
            let vk = *sk.verifying_key();
            return (bytes, vk);
        }
    }
}

pub fn sign(key_bytes: &[u8; 32], data: &[u8]) -> Result<Vec<u8, 72>, CryptoError> {
    let sk = p256::ecdsa::SigningKey::from_bytes(FieldBytes::from_slice(key_bytes))
        .map_err(|_| CryptoError::InvalidKey)?;
    let sig: DerSignature = sk.sign(data);
    let der_bytes = sig.as_bytes();
    let mut out: Vec<u8, 72> = Vec::new();
    out.extend_from_slice(der_bytes)
        .map_err(|_| CryptoError::InvalidKey)?;
    Ok(out)
}

pub fn encode_cose_pubkey(key: &VerifyingKey) -> Vec<u8, 77> {
    let point = EncodedPoint::from(key);
    let x = point.x().expect("non-identity point");
    let y = point.y().expect("non-identity point");

    let mut out: Vec<u8, 77> = Vec::new();
    // map(5)
    out.push(0xA5).ok();
    // kty: 2
    out.push(0x01).ok();
    out.push(0x02).ok();
    // alg: -7 (ES256)
    out.push(0x03).ok();
    out.push(0x26).ok();
    // crv: 1 (P-256) — negative key -1 encoded as 0x20
    out.push(0x20).ok();
    out.push(0x01).ok();
    // x: bytes(32)
    out.push(0x21).ok();
    out.push(0x58).ok();
    out.push(0x20).ok();
    out.extend_from_slice(x).ok();
    // y: bytes(32)
    out.push(0x22).ok();
    out.push(0x58).ok();
    out.push(0x20).ok();
    out.extend_from_slice(y).ok();
    out
}

pub fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

pub fn sha256(data: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(data);
    h.finalize().into()
}

pub fn hmac_sha256(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().into()
}

pub fn aes256_cbc_encrypt(
    key: &[u8; 32],
    iv: &[u8; 16],
    plaintext: &[u8],
) -> Result<Vec<u8, 128>, CryptoError> {
    let pad_len = 16 - (plaintext.len() % 16);
    let padded_len = plaintext.len() + pad_len;
    if padded_len > 128 {
        return Err(CryptoError::InvalidKey);
    }

    let mut buf = [0u8; 128];
    buf[..plaintext.len()].copy_from_slice(plaintext);
    // PKCS7 padding
    for b in buf[plaintext.len()..padded_len].iter_mut() {
        *b = pad_len as u8;
    }

    let mut enc = Encryptor::<Aes256>::new(key.into(), iv.into());
    for chunk in buf[..padded_len].chunks_mut(16) {
        let block = Block::<Aes256>::from_mut_slice(chunk);
        enc.encrypt_block_mut(block);
    }

    let mut out: Vec<u8, 128> = Vec::new();
    out.extend_from_slice(&buf[..padded_len])
        .map_err(|_| CryptoError::InvalidKey)?;
    Ok(out)
}

pub fn aes256_cbc_decrypt(
    key: &[u8; 32],
    iv: &[u8; 16],
    ciphertext: &[u8],
) -> Result<Vec<u8, 128>, CryptoError> {
    if ciphertext.is_empty() || !ciphertext.len().is_multiple_of(16) || ciphertext.len() > 128 {
        return Err(CryptoError::InvalidKey);
    }

    let mut buf = Zeroizing::new([0u8; 128]);
    buf[..ciphertext.len()].copy_from_slice(ciphertext);

    let mut dec = Decryptor::<Aes256>::new(key.into(), iv.into());
    for chunk in buf[..ciphertext.len()].chunks_mut(16) {
        let block = Block::<Aes256>::from_mut_slice(chunk);
        dec.decrypt_block_mut(block);
    }

    // PKCS7 unpadding
    let last = buf[ciphertext.len() - 1] as usize;
    if last == 0 || last > 16 {
        return Err(CryptoError::MacMismatch);
    }
    let plaintext_len = ciphertext
        .len()
        .checked_sub(last)
        .ok_or(CryptoError::MacMismatch)?;
    for &b in &buf[plaintext_len..ciphertext.len()] {
        if b as usize != last {
            return Err(CryptoError::MacMismatch);
        }
    }

    let mut out: Vec<u8, 128> = Vec::new();
    out.extend_from_slice(&buf[..plaintext_len])
        .map_err(|_| CryptoError::InvalidKey)?;
    Ok(out)
}

pub fn encode_cose_key_agreement(key: &VerifyingKey) -> Vec<u8, 78> {
    let point = EncodedPoint::from(key);
    let x = point.x().expect("non-identity point");
    let y = point.y().expect("non-identity point");

    let mut out: Vec<u8, 78> = Vec::new();
    out.push(0xA5).ok();
    out.push(0x01).ok();
    out.push(0x02).ok();
    out.push(0x03).ok();
    out.push(0x38).ok();
    out.push(0x18).ok();
    out.push(0x20).ok();
    out.push(0x01).ok();
    out.push(0x21).ok();
    out.push(0x58).ok();
    out.push(0x20).ok();
    out.extend_from_slice(x).ok();
    out.push(0x22).ok();
    out.push(0x58).ok();
    out.push(0x20).ok();
    out.extend_from_slice(y).ok();
    out
}

pub fn aes256_cbc_encrypt_raw(
    key: &[u8; 32],
    iv: &[u8; 16],
    plaintext: &[u8],
) -> Result<Vec<u8, 128>, CryptoError> {
    if plaintext.is_empty() || !plaintext.len().is_multiple_of(16) || plaintext.len() > 128 {
        return Err(CryptoError::InvalidKey);
    }
    let mut buf = [0u8; 128];
    buf[..plaintext.len()].copy_from_slice(plaintext);
    let mut enc = Encryptor::<Aes256>::new(key.into(), iv.into());
    for chunk in buf[..plaintext.len()].chunks_mut(16) {
        let block = Block::<Aes256>::from_mut_slice(chunk);
        enc.encrypt_block_mut(block);
    }
    let mut out: Vec<u8, 128> = Vec::new();
    out.extend_from_slice(&buf[..plaintext.len()])
        .map_err(|_| CryptoError::InvalidKey)?;
    Ok(out)
}

pub fn aes256_cbc_decrypt_raw(
    key: &[u8; 32],
    iv: &[u8; 16],
    ciphertext: &[u8],
) -> Result<Vec<u8, 128>, CryptoError> {
    if ciphertext.is_empty() || !ciphertext.len().is_multiple_of(16) || ciphertext.len() > 128 {
        return Err(CryptoError::InvalidKey);
    }
    let mut buf = Zeroizing::new([0u8; 128]);
    buf[..ciphertext.len()].copy_from_slice(ciphertext);
    let mut dec = Decryptor::<Aes256>::new(key.into(), iv.into());
    for chunk in buf[..ciphertext.len()].chunks_mut(16) {
        let block = Block::<Aes256>::from_mut_slice(chunk);
        dec.decrypt_block_mut(block);
    }
    let mut out: Vec<u8, 128> = Vec::new();
    out.extend_from_slice(&buf[..ciphertext.len()])
        .map_err(|_| CryptoError::InvalidKey)?;
    Ok(out)
}

pub fn ecdh_shared_secret(
    private_key: &[u8; 32],
    peer_x: &[u8; 32],
    peer_y: &[u8; 32],
) -> Result<Zeroizing<[u8; 32]>, CryptoError> {
    use p256::{
        elliptic_curve::sec1::{Coordinates, FromEncodedPoint, ToEncodedPoint},
        ProjectivePoint, PublicKey, SecretKey,
    };

    let mut uncompressed = [0u8; 65];
    uncompressed[0] = 0x04;
    uncompressed[1..33].copy_from_slice(peer_x);
    uncompressed[33..65].copy_from_slice(peer_y);

    let encoded_point =
        p256::EncodedPoint::from_bytes(uncompressed).map_err(|_| CryptoError::InvalidKey)?;

    let peer_pubkey = PublicKey::from_encoded_point(&encoded_point);
    if peer_pubkey.is_none().into() {
        return Err(CryptoError::InvalidKey);
    }
    let peer_pubkey = peer_pubkey.unwrap();

    let sk = SecretKey::from_bytes(FieldBytes::from_slice(private_key))
        .map_err(|_| CryptoError::InvalidKey)?;

    let shared_projective =
        ProjectivePoint::from(*peer_pubkey.as_affine()) * *sk.to_nonzero_scalar();
    let shared_point = shared_projective.to_affine().to_encoded_point(false);

    if let Coordinates::Uncompressed { x, y: _ } = shared_point.coordinates() {
        let mut result = Zeroizing::new([0u8; 32]);
        result.copy_from_slice(x);
        let hash = sha256(result.as_ref());
        Ok(Zeroizing::new(hash))
    } else {
        Err(CryptoError::InvalidKey)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ct_eq_equal_buffers() {
        assert!(ct_eq(b"hello", b"hello"));
        assert!(ct_eq(&[0u8; 32], &[0u8; 32]));
    }

    #[test]
    fn ct_eq_different_buffers() {
        assert!(!ct_eq(b"hello", b"world"));
        let mut a = [0u8; 32];
        let mut b = [0u8; 32];
        a[31] = 1;
        assert!(!ct_eq(&a, &b));
        b[0] = 1;
        assert!(!ct_eq(&a, &b));
    }

    #[test]
    fn ct_eq_different_lengths() {
        assert!(!ct_eq(b"short", b"longer"));
        assert!(!ct_eq(b"", b"x"));
    }

    #[test]
    fn ct_eq_empty() {
        assert!(ct_eq(b"", b""));
    }

    #[test]
    fn sha256_known_vector() {
        let hash = sha256(b"");
        assert_eq!(
            hash,
            [
                0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14, 0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f,
                0xb9, 0x24, 0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c, 0xa4, 0x95, 0x99, 0x1b,
                0x78, 0x52, 0xb8, 0x55,
            ]
        );
    }

    #[test]
    fn hmac_sha256_known_vector() {
        let mac = hmac_sha256(b"key", b"The quick brown fox jumps over the lazy dog");
        assert_eq!(
            mac,
            [
                0xf7, 0xbc, 0x83, 0xf4, 0x30, 0x53, 0x84, 0x24, 0xb1, 0x32, 0x98, 0xe6, 0xaa, 0x6f,
                0xb1, 0x43, 0xef, 0x4d, 0x59, 0xa1, 0x49, 0x46, 0x17, 0x59, 0x97, 0x47, 0x9d, 0xbc,
                0x2d, 0x1a, 0x3c, 0xd8,
            ]
        );
    }

    #[test]
    fn aes256_cbc_encrypt_decrypt_roundtrip() {
        let key = [0x42u8; 32];
        let iv = [0u8; 16];
        let plaintext = b"sixteen bytes!!";
        let ct = aes256_cbc_encrypt(&key, &iv, plaintext).unwrap();
        let pt = aes256_cbc_decrypt(&key, &iv, &ct).unwrap();
        assert_eq!(&pt[..plaintext.len()], plaintext);
    }

    #[test]
    fn aes256_cbc_raw_roundtrip() {
        let key = [0x42u8; 32];
        let iv = [0u8; 16];
        let plaintext = [0xAA; 32];
        let ct = aes256_cbc_encrypt_raw(&key, &iv, &plaintext).unwrap();
        let pt = aes256_cbc_decrypt_raw(&key, &iv, &ct).unwrap();
        assert_eq!(&pt[..32], &plaintext);
    }

    #[test]
    fn sign_verify_roundtrip() {
        struct Rng(u64);
        impl Entropy for Rng {
            fn fill_random(&mut self, buf: &mut [u8]) {
                for b in buf.iter_mut() {
                    self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1);
                    *b = (self.0 >> 33) as u8;
                }
            }
        }
        let mut rng = Rng(42);
        let (priv_key, vk) = generate_keypair(&mut rng);
        let data = b"test message to sign";
        let sig_bytes = sign(&priv_key, data).unwrap();
        use p256::ecdsa::{signature::Verifier, DerSignature};
        let sig = DerSignature::from_bytes(&sig_bytes).unwrap();
        assert!(vk.verify(data, &sig).is_ok());
    }

    #[test]
    fn sign_rejects_wrong_data() {
        struct Rng(u64);
        impl Entropy for Rng {
            fn fill_random(&mut self, buf: &mut [u8]) {
                for b in buf.iter_mut() {
                    self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1);
                    *b = (self.0 >> 33) as u8;
                }
            }
        }
        let mut rng = Rng(42);
        let (priv_key, vk) = generate_keypair(&mut rng);
        let sig_bytes = sign(&priv_key, b"original").unwrap();
        use p256::ecdsa::{signature::Verifier, DerSignature};
        let sig = DerSignature::from_bytes(&sig_bytes).unwrap();
        assert!(vk.verify(b"tampered", &sig).is_err());
    }
}
