use std::str::FromStr;

use iroh::{Endpoint, EndpointId, endpoint::presets};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const RELAY_ALPN: &[u8] = b"/gw/relay/0";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("usage: gw-probe <node-id> [host:port[/path]]");
        eprintln!("  gw-probe <node-id>                         -- connectivity test only");
        eprintln!("  gw-probe <node-id> ifconfig.me:80/all.json -- relay HTTP through node");
        std::process::exit(1);
    }

    let target = EndpointId::from_str(&args[1])?;
    let raw_addr = args.get(2).cloned();

    let endpoint = Endpoint::builder(presets::N0)
        .alpns(vec![RELAY_ALPN.to_vec()])
        .bind()
        .await?;

    eprintln!("local endpoint: {}", endpoint.id());

    let connection = endpoint.connect(target, RELAY_ALPN).await?;
    eprintln!("connected to {}", connection.remote_id().fmt_short());

    match raw_addr {
        None => {
            eprintln!("probe complete — connectivity verified");
        }
        Some(raw) => {
            let (addr, path) = match raw.find('/') {
                Some(i) => (raw[..i].to_string(), raw[i..].to_string()),
                None => (raw.clone(), "/".to_string()),
            };
            let host = addr.split(':').next().unwrap_or(&addr);

            let (mut send, mut recv) = connection.open_bi().await?;

            let addr_bytes = addr.as_bytes();
            let len = (addr_bytes.len() as u16).to_be_bytes();
            send.write_all(&len).await?;
            send.write_all(addr_bytes).await?;

            let http_req = format!(
                "GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n",
            );
            send.write_all(http_req.as_bytes()).await?;
            send.finish()?;

            let response = recv.read_to_end(1024 * 64).await?;
            let text = String::from_utf8_lossy(&response);
            print!("{text}");
        }
    }

    connection.close(0u8.into(), b"done");
    endpoint.close().await;
    Ok(())
}
