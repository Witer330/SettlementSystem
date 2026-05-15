//! 独立代理进程 — 脱离托盘程序生命周期。
//!   用法: settlement-proxy --port 4000 --backend-port 12345 --host 0.0.0.0

use hyper::body::Incoming;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use http_body_util::{BodyExt, Full};
use bytes::Bytes;
use std::net::SocketAddr;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();

    let mut proxy_port: u16 = 4000;
    let mut backend_port: u16 = 3000;
    let mut host = "127.0.0.1".to_string();

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--port" => { i += 1; if let Some(v) = args.get(i) { proxy_port = v.parse().unwrap_or(4000); } }
            "--backend-port" => { i += 1; if let Some(v) = args.get(i) { backend_port = v.parse().unwrap_or(3000); } }
            "--host" => { i += 1; if let Some(v) = args.get(i) { host = v.clone(); } }
            _ => {}
        }
        i += 1;
    }

    let backend_addr: SocketAddr = format!("127.0.0.1:{}", backend_port).parse()?;
    let listen_addr: SocketAddr = format!("{}:{}", host, proxy_port).parse()?;
    let listener = TcpListener::bind(listen_addr).await?;

    let pid = std::process::id();
    println!("__PROXY_READY__:pid={pid},port={proxy_port}");

    loop {
        let (stream, _) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => { eprintln!("accept error: {e}"); continue; }
        };
        let io = TokioIo::new(stream);
        let backend = backend_addr;
        tokio::spawn(async move {
            let svc = service_fn(move |req| proxy_request(req, backend));
            if let Err(e) = hyper_util::server::conn::auto::Builder::new(hyper_util::rt::TokioExecutor::new())
                .serve_connection(io, svc)
                .await
            {
                if !e.to_string().contains("closed") {
                    eprintln!("proxy error: {e}");
                }
            }
        });
    }
}

async fn proxy_request(
    req: Request<Incoming>,
    backend_addr: SocketAddr,
) -> Result<Response<Full<Bytes>>, std::convert::Infallible> {
    let path = req.uri().path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let backend_url = format!("http://{}{}", backend_addr, path);

    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .unwrap();

    let method = req.method().clone();
    let headers = req.headers().clone();
    let body_bytes = req.collect().await.map(|b| b.to_bytes()).unwrap_or_default();

    let mut backend_req = client.request(method, &backend_url);
    for (k, v) in headers.iter() {
        if k.as_str() != "host" {
            backend_req = backend_req.header(k.as_str(), v.as_bytes());
        }
    }
    if !body_bytes.is_empty() {
        backend_req = backend_req.body(body_bytes.to_vec());
    }

    match backend_req.send().await {
        Ok(resp) => {
            let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::OK);
            let mut builder = Response::builder().status(status);
            for (k, v) in resp.headers().iter() {
                builder = builder.header(k.as_str(), v.as_bytes());
            }
            let body = resp.bytes().await.unwrap_or_default();
            Ok(builder.body(Full::new(body)).unwrap())
        }
        Err(_) => {
            Ok(Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Full::new(Bytes::from("后端服务未响应")))
                .unwrap())
        }
    }
}
