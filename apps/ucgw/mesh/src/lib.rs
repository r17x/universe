use std::{
    future::poll_fn,
    pin::pin,
    task::Poll,
    time::{SystemTime, UNIX_EPOCH},
};

use bytes::Bytes;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use iroh::EndpointId;
use futures_core::stream::Stream;
use iroh_gossip::{api::Event, net::Gossip, proto::TopicId};
use tokio::{
    sync::{mpsc, watch},
    time::{interval, Duration},
};
use tracing::{debug, warn};

#[derive(Debug, thiserror::Error)]
pub enum MeshError {
    #[error("gossip error: {0}")]
    GossipError(#[from] iroh_gossip::api::ApiError),
    #[error("signature error: {0}")]
    SignatureError(#[from] ed25519_dalek::SignatureError),
    #[error("serialization error: invalid announcement length {0}")]
    SerializationError(usize),
    #[error("channel closed")]
    ChannelError,
}

#[derive(Debug, Clone)]
pub struct DiscoveredPeer {
    pub peer_id: types::PeerId,
    pub endpoint_id: EndpointId,
    pub timestamp_secs: u64,
}

pub struct Mesh {
    gossip: Gossip,
    signing_key: SigningKey,
    bootstrap_peers: Vec<EndpointId>,
    peer_tx: mpsc::Sender<DiscoveredPeer>,
}

impl Mesh {
    pub fn new(
        gossip: Gossip,
        signing_key: SigningKey,
        bootstrap_peers: Vec<EndpointId>,
        peer_tx: mpsc::Sender<DiscoveredPeer>,
    ) -> Self {
        Self {
            gossip,
            signing_key,
            bootstrap_peers,
            peer_tx,
        }
    }

    pub async fn run(self, mut shutdown: watch::Receiver<bool>) -> Result<(), MeshError> {
        let topic = mesh_topic();
        let topic_handle = self
            .gossip
            .subscribe_and_join(topic, self.bootstrap_peers)
            .await?;
        let (sender, receiver) = topic_handle.split();

        let our_peer_id = types::PeerId(*self.signing_key.verifying_key().as_bytes());
        let mut announce_interval = interval(Duration::from_secs(30));
        let mut receiver = pin!(receiver);

        loop {
            tokio::select! {
                biased;

                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        break;
                    }
                }

                _ = announce_interval.tick() => {
                    let announcement = build_announcement(&self.signing_key, &our_peer_id)?;
                    let payload = serialize_announcement(&announcement);
                    if let Err(err) = sender.broadcast(Bytes::from(payload)).await {
                        warn!("broadcast failed: {err}");
                    }
                }

                item = poll_fn(|cx| {
                    match receiver.as_mut().poll_next(cx) {
                        Poll::Ready(v) => Poll::Ready(v),
                        Poll::Pending => Poll::Pending,
                    }
                }) => {
                    match item {
                        None => break,
                        Some(Err(err)) => {
                            warn!("gossip stream error: {err}");
                        }
                        Some(Ok(Event::NeighborUp(endpoint_id))) => {
                            debug!(peer = %endpoint_id.fmt_short(), "neighbor up");
                        }
                        Some(Ok(Event::NeighborDown(endpoint_id))) => {
                            debug!(peer = %endpoint_id.fmt_short(), "neighbor down");
                        }
                        Some(Ok(Event::Received(msg))) => {
                            match deserialize_and_verify(&msg.content) {
                                Err(err) => {
                                    warn!("invalid announcement from {}: {err}", msg.delivered_from.fmt_short());
                                }
                                Ok(announcement) => {
                                    let discovered = DiscoveredPeer {
                                        peer_id: announcement.peer_id,
                                        endpoint_id: msg.delivered_from,
                                        timestamp_secs: announcement.timestamp_secs,
                                    };
                                    if self.peer_tx.send(discovered).await.is_err() {
                                        return Err(MeshError::ChannelError);
                                    }
                                }
                            }
                        }
                        Some(Ok(Event::Lagged)) => {
                            warn!("gossip receiver lagged, some announcements may have been missed");
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

fn mesh_topic() -> TopicId {
    let mut bytes = [0u8; 32];
    bytes[..12].copy_from_slice(b"ucgw/mesh/v0");
    TopicId::from_bytes(bytes)
}

fn current_timestamp_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub(crate) fn sign_announcement(signing_key: &SigningKey, peer_id: &types::PeerId, timestamp_secs: u64) -> Signature {
    let mut msg = [0u8; 40];
    msg[..32].copy_from_slice(&peer_id.0);
    msg[32..].copy_from_slice(&timestamp_secs.to_be_bytes());
    signing_key.sign(&msg)
}

pub(crate) fn build_announcement(
    signing_key: &SigningKey,
    peer_id: &types::PeerId,
) -> Result<types_overlay::PeerAnnouncement, MeshError> {
    let timestamp_secs = current_timestamp_secs();
    let signature = sign_announcement(signing_key, peer_id, timestamp_secs);
    Ok(types_overlay::PeerAnnouncement {
        peer_id: peer_id.clone(),
        timestamp_secs,
        signature: signature.to_bytes().to_vec(),
    })
}

pub(crate) fn serialize_announcement(announcement: &types_overlay::PeerAnnouncement) -> Vec<u8> {
    let mut buf = Vec::with_capacity(40 + announcement.signature.len());
    buf.extend_from_slice(&announcement.peer_id.0);
    buf.extend_from_slice(&announcement.timestamp_secs.to_be_bytes());
    buf.extend_from_slice(&announcement.signature);
    buf
}

pub(crate) fn deserialize_and_verify(
    data: &[u8],
) -> Result<types_overlay::PeerAnnouncement, MeshError> {
    if data.len() < 40 {
        return Err(MeshError::SerializationError(data.len()));
    }
    let mut peer_id_bytes = [0u8; 32];
    peer_id_bytes.copy_from_slice(&data[..32]);

    let mut ts_bytes = [0u8; 8];
    ts_bytes.copy_from_slice(&data[32..40]);
    let timestamp_secs = u64::from_be_bytes(ts_bytes);

    let signature_bytes = &data[40..];
    if signature_bytes.len() != 64 {
        return Err(MeshError::SerializationError(data.len()));
    }
    let mut sig_array = [0u8; 64];
    sig_array.copy_from_slice(signature_bytes);

    let verifying_key = VerifyingKey::from_bytes(&peer_id_bytes)?;
    let signature = Signature::from_bytes(&sig_array);

    let mut msg = [0u8; 40];
    msg[..32].copy_from_slice(&peer_id_bytes);
    msg[32..].copy_from_slice(&ts_bytes);
    verifying_key.verify(&msg, &signature)?;

    Ok(types_overlay::PeerAnnouncement {
        peer_id: types::PeerId(peer_id_bytes),
        timestamp_secs,
        signature: sig_array.to_vec(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;

    fn make_key(seed: u8) -> SigningKey {
        SigningKey::from_bytes(&[seed; 32])
    }

    #[test]
    fn serialization_roundtrip() {
        let key = make_key(1);
        let peer_id = types::PeerId(*key.verifying_key().as_bytes());
        let ann = build_announcement(&key, &peer_id).unwrap();
        let bytes = serialize_announcement(&ann);
        let recovered = deserialize_and_verify(&bytes).unwrap();
        assert_eq!(recovered.peer_id, ann.peer_id);
        assert_eq!(recovered.timestamp_secs, ann.timestamp_secs);
        assert_eq!(recovered.signature, ann.signature);
    }

    #[test]
    fn valid_signature_verifies() {
        let key = make_key(7);
        let peer_id = types::PeerId(*key.verifying_key().as_bytes());
        let ann = build_announcement(&key, &peer_id).unwrap();
        let bytes = serialize_announcement(&ann);
        assert!(deserialize_and_verify(&bytes).is_ok());
    }

    #[test]
    fn invalid_signature_is_rejected() {
        let key = make_key(2);
        let peer_id = types::PeerId(*key.verifying_key().as_bytes());
        let ann = build_announcement(&key, &peer_id).unwrap();
        let mut bytes = serialize_announcement(&ann);
        bytes[40] ^= 0xFF;
        assert!(deserialize_and_verify(&bytes).is_err());
    }

    #[test]
    fn tampered_timestamp_fails_verification() {
        let key = make_key(3);
        let peer_id = types::PeerId(*key.verifying_key().as_bytes());
        let ann = build_announcement(&key, &peer_id).unwrap();
        let mut bytes = serialize_announcement(&ann);
        bytes[35] ^= 0x01;
        assert!(deserialize_and_verify(&bytes).is_err());
    }

    #[test]
    fn too_short_data_returns_error() {
        assert!(deserialize_and_verify(&[0u8; 39]).is_err());
        assert!(deserialize_and_verify(&[]).is_err());
    }

    #[test]
    fn sign_and_verify_directly() {
        let key = make_key(4);
        let peer_id = types::PeerId(*key.verifying_key().as_bytes());
        let ts = 1_700_000_000u64;
        let sig = sign_announcement(&key, &peer_id, ts);
        let verifying_key = key.verifying_key();
        let mut msg = [0u8; 40];
        msg[..32].copy_from_slice(&peer_id.0);
        msg[32..].copy_from_slice(&ts.to_be_bytes());
        assert!(verifying_key.verify(&msg, &sig).is_ok());
    }
}
