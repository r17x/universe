use types::channel::{CounterSnapshotSender, ForwardEventSender};
use types::{CounterSnapshot, ForwardEvent, PeerId};
use sysctl::Sysctl;
use tokio::time::{interval, Duration};

#[cfg(target_os = "linux")]
const SYSCTL_IP_FORWARD: &str = "net.ipv4.ip_forward";

#[cfg(target_os = "macos")]
const SYSCTL_IP_FORWARD: &str = "net.inet.ip.forwarding";

#[derive(Debug, thiserror::Error)]
pub enum ForwardError {
    #[error("sysctl error: {0}")]
    SysctlError(String),
    #[error("counter read error: {0}")]
    CounterReadError(String),
    #[error("channel send error")]
    ChannelError,
}

impl From<sysctl::SysctlError> for ForwardError {
    fn from(e: sysctl::SysctlError) -> Self {
        ForwardError::SysctlError(e.to_string())
    }
}

pub struct Forward {
    interface_name: String,
    peer_id: PeerId,
    counter_tx: CounterSnapshotSender,
    event_tx: ForwardEventSender,
}

impl Forward {
    pub fn new(
        interface_name: String,
        peer_id: PeerId,
        counter_tx: CounterSnapshotSender,
        event_tx: ForwardEventSender,
    ) -> Self {
        Self {
            interface_name,
            peer_id,
            counter_tx,
            event_tx,
        }
    }

    pub async fn run(
        self,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> Result<(), ForwardError> {
        let ctl = sysctl::Ctl::new(SYSCTL_IP_FORWARD)?;
        let original = ctl.value_string()?;

        ctl.set_value_string("1")?;
        tracing::info!(interface = %self.interface_name, "IP forwarding enabled");

        self.event_tx
            .send(ForwardEvent::ForwardingEnabled)
            .await
            .map_err(|_| ForwardError::ChannelError)?;

        let mut ticker = interval(Duration::from_secs(1));

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    match read_counters(&self.interface_name).await {
                        Ok((bytes_in, bytes_out, packets_in, packets_out)) => {
                            let snapshot = CounterSnapshot {
                                peer_id: self.peer_id.clone(),
                                bytes_in,
                                bytes_out,
                                packets_in,
                                packets_out,
                            };
                            let _ = self.counter_tx.send(Some(snapshot.clone()));
                            let _ = self.event_tx.send(ForwardEvent::CounterUpdate(snapshot)).await;
                        }
                        Err(e) => {
                            tracing::warn!(error = %e, "failed to read interface counters");
                        }
                    }
                }
                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        break;
                    }
                }
            }
        }

        ctl.set_value_string(&original)?;
        tracing::info!(interface = %self.interface_name, "IP forwarding restored");

        self.event_tx
            .send(ForwardEvent::ForwardingDisabled)
            .await
            .map_err(|_| ForwardError::ChannelError)?;

        Ok(())
    }
}

#[cfg(target_os = "linux")]
async fn read_counters(iface: &str) -> Result<(u64, u64, u64, u64), ForwardError> {
    let base = format!("/sys/class/net/{}/statistics", iface);

    let rx_bytes = read_sysfs_u64(&format!("{}/rx_bytes", base)).await?;
    let tx_bytes = read_sysfs_u64(&format!("{}/tx_bytes", base)).await?;
    let rx_packets = read_sysfs_u64(&format!("{}/rx_packets", base)).await?;
    let tx_packets = read_sysfs_u64(&format!("{}/tx_packets", base)).await?;

    Ok((rx_bytes, tx_bytes, rx_packets, tx_packets))
}

#[cfg(target_os = "linux")]
async fn read_sysfs_u64(path: &str) -> Result<u64, ForwardError> {
    let raw = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| ForwardError::CounterReadError(e.to_string()))?;
    raw.trim()
        .parse::<u64>()
        .map_err(|e| ForwardError::CounterReadError(e.to_string()))
}

#[cfg(target_os = "macos")]
async fn read_counters(iface: &str) -> Result<(u64, u64, u64, u64), ForwardError> {
    let output = tokio::process::Command::new("netstat")
        .args(["-ib", "-I", iface])
        .output()
        .await
        .map_err(|e| ForwardError::CounterReadError(e.to_string()))?;

    if !output.status.success() {
        return Err(ForwardError::CounterReadError(format!(
            "netstat exited with status {}",
            output.status
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_netstat_counters(&stdout, iface)
}

#[cfg(target_os = "macos")]
fn parse_netstat_counters(output: &str, iface: &str) -> Result<(u64, u64, u64, u64), ForwardError> {
    for line in output.lines().skip(1) {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.is_empty() || fields[0] != iface {
            continue;
        }
        if fields.len() < 11 {
            continue;
        }
        let ipkts = fields[4]
            .parse::<u64>()
            .map_err(|e| ForwardError::CounterReadError(e.to_string()))?;
        let ibytes = fields[6]
            .parse::<u64>()
            .map_err(|e| ForwardError::CounterReadError(e.to_string()))?;
        let opkts = fields[7]
            .parse::<u64>()
            .map_err(|e| ForwardError::CounterReadError(e.to_string()))?;
        let obytes = fields[9]
            .parse::<u64>()
            .map_err(|e| ForwardError::CounterReadError(e.to_string()))?;
        return Ok((ibytes, obytes, ipkts, opkts));
    }
    Err(ForwardError::CounterReadError(format!(
        "interface {} not found in netstat output",
        iface
    )))
}
