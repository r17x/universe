use std::{
    collections::HashMap,
    sync::Arc,
};

use iroh::{
    Endpoint,
    endpoint::{Connection, ConnectingError, ConnectionError, presets},
};
use thiserror::Error;
use tokio::sync::{RwLock, watch};
use tracing::{debug, warn};

use types::{
    AdmissionDecision, AdmissionRequest, Allowlist, OverlayEvent, PeerId,
    channel::{AdmissionSender, OverlayEventSender},
};
use types_overlay::{AdmittedPeer, OverlayHandle, TUNNEL_ALPN};
use types_overlay::channel::AdmittedPeerSender;

#[derive(Debug, Error)]
pub enum OverlayError {
    #[error("endpoint error: {0}")]
    EndpointError(#[from] iroh::endpoint::BindError),
    #[error("connection error: {0}")]
    ConnectionError(#[from] ConnectionError),
    #[error("connecting error: {0}")]
    ConnectingError(#[from] ConnectingError),
    #[error("admission channel closed")]
    AdmissionError,
    #[error("event channel closed")]
    ChannelError,
}

type PeerMap = Arc<RwLock<HashMap<PeerId, Connection>>>;

pub struct Overlay {
    allowlist: Allowlist,
    event_tx: OverlayEventSender,
    admission_tx: AdmissionSender,
    admitted_peer_tx: AdmittedPeerSender,
    handle: Option<OverlayHandle>,
    peers: PeerMap,
}

impl Overlay {
    pub fn new(
        allowlist: Allowlist,
        event_tx: OverlayEventSender,
        admission_tx: AdmissionSender,
        admitted_peer_tx: AdmittedPeerSender,
    ) -> Self {
        Self {
            allowlist,
            event_tx,
            admission_tx,
            admitted_peer_tx,
            handle: None,
            peers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn start(&mut self) -> Result<OverlayHandle, OverlayError> {
        let endpoint = Endpoint::builder(presets::N0)
            .alpns(vec![TUNNEL_ALPN.to_vec()])
            .bind()
            .await?;
        let handle = OverlayHandle::new(endpoint);
        self.handle = Some(handle.clone());
        Ok(handle)
    }

    pub async fn run(self, mut shutdown: watch::Receiver<bool>) -> Result<(), OverlayError> {
        let endpoint = match self.handle {
            Some(h) => h.endpoint,
            None => {
                Endpoint::builder(presets::N0)
                    .alpns(vec![TUNNEL_ALPN.to_vec()])
                    .bind()
                    .await?
            }
        };

        loop {
            tokio::select! {
                biased;
                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        break;
                    }
                }
                incoming = endpoint.accept() => {
                    let Some(incoming) = incoming else {
                        break;
                    };
                    let accepting = match incoming.accept() {
                        Ok(a) => a,
                        Err(err) => {
                            warn!("accept handshake error: {err}");
                            continue;
                        }
                    };
                    let connection = match accepting.await {
                        Ok(c) => c,
                        Err(err) => {
                            warn!("connecting error: {err}");
                            continue;
                        }
                    };
                    let peer_id = endpoint_id_to_peer_id(&connection.remote_id());
                    if !self.allowlist.peers.is_empty() && !self.allowlist.contains(&peer_id) {
                        debug!("peer not in allowlist, closing");
                        connection.close(1u8.into(), b"not allowed");
                        continue;
                    }
                    let (response_tx, response_rx) = tokio::sync::oneshot::channel();
                    let req = AdmissionRequest {
                        peer_id: peer_id.clone(),
                        response: response_tx,
                    };
                    if self.admission_tx.send(req).await.is_err() {
                        return Err(OverlayError::AdmissionError);
                    }
                    let decision = match response_rx.await {
                        Ok(d) => d,
                        Err(_) => {
                            warn!("admission response dropped");
                            continue;
                        }
                    };
                    match decision {
                        AdmissionDecision::Admitted { inner_address } => {
                            self.peers.write().await.insert(peer_id.clone(), connection.clone());
                            if self.event_tx.send(OverlayEvent::PeerConnected(peer_id.clone())).await.is_err() {
                                return Err(OverlayError::ChannelError);
                            }
                            let _ = self.admitted_peer_tx.send(AdmittedPeer {
                                peer_id: peer_id.clone(),
                                inner_address,
                                connection: connection.clone(),
                            }).await;
                            let peers = self.peers.clone();
                            let event_tx = self.event_tx.clone();
                            tokio::spawn(monitor_peer(peer_id, connection, peers, event_tx));
                        }
                        AdmissionDecision::Denied { reason } => {
                            debug!("peer denied: {reason}");
                            connection.close(2u8.into(), b"denied");
                        }
                    }
                }
            }
        }

        endpoint.close().await;
        Ok(())
    }
}

fn endpoint_id_to_peer_id(id: &iroh::EndpointId) -> PeerId {
    PeerId(*id.as_bytes())
}

async fn monitor_peer(
    peer_id: PeerId,
    connection: Connection,
    peers: PeerMap,
    event_tx: OverlayEventSender,
) {
    connection.closed().await;
    peers.write().await.remove(&peer_id);
    if event_tx
        .send(OverlayEvent::PeerDisconnected(peer_id))
        .await
        .is_err()
    {
        warn!("event channel closed on peer disconnect");
    }
}
