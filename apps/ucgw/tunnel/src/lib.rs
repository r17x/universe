use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::sync::Arc;

use bytes::{BufMut, BytesMut};
use iroh::endpoint::{Connection, RecvStream, SendStream};
use tokio::sync::{mpsc, watch, Mutex};
use tracing::{debug, warn};

#[derive(Debug, thiserror::Error)]
pub enum TunnelError {
    #[error("tun device error: {0}")]
    TunError(#[from] tun::Error),
    #[error("connection error: {0}")]
    ConnectionError(#[from] iroh::endpoint::ConnectionError),
    #[error("stream error")]
    StreamError,
    #[error("peer not found")]
    PeerNotFound,
}

impl From<iroh::endpoint::WriteError> for TunnelError {
    fn from(_: iroh::endpoint::WriteError) -> Self {
        TunnelError::StreamError
    }
}

impl From<iroh::endpoint::ReadExactError> for TunnelError {
    fn from(_: iroh::endpoint::ReadExactError) -> Self {
        TunnelError::StreamError
    }
}

struct PeerTunnel {
    peer_id: types::PeerId,
    inner_address: Ipv4Addr,
    connection: Connection,
}

enum PeerCommand {
    Add(PeerTunnel),
    Remove(types::PeerId),
}

struct PeerEntry {
    inner_address: Ipv4Addr,
}

#[derive(Clone)]
pub struct TunnelHandle {
    peer_tx: mpsc::Sender<PeerCommand>,
}

impl TunnelHandle {
    pub async fn add_peer(
        &self,
        peer_id: types::PeerId,
        inner_address: Ipv4Addr,
        connection: Connection,
    ) -> Result<(), TunnelError> {
        self.peer_tx
            .send(PeerCommand::Add(PeerTunnel {
                peer_id,
                inner_address,
                connection,
            }))
            .await
            .map_err(|_| TunnelError::StreamError)
    }

    pub async fn remove_peer(&self, peer_id: &types::PeerId) -> Result<(), TunnelError> {
        self.peer_tx
            .send(PeerCommand::Remove(peer_id.clone()))
            .await
            .map_err(|_| TunnelError::StreamError)
    }
}

pub struct Tunnel {
    tun_address: Ipv4Addr,
    tun_netmask: Ipv4Addr,
    peer_tx: mpsc::Sender<PeerCommand>,
    peer_rx: Arc<Mutex<mpsc::Receiver<PeerCommand>>>,
}

impl Tunnel {
    pub fn new(tun_address: Ipv4Addr, tun_netmask: Ipv4Addr) -> Self {
        let (peer_tx, peer_rx) = mpsc::channel(64);
        Self {
            tun_address,
            tun_netmask,
            peer_tx,
            peer_rx: Arc::new(Mutex::new(peer_rx)),
        }
    }

    pub fn handle(&self) -> TunnelHandle {
        TunnelHandle {
            peer_tx: self.peer_tx.clone(),
        }
    }

    pub async fn run(self, mut shutdown: watch::Receiver<bool>) -> Result<(), TunnelError> {
        let mut tun_config = tun::Configuration::default();
        tun_config
            .address(self.tun_address)
            .netmask(self.tun_netmask)
            .up();

        #[cfg(target_os = "linux")]
        tun_config.platform_config(|c| {
            c.ensure_root_privileges(true);
        });

        let dev = Arc::new(tun::create_as_async(&tun_config)?);

        let ip_table: Arc<Mutex<HashMap<Ipv4Addr, mpsc::Sender<bytes::Bytes>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        let (tun_pkt_tx, mut tun_pkt_rx) = mpsc::channel::<(Ipv4Addr, bytes::Bytes)>(256);

        let tun_reader = dev.clone();
        tokio::spawn(async move {
            let mut buf = vec![0u8; 2048];
            loop {
                match tun_reader.recv(&mut buf).await {
                    Ok(n) if n >= 20 => {
                        let pkt = bytes::Bytes::copy_from_slice(&buf[..n]);
                        if let Some(dst) = parse_ipv4_dst(&pkt) {
                            let _ = tun_pkt_tx.send((dst, pkt)).await;
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        warn!("tun read: {}", e);
                        break;
                    }
                }
            }
        });

        let ip_table_dispatch = ip_table.clone();
        tokio::spawn(async move {
            while let Some((dst, pkt)) = tun_pkt_rx.recv().await {
                let maybe_tx = ip_table_dispatch.lock().await.get(&dst).cloned();
                if let Some(tx) = maybe_tx {
                    let _ = tx.send(pkt).await;
                } else {
                    debug!("no peer for {}, dropping", dst);
                }
            }
        });

        let mut peers: HashMap<types::PeerId, PeerEntry> = HashMap::new();
        let mut peer_rx = self.peer_rx.lock().await;

        loop {
            tokio::select! {
                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        break;
                    }
                }
                cmd = peer_rx.recv() => {
                    match cmd {
                        None => break,
                        Some(PeerCommand::Remove(peer_id)) => {
                            if let Some(entry) = peers.remove(&peer_id) {
                                ip_table.lock().await.remove(&entry.inner_address);
                            }
                        }
                        Some(PeerCommand::Add(tunnel)) => {
                            let (outbound_tx, outbound_rx) = mpsc::channel::<bytes::Bytes>(256);
                            let entry = PeerEntry {
                                inner_address: tunnel.inner_address,
                            };
                            ip_table.lock().await.insert(tunnel.inner_address, outbound_tx);
                            peers.insert(tunnel.peer_id.clone(), entry);

                            let conn = tunnel.connection.clone();
                            let inner_addr = tunnel.inner_address;
                            let ip_table_rm = ip_table.clone();
                            let tun = dev.clone();
                            tokio::spawn(async move {
                                if let Err(e) = run_peer(conn, outbound_rx, tun).await {
                                    warn!("peer {} error: {}", inner_addr, e);
                                }
                                ip_table_rm.lock().await.remove(&inner_addr);
                            });
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

pub(crate) fn parse_ipv4_dst(pkt: &[u8]) -> Option<Ipv4Addr> {
    if pkt.len() < 20 {
        return None;
    }
    if (pkt[0] >> 4) != 4 {
        return None;
    }
    Some(Ipv4Addr::new(pkt[16], pkt[17], pkt[18], pkt[19]))
}

async fn run_peer(
    conn: Connection,
    mut outbound_rx: mpsc::Receiver<bytes::Bytes>,
    tun: Arc<tun::AsyncDevice>,
) -> Result<(), TunnelError> {
    let (mut send, mut recv) = conn.open_bi().await?;

    tokio::select! {
        r = quic_to_tun(&mut recv, tun) => r,
        r = tun_to_quic(&mut send, &mut outbound_rx) => r,
    }
}

async fn quic_to_tun(recv: &mut RecvStream, tun: Arc<tun::AsyncDevice>) -> Result<(), TunnelError> {
    let mut len_buf = [0u8; 2];
    loop {
        if recv.read_exact(&mut len_buf).await.is_err() {
            break;
        }
        let pkt_len = u16::from_be_bytes(len_buf) as usize;
        if pkt_len == 0 {
            break;
        }
        let mut pkt_buf = vec![0u8; pkt_len];
        recv.read_exact(&mut pkt_buf).await?;
        tun.send(&pkt_buf).await.map_err(|_| TunnelError::StreamError)?;
    }
    Ok(())
}

async fn tun_to_quic(
    send: &mut SendStream,
    outbound_rx: &mut mpsc::Receiver<bytes::Bytes>,
) -> Result<(), TunnelError> {
    let mut frame = BytesMut::with_capacity(2050);
    while let Some(pkt) = outbound_rx.recv().await {
        let pkt_len = pkt.len();
        if pkt_len > u16::MAX as usize {
            continue;
        }
        frame.clear();
        frame.put_u16(pkt_len as u16);
        frame.put_slice(&pkt);
        send.write_all(&frame).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::{BufMut, BytesMut};

    fn make_ipv4_pkt(dst: std::net::Ipv4Addr) -> Vec<u8> {
        let mut pkt = vec![0u8; 20];
        pkt[0] = 0x45;
        let octets = dst.octets();
        pkt[16] = octets[0];
        pkt[17] = octets[1];
        pkt[18] = octets[2];
        pkt[19] = octets[3];
        pkt
    }

    #[test]
    fn parse_ipv4_dst_extracts_bytes_16_to_19() {
        let dst: std::net::Ipv4Addr = "192.168.50.100".parse().unwrap();
        let pkt = make_ipv4_pkt(dst);
        assert_eq!(parse_ipv4_dst(&pkt), Some(dst));
    }

    #[test]
    fn parse_ipv4_dst_returns_none_for_short_packet() {
        assert_eq!(parse_ipv4_dst(&[0x45; 19]), None);
        assert_eq!(parse_ipv4_dst(&[]), None);
    }

    #[test]
    fn parse_ipv4_dst_returns_none_for_non_ipv4() {
        let mut pkt = make_ipv4_pkt("10.0.0.1".parse().unwrap());
        pkt[0] = 0x60;
        assert_eq!(parse_ipv4_dst(&pkt), None);
    }

    #[test]
    fn length_prefix_frame_encoding_roundtrip() {
        let payload = b"hello tunnel";
        let mut frame = BytesMut::new();
        frame.put_u16(payload.len() as u16);
        frame.put_slice(payload);
        let encoded = frame.freeze();
        let len = u16::from_be_bytes([encoded[0], encoded[1]]) as usize;
        assert_eq!(len, payload.len());
        assert_eq!(&encoded[2..], payload);
    }

    #[test]
    fn zero_length_frame_encodes_cleanly() {
        let mut frame = BytesMut::new();
        frame.put_u16(0u16);
        let encoded = frame.freeze();
        assert_eq!(encoded.len(), 2);
        let len = u16::from_be_bytes([encoded[0], encoded[1]]);
        assert_eq!(len, 0);
    }

    #[test]
    fn max_length_frame_encodes_correctly() {
        let payload = vec![0xFFu8; u16::MAX as usize];
        let mut frame = BytesMut::new();
        frame.put_u16(u16::MAX);
        frame.put_slice(&payload);
        let encoded = frame.freeze();
        let len = u16::from_be_bytes([encoded[0], encoded[1]]) as usize;
        assert_eq!(len, u16::MAX as usize);
        assert_eq!(encoded.len(), 2 + u16::MAX as usize);
    }
}
