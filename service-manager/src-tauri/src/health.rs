use std::sync::Arc;
use tokio::time::{self, Duration};
use tauri::AppHandle;
use tauri::Emitter;

use crate::process::ProcessManager;

/// 启动健康检查后台任务
pub fn start_health_check(
    app: AppHandle,
    manager: Arc<ProcessManager>,
    proxy_port: u16,
) {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap();

        let proxy_url = format!("http://localhost:{}/health", proxy_port);

        loop {
            time::sleep(Duration::from_secs(30)).await;

            let backend_status = manager.backend_status();
            if !backend_status.running {
                continue;
            }

            // 后端健康检查
            let backend_port = backend_status.port;
            if backend_port > 0 {
                let backend_url = format!("http://127.0.0.1:{}/health", backend_port);
                match client.get(&backend_url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        manager.reset_health_failures();
                        let _ = app.emit("backend-health-ok", ());
                    }
                    _ => {
                        manager.record_health_failure();
                        let failures = manager.health_failure_count();
                        let _ = app.emit("backend-health-fail", failures);
                        if failures >= 3 {
                            let _ = app.emit("auto-restart", ());
                        }
                    }
                }
            }

            // 代理健康检查
            let proxy_running = manager.get_proxy_pid() != 0;
            if proxy_running {
                match client.get(&proxy_url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        let _ = app.emit("proxy-health-ok", ());
                    }
                    _ => {
                        let _ = app.emit("proxy-health-fail", ());
                    }
                }
            }
        }
    });
}
