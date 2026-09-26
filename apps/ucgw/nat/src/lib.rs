use std::net::Ipv4Addr;

#[derive(Debug, thiserror::Error)]
pub enum NatError {
    #[error("NAT rule install failed: {0}")]
    RuleInstallFailed(String),
    #[error("NAT rule remove failed: {0}")]
    RuleRemoveFailed(String),
    #[error("conntrack flush failed: {0}")]
    ConntrackFlushFailed(String),
    #[error("platform error: {0}")]
    PlatformError(String),
}

pub struct Nat {
    upstream_interface: String,
    consumer_subnet: Ipv4Addr,
    consumer_prefix_len: u8,
    enabled: bool,
}

impl Nat {
    pub fn new(
        upstream_interface: String,
        consumer_subnet: Ipv4Addr,
        consumer_prefix_len: u8,
    ) -> Self {
        Self {
            upstream_interface,
            consumer_subnet,
            consumer_prefix_len,
            enabled: false,
        }
    }

    pub async fn enable(&mut self) -> Result<(), NatError> {
        if self.enabled {
            return Ok(());
        }
        platform::install_nat_rules(
            &self.upstream_interface,
            self.consumer_subnet,
            self.consumer_prefix_len,
        )
        .await?;
        self.enabled = true;
        tracing::info!(interface = %self.upstream_interface, "NAT masquerade enabled");
        Ok(())
    }

    pub async fn disable(&mut self) -> Result<(), NatError> {
        if !self.enabled {
            return Ok(());
        }
        platform::remove_nat_rules(&self.upstream_interface).await?;
        platform::flush_conntrack(&self.upstream_interface).await?;
        self.enabled = false;
        tracing::info!(interface = %self.upstream_interface, "NAT masquerade disabled");
        Ok(())
    }

