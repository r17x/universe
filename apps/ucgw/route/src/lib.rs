use types::channel::RouteCommandReceiver;
use types::{RouteCommand, RouteError, RouteResult};

#[derive(Debug, thiserror::Error)]
pub enum RoutingError {
    #[error("command channel closed")]
    ChannelClosed,
    #[error("platform error: {0}")]
    PlatformError(String),
}

pub struct Route {
    command_rx: RouteCommandReceiver,
}

impl Route {
    pub fn new(command_rx: RouteCommandReceiver) -> Self {
        Self { command_rx }
    }

    pub async fn run(mut self) -> Result<(), RoutingError> {
        loop {
            match self.command_rx.recv().await {
                None => return Err(RoutingError::ChannelClosed),
                Some((cmd, reply_tx)) => {
                    let result = execute_command(cmd).await;
                    let _ = reply_tx.send(result);
                }
            }
        }
    }
}

#[cfg(target_os = "linux")]
async fn execute_command(cmd: RouteCommand) -> Result<RouteResult, RouteError> {
    use std::net::IpAddr;

    let (conn, handle, _) = rtnetlink::new_connection().map_err(|e| RouteError::OperationFailed {
        reason: e.to_string(),
    })?;
    tokio::spawn(conn);

    match cmd {
        RouteCommand::Add {
            destination,
            prefix_len,
            gateway,
            interface_index,
        } => {
            add_route(&handle, destination, prefix_len, gateway, interface_index).await
        }
        RouteCommand::Delete {
            destination,
            prefix_len,
        } => delete_route(&handle, destination, prefix_len).await,
        RouteCommand::SetDefault {
            gateway,
            interface_index,
        } => {
            add_route(
                &handle,
                IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED),
                0,
                gateway,
                interface_index,
            )
            .await
        }
        RouteCommand::FlushAll => flush_all(&handle).await,
    }
}

#[cfg(target_os = "linux")]
async fn add_route(
    handle: &rtnetlink::Handle,
    destination: std::net::IpAddr,
    prefix_len: u8,
    gateway: std::net::IpAddr,
    interface_index: u32,
) -> Result<RouteResult, RouteError> {
    use netlink_packet_route::route::RouteMessage;
    use rtnetlink::RouteMessageBuilder;
    use std::net::IpAddr;

    let msg: RouteMessage = match (destination, gateway) {
        (IpAddr::V4(dest), IpAddr::V4(gw)) => RouteMessageBuilder::<std::net::Ipv4Addr>::new()
            .destination_prefix(dest, prefix_len)
            .gateway(gw)
            .output_interface(interface_index)
            .build(),
        (IpAddr::V6(dest), IpAddr::V6(gw)) => RouteMessageBuilder::<std::net::Ipv6Addr>::new()
            .destination_prefix(dest, prefix_len)
            .gateway(gw)
            .output_interface(interface_index)
            .build(),
        _ => {
            return Err(RouteError::OperationFailed {
                reason: "address family mismatch".to_string(),
            })
        }
    };

    handle
        .route()
        .add(msg)
        .execute()
        .await
        .map(|_| RouteResult { success: true })
        .map_err(|e| map_rtnetlink_error(e, false))
}

#[cfg(target_os = "linux")]
async fn delete_route(
    handle: &rtnetlink::Handle,
    destination: std::net::IpAddr,
    prefix_len: u8,
) -> Result<RouteResult, RouteError> {
    use futures_util::TryStreamExt;
    use netlink_packet_route::route::RouteMessage;
    use rtnetlink::RouteMessageBuilder;
    use std::net::IpAddr;

    let filter: RouteMessage = match destination {
        IpAddr::V4(dest) => RouteMessageBuilder::<std::net::Ipv4Addr>::new()
            .destination_prefix(dest, prefix_len)
            .build(),
        IpAddr::V6(dest) => RouteMessageBuilder::<std::net::Ipv6Addr>::new()
            .destination_prefix(dest, prefix_len)
            .build(),
    };

    let mut stream = handle.route().get(filter).execute();
    let route_msg = stream
        .try_next()
        .await
        .map_err(|e| map_rtnetlink_error(e, true))?
        .ok_or(RouteError::NotFound)?;

    handle
        .route()
        .del(route_msg)
        .execute()
        .await
        .map(|_| RouteResult { success: true })
        .map_err(|e| map_rtnetlink_error(e, true))
}

#[cfg(target_os = "linux")]
async fn flush_all(handle: &rtnetlink::Handle) -> Result<RouteResult, RouteError> {
    use futures_util::TryStreamExt;
    use netlink_packet_route::route::RouteMessage;
    use rtnetlink::RouteMessageBuilder;

    let filter: RouteMessage = RouteMessageBuilder::<std::net::Ipv4Addr>::new().build();
    let mut stream = handle.route().get(filter).execute();
    let mut routes = Vec::new();
    while let Some(msg) = stream
        .try_next()
        .await
        .map_err(|e| map_rtnetlink_error(e, false))?
    {
        routes.push(msg);
    }

    for route_msg in routes {
        handle
            .route()
            .del(route_msg)
            .execute()
            .await
            .map_err(|e| map_rtnetlink_error(e, false))?;
    }

    Ok(RouteResult { success: true })
}

#[cfg(target_os = "linux")]
fn map_rtnetlink_error(e: rtnetlink::Error, missing_is_not_found: bool) -> RouteError {
    if let rtnetlink::Error::NetlinkError(ref msg) = e {
        let code = msg.raw_code().abs();
        if code == libc::EEXIST {
            return RouteError::AlreadyExists;
        }
        if missing_is_not_found && code == libc::ENOENT {
            return RouteError::NotFound;
        }
    }
    RouteError::OperationFailed {
        reason: e.to_string(),
    }
}

#[cfg(target_os = "macos")]
async fn execute_command(cmd: RouteCommand) -> Result<RouteResult, RouteError> {
    match cmd {
        RouteCommand::Add {
            destination,
            prefix_len,
            gateway,
            ..
        } => {
            let dest_cidr = format!("{}/{}", destination, prefix_len);
            run_route_cmd(&["-n", "add", "-net", &dest_cidr, &gateway.to_string()]).await
        }
        RouteCommand::Delete {
            destination,
            prefix_len,
        } => {
            let dest_cidr = format!("{}/{}", destination, prefix_len);
            run_route_cmd(&["-n", "delete", "-net", &dest_cidr]).await
        }
        RouteCommand::SetDefault {
            gateway,
            ..
        } => run_route_cmd(&["-n", "add", "default", &gateway.to_string()]).await,
        RouteCommand::FlushAll => run_route_cmd(&["-n", "flush"]).await,
    }
}

#[cfg(target_os = "macos")]
async fn run_route_cmd(args: &[&str]) -> Result<RouteResult, RouteError> {
    let output = tokio::process::Command::new("/sbin/route")
        .args(args)
        .output()
        .await
        .map_err(|e| RouteError::OperationFailed {
            reason: e.to_string(),
        })?;

    if output.status.success() {
        return Ok(RouteResult { success: true });
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let lower = stderr.to_lowercase();

    if lower.contains("not in table") || lower.contains("no such process") {
        return Err(RouteError::NotFound);
    }
    if lower.contains("file exists") || lower.contains("already") {
        return Err(RouteError::AlreadyExists);
    }

    Err(RouteError::OperationFailed {
        reason: stderr.trim().to_string(),
    })
}
