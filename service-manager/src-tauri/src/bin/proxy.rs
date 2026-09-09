//! 独立代理进程 — 脱离托盘程序生命周期。
//!   用法: settlement-proxy --port 4000 --backend-port 12345 --host 0.0.0.0 [--static-dir ./frontend/dist]
//!
//!   路由规则：
//!   - /health、/api/* → 转发后端
//!   - 其他 → 直接从 static-dir 读取静态文件（SPA fallback 返回 index.html）

use hyper::body::Incoming;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use http_body_util::{BodyExt, Full};
use bytes::Bytes;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::net::TcpListener;

/// 根据文件扩展名返回 MIME 类型
fn mime_from_ext(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js") | Some("mjs") => "application/javascript; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("map") => "application/json",
        _ => "application/octet-stream",
    }
}

/// 检查路径是否安全（防止目录穿越）
fn is_safe_path(path: &str) -> bool {
    !path.contains("..") && !path.contains('\\')
}

/// 判断路径是否有文件扩展名（用于区分 SPA 路由和静态资源请求）
fn has_file_extension(path: &str) -> bool {
    Path::new(path).extension().is_some()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();

    let mut proxy_port: u16 = 4000;
    let mut backend_port: u16 = 3000;
    let mut host = "127.0.0.1".to_string();

    // 静态文件目录，默认相对于 exe 的 ../frontend/dist
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_default();
    let mut static_dir = exe_dir.join("frontend").join("dist");

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--port" => { i += 1; if let Some(v) = args.get(i) { proxy_port = v.parse().unwrap_or(4000); } }
            "--backend-port" => { i += 1; if let Some(v) = args.get(i) { backend_port = v.parse().unwrap_or(3000); } }
            "--host" => { i += 1; if let Some(v) = args.get(i) { host = v.clone(); } }
            "--static-dir" => { i += 1; if let Some(v) = args.get(i) { static_dir = PathBuf::from(v); } }
            _ => {}
        }
        i += 1;
    }

    let backend_addr: SocketAddr = format!("127.0.0.1:{}", backend_port).parse()?;
    let listen_addr: SocketAddr = format!("{}:{}", host, proxy_port).parse()?;
    let listener = TcpListener::bind(listen_addr).await?;

    // reqwest Client — 超时 30s + 少量连接池复用避免频繁 TCP 握手
    let client: Arc<reqwest::Client> = Arc::new(
        reqwest::Client::builder()
            .no_proxy()
            .timeout(std::time::Duration::from_secs(30))
            .pool_max_idle_per_host(2)
            .build()
            .unwrap()
    );

    let pid = std::process::id();
    println!("__PROXY_READY__:pid={pid},port={proxy_port}");

    // Arc 包装以在多线程间共享
    let static_dir: Arc<PathBuf> = Arc::new(static_dir);

    loop {
        let (stream, _) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => { eprintln!("accept error: {e}"); continue; }
        };
        let io = TokioIo::new(stream);
        let backend = backend_addr;
        let client = client.clone();
        let static_dir = static_dir.clone();
        tokio::spawn(async move {
            let svc = service_fn(move |req| {
                proxy_request(req, backend, client.clone(), static_dir.clone())
            });
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

/// 请求分发：API/health 转发后端，其他走静态文件
async fn proxy_request(
    req: Request<Incoming>,
    backend_addr: SocketAddr,
    client: Arc<reqwest::Client>,
    static_dir: Arc<PathBuf>,
) -> Result<Response<Full<Bytes>>, std::convert::Infallible> {
    let path_only = req.uri().path().to_string();

    // /health 和 /api/* → 转发后端
    if path_only == "/health" || path_only.starts_with("/api/") {
        return proxy_to_backend(req, backend_addr, client, &path_only).await;
    }

    // 其他请求 → 静态文件服务
    serve_static(static_dir.as_ref(), &path_only).await
}

/// 转发请求到后端 Express 服务
async fn proxy_to_backend(
    req: Request<Incoming>,
    backend_addr: SocketAddr,
    client: Arc<reqwest::Client>,
    path: &str,
) -> Result<Response<Full<Bytes>>, std::convert::Infallible> {
    let backend_url = format!("http://{}{}", backend_addr, path);
    // 保留 query string（如果有）
    let backend_url = if let Some(query) = req.uri().query() {
        format!("{}?{}", backend_url, query)
    } else {
        backend_url
    };

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

/// 静态文件服务 — 从 static_dir 读取文件，SPA fallback 返回 index.html
async fn serve_static(
    static_dir: &Path,
    path: &str,
) -> Result<Response<Full<Bytes>>, std::convert::Infallible> {
    // 去掉前导 /，空路径 → index.html
    let relative = path.trim_start_matches('/');
    let relative = if relative.is_empty() { "index.html" } else { relative };

    // 安全检查：拒绝目录穿越
    if !is_safe_path(relative) {
        return Ok(Response::builder()
            .status(StatusCode::FORBIDDEN)
            .body(Full::new(Bytes::from("Forbidden")))
            .unwrap());
    }

    let file_path = static_dir.join(relative);

    // 尝试读取文件
    match tokio::fs::read(&file_path).await {
        Ok(content) => {
            let mime = mime_from_ext(&file_path);
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", mime)
                .header("Cache-Control", "public, max-age=3600")
                .body(Full::new(Bytes::from(content)))
                .unwrap())
        }
        Err(_) => {
            // 文件不存在：有扩展名 → 404（丢失的静态资源），无扩展名 → SPA fallback
            if has_file_extension(relative) {
                Ok(Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(Full::new(Bytes::from("Not Found")))
                    .unwrap())
            } else {
                match tokio::fs::read(static_dir.join("index.html")).await {
                    Ok(content) => {
                        Ok(Response::builder()
                            .status(StatusCode::OK)
                            .header("Content-Type", "text/html; charset=utf-8")
                            .body(Full::new(Bytes::from(content)))
                            .unwrap())
                    }
                    Err(_) => {
                        Ok(Response::builder()
                            .status(StatusCode::NOT_FOUND)
                            .body(Full::new(Bytes::from("Not Found")))
                            .unwrap())
                    }
                }
            }
        }
    }
}