    pub async fn run(
        mut self,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> Result<(), NatError> {
        self.enable().await?;
        shutdown
            .changed()
            .await
            .map_err(|e| NatError::PlatformError(e.to_string()))?;
        self.disable().await?;
        Ok(())
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::NatError;
    use std::net::Ipv4Addr;

    pub(super) async fn install_nat_rules(
        upstream_interface: &str,
        _consumer_subnet: Ipv4Addr,
        _consumer_prefix_len: u8,
    ) -> Result<(), NatError> {
        use rustables::{
            Batch, Chain, ChainPolicy, ChainPriority, ChainType, Hook, HookClass, MsgType,
            ProtocolFamily, Rule, Table,
        };
        use rustables::expr::{Cmp, CmpOp, Masquerade, Meta, MetaType};

        let iface = upstream_interface.to_owned();

        tokio::task::spawn_blocking(move || {
            let table = Table::new(ProtocolFamily::Ipv4).with_name("gw_nat");

            let mut batch = Batch::new();
            batch.add(&table, MsgType::Add);

            let mut chain = Chain::new(&table).with_name("postrouting");
            chain.set_hook(Hook::new(HookClass::PostRouting, 100 as ChainPriority));
            chain.set_type(ChainType::Nat);
            chain.set_policy(ChainPolicy::Accept);
            batch.add(&chain, MsgType::Add);

            let mut rule =
                Rule::new(&chain).map_err(|e| NatError::RuleInstallFailed(e.to_string()))?;

            let mut iface_bytes = iface.as_bytes().to_vec();
            iface_bytes.push(0);
            rule.add_expr(Meta::new(MetaType::OifName));
            rule.add_expr(Cmp::new(CmpOp::Eq, iface_bytes));
            rule.add_expr(Masquerade::default());
            batch.add(&rule, MsgType::Add);

            batch
                .send()
                .map_err(|e| NatError::RuleInstallFailed(e.to_string()))
        })
        .await
        .map_err(|e| NatError::RuleInstallFailed(e.to_string()))?
    }

    pub(super) async fn remove_nat_rules(_upstream_interface: &str) -> Result<(), NatError> {
        use rustables::{Batch, MsgType, ProtocolFamily, Table};

        tokio::task::spawn_blocking(move || {
            let table = Table::new(ProtocolFamily::Ipv4).with_name("gw_nat");

            let mut batch = Batch::new();
            batch.add(&table, MsgType::Del);

            batch
                .send()
                .map_err(|e| NatError::RuleRemoveFailed(e.to_string()))
        })
        .await
        .map_err(|e| NatError::RuleRemoveFailed(e.to_string()))?
    }

    pub(super) async fn flush_conntrack(_upstream_interface: &str) -> Result<(), NatError> {
        use netlink_sys::{Socket, SocketAddr, protocols::NETLINK_NETFILTER};

        tokio::task::spawn_blocking(move || {
            const NFNL_SUBSYS_CTNETLINK: u16 = 1;
            const IPCTNL_MSG_CT_DELETE: u16 = 2;
            const NLM_F_REQUEST: u16 = 1;
            const NLM_F_ACK: u16 = 4;

            let msg_type: u16 = (NFNL_SUBSYS_CTNETLINK << 8) | IPCTNL_MSG_CT_DELETE;
            let nlmsg_flags: u16 = NLM_F_REQUEST | NLM_F_ACK;

            let mut buf = [0u8; 20];
            buf[0..4].copy_from_slice(&20u32.to_ne_bytes());
            buf[4..6].copy_from_slice(&msg_type.to_ne_bytes());
            buf[6..8].copy_from_slice(&nlmsg_flags.to_ne_bytes());
            buf[8..12].copy_from_slice(&1u32.to_ne_bytes());
            buf[12..16].copy_from_slice(&0u32.to_ne_bytes());

            let mut socket = Socket::new(NETLINK_NETFILTER)
                .map_err(|e| NatError::ConntrackFlushFailed(e.to_string()))?;
            socket
                .bind_auto()
                .map_err(|e| NatError::ConntrackFlushFailed(e.to_string()))?;

            let kernel_addr = SocketAddr::new(0, 0);
            socket
                .connect(&kernel_addr)
                .map_err(|e| NatError::ConntrackFlushFailed(e.to_string()))?;

            socket
                .send(&buf, 0)
                .map_err(|e| NatError::ConntrackFlushFailed(e.to_string()))?;

            let mut resp = vec![0u8; 4096];
            socket
                .recv(&mut resp.as_mut_slice(), 0)
                .map_err(|e| NatError::ConntrackFlushFailed(e.to_string()))?;

            Ok(())
        })
        .await
        .map_err(|e| NatError::ConntrackFlushFailed(e.to_string()))?
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::NatError;
    use std::net::Ipv4Addr;

    pub(super) async fn install_nat_rules(
        upstream_interface: &str,
        consumer_subnet: Ipv4Addr,
        consumer_prefix_len: u8,
    ) -> Result<(), NatError> {
        use pfctl::{AnchorKind, NatRuleAction, NatRuleBuilder, PfCtl};

        let iface = upstream_interface.to_owned();

        tokio::task::spawn_blocking(move || {
            let network =
                pfctl::ipnetwork::Ipv4Network::new(consumer_subnet, consumer_prefix_len)
                    .map_err(|e| NatError::RuleInstallFailed(e.to_string()))?;

            let mut pf =
                PfCtl::new().map_err(|e| NatError::RuleInstallFailed(e.to_string()))?;
            pf.try_enable()
                .map_err(|e| NatError::RuleInstallFailed(e.to_string()))?;
            pf.try_add_anchor("gw_nat", AnchorKind::Nat)
                .map_err(|e| NatError::RuleInstallFailed(e.to_string()))?;

            let rule = NatRuleBuilder::default()
                .action(NatRuleAction::Nat {
                    nat_to: pfctl::NatEndpoint::default(),
                })
                .interface(iface.as_str())
                .from(pfctl::Ip::Net(pfctl::ipnetwork::IpNetwork::V4(network)))
                .af(pfctl::AddrFamily::Ipv4)
                .build()
                .map_err(|e| NatError::RuleInstallFailed(e.to_string()))?;

            pf.add_nat_rule("gw_nat", &rule)
                .map_err(|e| NatError::RuleInstallFailed(e.to_string()))?;

            Ok(())
        })
        .await
        .map_err(|e| NatError::RuleInstallFailed(e.to_string()))?
    }

    pub(super) async fn remove_nat_rules(_upstream_interface: &str) -> Result<(), NatError> {
        use pfctl::{AnchorKind, PfCtl, RulesetKind};

        tokio::task::spawn_blocking(move || {
            let mut pf =
                PfCtl::new().map_err(|e| NatError::RuleRemoveFailed(e.to_string()))?;

            pf.flush_rules("gw_nat", RulesetKind::Nat)
                .map_err(|e| NatError::RuleRemoveFailed(e.to_string()))?;

            pf.try_remove_anchor("gw_nat", AnchorKind::Nat)
                .map_err(|e| NatError::RuleRemoveFailed(e.to_string()))?;

            Ok(())
        })
        .await
        .map_err(|e| NatError::RuleRemoveFailed(e.to_string()))?
    }

    pub(super) async fn flush_conntrack(upstream_interface: &str) -> Result<(), NatError> {
        use pfctl::{Interface, PfCtl};

        let iface = upstream_interface.to_owned();

        tokio::task::spawn_blocking(move || {
            let mut pf =
                PfCtl::new().map_err(|e| NatError::ConntrackFlushFailed(e.to_string()))?;

            pf.clear_interface_states(Interface::from(iface.as_str()))
                .map_err(|e| NatError::ConntrackFlushFailed(e.to_string()))?;

            Ok(())
        })
        .await
        .map_err(|e| NatError::ConntrackFlushFailed(e.to_string()))?
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_starts_disabled() {
        let nat = Nat::new("eth0".to_string(), "10.0.0.0".parse().unwrap(), 24);
        assert!(!nat.enabled);
    }

    #[tokio::test]
    async fn enable_sets_enabled_flag() {
        let mut nat = Nat::new("lo0".to_string(), "10.0.0.0".parse().unwrap(), 24);
        let result = nat.enable().await;
        if result.is_ok() {
            assert!(nat.enabled);
        }
    }

    #[tokio::test]
    async fn enable_twice_is_idempotent() {
        let mut nat = Nat::new("lo0".to_string(), "10.0.0.0".parse().unwrap(), 24);
        let r1 = nat.enable().await;
        if r1.is_ok() {
            let r2 = nat.enable().await;
            assert!(r2.is_ok());
            assert!(nat.enabled);
        }
    }

    #[tokio::test]
    async fn disable_when_not_enabled_is_idempotent() {
        let mut nat = Nat::new("lo0".to_string(), "10.0.0.0".parse().unwrap(), 24);
        assert!(!nat.enabled);
        let result = nat.disable().await;
        assert!(result.is_ok());
        assert!(!nat.enabled);
    }

    #[test]
    fn disabled_flag_starts_false() {
        let nat = Nat::new("en0".to_string(), "192.168.1.0".parse().unwrap(), 24);
        assert!(!nat.enabled);
    }
}
