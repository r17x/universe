use std::net::Ipv4Addr;

use iroh::Endpoint;
use iroh::endpoint::Connection;

pub const TUNNEL_ALPN: &[u8] = b"/gw/tunnel/0";

#[derive(Debug, Clone)]
pub struct OverlayHandle {
    pub endpoint: Endpoint,
}

impl OverlayHandle {
    pub fn new(endpoint: Endpoint) -> Self {
        Self { endpoint }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PeerAnnouncement {
    pub peer_id: types::PeerId,
    pub timestamp_secs: u64,
    pub signature: Vec<u8>,
}

pub struct AdmittedPeer {
    pub peer_id: types::PeerId,
    pub inner_address: Ipv4Addr,
    pub connection: Connection,
}

pub mod channel {
    pub type AdmittedPeerSender = tokio::sync::mpsc::Sender<super::AdmittedPeer>;
    pub type AdmittedPeerReceiver = tokio::sync::mpsc::Receiver<super::AdmittedPeer>;
}
