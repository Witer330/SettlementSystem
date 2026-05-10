use std::sync::Arc;
use tokio::time::{self, Duration};
use tauri::AppHandle;
use tauri::Emitter;

use crate::process::ProcessManager;

/// 启动健康检查后台任务
pub fn start_health_check(app: AppHandle, manager: Arc<ProcessManager>, port: u16) {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap();

        let url = format!("http://localhost:{}/health", port);

        loop {
            time::sleep(Duration::from_secs(30)).await;

            // 只在服务应运行时检查
            if !manager.status().running {
                continue;
            }

            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    manager.reset_health_failures();
                    let _ = app.emit("health-ok", ());
                }
                _ => {
                    manager.record_health_failure();
                    let failures = manager.health_failure_count();
                    let _ = app.emit("health-fail", failures);

                    // 连续失败 3 次，尝试自动重启
                    if failures >= 3 {
                        let _ = app.emit("auto-restart", ());
                        // 自动重启逻辑由 main.rs 处理
                    }
                }
            }
        }
    });
}
