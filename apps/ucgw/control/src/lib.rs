use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::str::FromStr;

use base64::Engine;
use types::channel::AdmissionReceiver;
use types::{AdmissionDecision, Allowlist, PeerId};
use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::Deserialize;

#[derive(Debug, thiserror::Error)]
pub enum ControlError {
    #[error("config error: {0}")]
    ConfigError(String),
    #[error("watch error: {0}")]
    WatchError(String),
    #[error("metrics error: {0}")]
    MetricsError(String),
    #[error("admission error: {0}")]
    AdmissionError(String),
    #[error("channel error: {0}")]
    ChannelError(String),
}

impl From<std::io::Error> for ControlError {
    fn from(e: std::io::Error) -> Self {
        ControlError::ConfigError(e.to_string())
    }
}

impl From<toml::de::Error> for ControlError {
    fn from(e: toml::de::Error) -> Self {
        ControlError::ConfigError(e.to_string())
    }
}

impl From<notify::Error> for ControlError {
    fn from(e: notify::Error) -> Self {
        ControlError::WatchError(e.to_string())
    }
}

impl From<metrics_exporter_prometheus::BuildError> for ControlError {
    fn from(e: metrics_exporter_prometheus::BuildError) -> Self {
        ControlError::MetricsError(e.to_string())
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct GatewayConfig {
    pub gateway: GatewaySection,
    pub network: NetworkSection,
    pub overlay: OverlaySection,
    pub admission: AdmissionSection,
    pub metrics: MetricsSection,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GatewaySection {
    pub upstream_interface: Option<String>,
    #[serde(default)]
    pub upstream_device_vendor: Option<u16>,
    #[serde(default)]
    pub upstream_device_product: Option<u16>,
    #[serde(default)]
    pub dry_run: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NetworkSection {
    pub consumer_subnet: String,
    pub consumer_gateway: String,
    pub dns_listen: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OverlaySection {
    pub enabled: bool,
    pub secret_key_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AdmissionSection {
    pub mode: String,
    pub peers: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MetricsSection {
    pub enabled: bool,
    pub bind_address: String,
}

pub(crate) fn parse_config(path: &PathBuf) -> Result<GatewayConfig, ControlError> {
    let content = std::fs::read_to_string(path)?;
    let config: GatewayConfig = toml::from_str(&content)?;
    Ok(config)
}

pub(crate) fn build_allowlist(section: &AdmissionSection) -> Allowlist {
    let peers = section
        .peers
        .iter()
        .filter_map(|s| {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(s)
                .ok()?;
            if bytes.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                Some(PeerId(arr))
            } else {
                None
            }
        })
        .collect();
    Allowlist { peers }
}

pub struct Control {
    config_path: PathBuf,
    config: GatewayConfig,
    admission_rx: AdmissionReceiver,
}

impl Control {
    pub fn new(config_path: PathBuf, admission_rx: AdmissionReceiver) -> Result<Self, ControlError> {
        let config = parse_config(&config_path)?;
        Ok(Self {
            config_path,
            config,
            admission_rx,
        })
    }

    pub fn config(&self) -> &GatewayConfig {
        &self.config
    }

    pub async fn run(
        mut self,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> Result<(), ControlError> {
        if self.config.metrics.enabled {
            let bind_addr = SocketAddr::from_str(&self.config.metrics.bind_address)
                .map_err(|e| ControlError::MetricsError(e.to_string()))?;
            metrics_exporter_prometheus::PrometheusBuilder::new()
                .with_http_listener(bind_addr)
                .install()?;
        }

        #[cfg(target_os = "linux")]
        {
            sd_notify::notify(&[sd_notify::NotifyState::Ready])
                .map_err(|e| ControlError::ConfigError(e.to_string()))?;
        }

        let (watch_tx, mut watch_rx) = tokio::sync::mpsc::channel::<()>(4);

        let mut watcher =
            notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if matches!(event.kind, EventKind::Modify(_)) {
                        let _ = watch_tx.try_send(());
                    }
                }
            })?;
        watcher.watch(&self.config_path.clone(), RecursiveMode::NonRecursive)?;

        let mut current_allowlist = build_allowlist(&self.config.admission);
        let mut current_mode = self.config.admission.mode.clone();
        let mut ip_counter: u32 = 2;
        let mut admitted_peers: HashMap<[u8; 32], Ipv4Addr> = HashMap::new();

        tracing::info!(
            config = %self.config_path.display(),
            metrics_enabled = self.config.metrics.enabled,
            "d11-control started"
        );

        loop {
            tokio::select! {
                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        tracing::info!("d11-control shutting down");
                        break;
                    }
                }

                _ = watch_rx.recv() => {
                    while watch_rx.try_recv().is_ok() {}
                    match parse_config(&self.config_path) {
                        Ok(new_config) => {
                            current_allowlist = build_allowlist(&new_config.admission);
                            current_mode = new_config.admission.mode.clone();
                            self.config = new_config;
                            tracing::info!("config reloaded");
                        }
                        Err(e) => {
                            tracing::error!(error = %e, "failed to reload config");
                        }
                    }
                }

                req = self.admission_rx.recv() => {
                    match req {
                        None => {
                            tracing::warn!("admission channel closed");
                            break;
                        }
                        Some(admission_req) => {
                            let admitted = current_mode == "open"
                                || current_allowlist.contains(&admission_req.peer_id);

                            if admitted {
                                let inner_address = if let Some(&addr) =
                                    admitted_peers.get(&admission_req.peer_id.0)
                                {
                                    addr
                                } else {
                                    let last_octet = u8::try_from(ip_counter)
                                        .unwrap_or(u8::MAX);
                                    let addr = Ipv4Addr::new(10, 0, 0, last_octet);
                                    if ip_counter < u32::from(u8::MAX) {
                                        ip_counter += 1;
                                    }
                                    admitted_peers.insert(admission_req.peer_id.0, addr);
                                    addr
                                };

                                metrics::gauge!("ucgw_active_peers")
                                    .set(admitted_peers.len() as f64);

                                tracing::debug!(
                                    peer = ?admission_req.peer_id,
                                    inner_address = %inner_address,
                                    "peer admitted"
                                );

                                let _ = admission_req
                                    .response
                                    .send(AdmissionDecision::Admitted { inner_address });
                            } else {
                                tracing::debug!(
                                    peer = ?admission_req.peer_id,
                                    "peer denied"
                                );

                                let _ = admission_req.response.send(AdmissionDecision::Denied {
                                    reason: "peer not in allowlist".to_string(),
                                });
                            }

                            metrics::counter!("ucgw_admission_requests_total").increment(1);
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn valid_toml() -> &'static str {
        r#"
[gateway]
upstream_interface = "en8"

[network]
consumer_subnet = "192.168.100.0/24"
consumer_gateway = "192.168.100.1"
dns_listen = "192.168.100.1:53"

[overlay]
enabled = false

[admission]
mode = "allowlist"
peers = []

[metrics]
enabled = false
bind_address = "127.0.0.1:9090"
"#
    }

    fn write_toml(content: &str) -> NamedTempFile {
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(content.as_bytes()).unwrap();
        f
    }

    #[test]
    fn parses_full_config() {
        let f = write_toml(valid_toml());
        let config = parse_config(&f.path().to_path_buf()).unwrap();
        assert_eq!(config.gateway.upstream_interface.as_deref(), Some("en8"));
        assert_eq!(config.network.consumer_subnet, "192.168.100.0/24");
        assert!(!config.overlay.enabled);
        assert_eq!(config.admission.mode, "allowlist");
        assert!(!config.metrics.enabled);
    }

    #[test]
    fn parse_error_on_bad_toml() {
        let f = write_toml("not valid toml @@@@");
        let result = parse_config(&f.path().to_path_buf());
        assert!(result.is_err());
    }

    #[test]
    fn build_allowlist_with_valid_peers() {
        let peer_bytes = [0xABu8; 32];
        let encoded = base64::engine::general_purpose::STANDARD.encode(peer_bytes);
        let section = AdmissionSection {
            mode: "allowlist".to_string(),
            peers: vec![encoded],
        };
        let list = build_allowlist(&section);
        assert_eq!(list.peers.len(), 1);
        assert_eq!(list.peers[0].0, peer_bytes);
    }

    #[test]
    fn build_allowlist_skips_invalid_base64() {
        let section = AdmissionSection {
            mode: "allowlist".to_string(),
            peers: vec!["not base64 !!!".to_string()],
        };
        let list = build_allowlist(&section);
        assert!(list.peers.is_empty());
    }

    #[test]
    fn build_allowlist_skips_wrong_length() {
        let too_short = base64::engine::general_purpose::STANDARD.encode([0u8; 16]);
        let section = AdmissionSection {
            mode: "allowlist".to_string(),
            peers: vec![too_short],
        };
        let list = build_allowlist(&section);
        assert!(list.peers.is_empty());
    }

    #[test]
    fn build_allowlist_empty() {
        let section = AdmissionSection {
            mode: "open".to_string(),
            peers: vec![],
        };
        let list = build_allowlist(&section);
        assert!(list.peers.is_empty());
    }
}
