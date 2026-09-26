use std::net::SocketAddr;

use iroh::{Endpoint, endpoint::presets};
use socket2::{Socket, Domain, Type, Protocol};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

const RELAY_ALPN: &[u8] = b"/gw/relay/0";

fn connect_via(target: &str, bind_addr: Option<SocketAddr>) -> std::io::Result<std::net::TcpStream> {
    let dest: SocketAddr = target.to_socket_addrs_sync()?;
    let socket = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP))?;
    if let Some(local) = bind_addr {
        socket.bind(&local.into())?;
    }
    socket.connect(&dest.into())?;
    Ok(socket.into())
}

trait ToSocketAddrsSync {
    fn to_socket_addrs_sync(&self) -> std::io::Result<SocketAddr>;
}

impl ToSocketAddrsSync for str {
    fn to_socket_addrs_sync(&self) -> std::io::Result<SocketAddr> {
        use std::net::ToSocketAddrs;
        self.to_socket_addrs()?
            .next()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::AddrNotAvailable, "no addresses"))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let bind_ip = std::env::args().nth(1);
    let bind_addr: Option<SocketAddr> = bind_ip.as_ref().map(|ip| {
        format!("{ip}:0").parse().expect("invalid bind address")
    });

    let endpoint = Endpoint::builder(presets::N0)
        .alpns(vec![RELAY_ALPN.to_vec()])
        .bind()
        .await?;

    println!("relay node_id: {}", endpoint.id());
    if let Some(addr) = &bind_ip {
        println!("outbound bound to: {addr}");
    }
    println!("waiting for connections...");

    loop {
        let Some(incoming) = endpoint.accept().await else {
            break;
        };
        let accepting = match incoming.accept() {
            Ok(a) => a,
            Err(e) => {
                eprintln!("accept error: {e}");
                continue;
            }
        };
        let connection = match accepting.await {
            Ok(c) => c,
            Err(e) => {
                eprintln!("connecting error: {e}");
                continue;
            }
        };
        println!("peer connected: {}", connection.remote_id().fmt_short());

        tokio::spawn(async move {
            loop {
                let (mut send, mut recv) = match connection.accept_bi().await {
                    Ok(s) => s,
                    Err(_) => break,
                };

                tokio::spawn(async move {
                    let mut len_buf = [0u8; 2];
                    if recv.read_exact(&mut len_buf).await.is_err() {
                        return;
                    }
                    let addr_len = u16::from_be_bytes(len_buf) as usize;
                    let mut addr_buf = vec![0u8; addr_len];
                    if recv.read_exact(&mut addr_buf).await.is_err() {
                        return;
                    }
                    let addr = String::from_utf8_lossy(&addr_buf).to_string();
                    println!("relaying to: {addr}");

                    let tcp = match connect_via(&addr, bind_addr) {
                        Ok(s) => {
                            s.set_nonblocking(true).ok();
                            match TcpStream::from_std(s) {
                                Ok(t) => t,
                                Err(e) => {
                                    eprintln!("tcp async convert error: {e}");
                                    return;
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("tcp connect error to {addr}: {e}");
                            let _ = send.write_all(format!("ERROR: {e}\n").as_bytes()).await;
                            let _ = send.finish();
                            return;
                        }
                    };
                    let (mut tcp_read, mut tcp_write) = tcp.into_split();

                    let up = tokio::spawn(async move {
                        let mut buf = [0u8; 8192];
                        loop {
                            let n = match recv.read(&mut buf).await {
                                Ok(Some(n)) => n,
                                _ => break,
                            };
                            if tcp_write.write_all(&buf[..n]).await.is_err() {
                                break;
                            }
                        }
                    });

                    let mut buf = [0u8; 8192];
                    loop {
                        let n = match tcp_read.read(&mut buf).await {
                            Ok(0) => break,
                            Ok(n) => n,
                            Err(_) => break,
                        };
                        if send.write_all(&buf[..n]).await.is_err() {
                            break;
                        }
                    }
                    let _ = send.finish();
                    up.abort();
                    println!("relay to {addr} done");
                });
            }
        });
    }

    Ok(())
}
