use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response};
use hyper_util::rt::TokioIo;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;

use crate::process::ProcessManager;

/// 启动反向代理
pub async fn start_proxy(
    listen_addr: SocketAddr,
    manager: Arc<ProcessManager>,
) -> Result<(), String> {
    let listener = TcpListener::bind(listen_addr)
        .await
        .map_err(|e| format!("代理绑定端口 {} 失败: {}", listen_addr.port(), e))?;

    println!("反向代理监听 {}", listen_addr);

    loop {
        let (stream, _remote_addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                eprintln!("接受连接失败: {}", e);
                continue;
            }
        };

        let manager = manager.clone();
        tokio::spawn(async move {
            let io = TokioIo::new(stream);
            let service = service_fn(move |req| {
                let manager = manager.clone();
                async move { proxy_request(req, &manager).await }
            });
            if let Err(e) = http1::Builder::new().serve_connection(io, service).await {
                eprintln!("代理连接错误: {}", e);
            }
        });
    }
}

/// 转发单个请求到后端
async fn proxy_request(
    req: Request<Incoming>,
    manager: &Arc<ProcessManager>,
) -> Result<Response<Full<Bytes>>, Infallible> {
    let backend_port = manager.get_backend_port();
    let backend_addr = format!("127.0.0.1:{}", backend_port);

    // 构建转发 URL
    let path = req.uri().path_and_query().map(|pq| pq.as_str()).unwrap_or("/");
    let url = format!("http://{}{}", backend_addr, path);

    let method = req.method().clone();
    let (parts, body) = req.into_parts();

    // 读取请求体
    let body_bytes = match body.collect().await {
        Ok(b) => b.to_bytes(),
        Err(e) => {
            eprintln!("读取请求体失败: {}", e);
            return Ok(error_response(502, "读取请求体失败"));
        }
    };

    // 构建后端请求
    let mut backend_req = Request::builder().method(method).uri(&url);

    // 复制原始请求头
    for (key, value) in &parts.headers {
        if key != "host" {
            backend_req = backend_req.header(key, value);
        }
    }
    backend_req = backend_req.header("host", &backend_addr);

    let backend_req = match backend_req.body(Full::new(body_bytes)) {
        Ok(req) => req,
        Err(e) => {
            eprintln!("构建后端请求失败: {}", e);
            return Ok(error_response(502, "构建后端请求失败"));
        }
    };

    // 发送请求到后端
    let client = hyper_util::client::legacy::Client::builder(TokioHttpExecutor).build_http();

    match client.request(backend_req).await {
        Ok(resp) => {
            let (parts, body) = resp.into_parts();
            let body_bytes = match body.collect().await {
                Ok(b) => b.to_bytes(),
                Err(_) => Bytes::new(),
            };
            Ok(Response::from_parts(parts, Full::new(body_bytes)))
        }
        Err(e) => {
            eprintln!("后端请求失败: {}", e);
            Ok(error_response(502, "后端服务不可用"))
        }
    }
}

fn error_response(status: u16, msg: &str) -> Response<Full<Bytes>> {
    Response::builder()
        .status(status)
        .body(Full::new(Bytes::from(msg.to_string())))
        .unwrap()
}

/// 自定义 Executor 用于 hyper-util
#[derive(Clone)]
struct TokioHttpExecutor;

impl<F> hyper::rt::Executor<F> for TokioHttpExecutor
where
    F: std::future::Future + Send + 'static,
    F::Output: Send + 'static,
{
    fn execute(&self, future: F) {
        tokio::spawn(future);
    }
}
