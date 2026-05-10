use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

/// 服务状态
#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub uptime: u64,
    pub unhealthy: bool,
}

/// 进程管理器
pub struct ProcessManager {
    pid: Arc<AtomicU32>,
    should_be_running: Arc<AtomicBool>,
    health_failures: Arc<AtomicU32>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            pid: Arc::new(AtomicU32::new(0)),
            should_be_running: Arc::new(AtomicBool::new(false)),
            health_failures: Arc::new(AtomicU32::new(0)),
        }
    }

    /// 启动 Node.js 服务
    pub async fn start(&self, node_path: &str, server_script: &str, work_dir: &str) -> Result<(), String> {
        if self.pid.load(Ordering::Relaxed) != 0 {
            return Err("服务已在运行".to_string());
        }

        let mut cmd = tokio::process::Command::new(node_path);
        cmd.arg(server_script)
           .current_dir(work_dir)
           .env("NODE_ENV", "production")
           .env("PORT", "4000")
           .stdout(std::process::Stdio::piped())
           .stderr(std::process::Stdio::piped())
           .creation_flags(0x08000000); // CREATE_NO_WINDOW

        let child = cmd.spawn().map_err(|e| format!("启动失败: {}", e))?;
        let child_pid = child.id().unwrap_or(0);

        // 保存 PID
        self.pid.store(child_pid, Ordering::Relaxed);
        self.should_be_running.store(true, Ordering::Relaxed);
        self.health_failures.store(0, Ordering::Relaxed);

        // 监控子进程退出
        let pid_clone = self.pid.clone();
        tokio::spawn(async move {
            let mut child = child;
            let _ = child.wait().await;
            pid_clone.store(0, Ordering::Relaxed);
        });

        Ok(())
    }

    /// 停止服务
    pub async fn stop(&self) -> Result<(), String> {
        self.should_be_running.store(false, Ordering::Relaxed);

        let pid = self.pid.load(Ordering::Relaxed);
        if pid == 0 {
            return Ok(());
        }

        // 尝试优雅关闭
        let _ = reqwest::Client::new()
            .post("http://localhost:4000/api/v1/shutdown")
            .timeout(std::time::Duration::from_secs(3))
            .send()
            .await;

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // 使用 taskkill 强制终止
        let _ = tokio::process::Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .output()
            .await;

        self.pid.store(0, Ordering::Relaxed);
        Ok(())
    }

    /// 重启服务
    pub async fn restart(&self, node_path: &str, server_script: &str, work_dir: &str) -> Result<(), String> {
        self.stop().await?;
        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        self.start(node_path, server_script, work_dir).await
    }

    /// 获取状态
    pub fn status(&self) -> ServerStatus {
        let pid_val = self.pid.load(Ordering::Relaxed);
        let running = pid_val != 0;
        let unhealthy = self.health_failures.load(Ordering::Relaxed) >= 3;

        ServerStatus {
            running,
            pid: if running { Some(pid_val) } else { None },
            uptime: 0,
            unhealthy,
        }
    }

    pub fn record_health_failure(&self) {
        self.health_failures.fetch_add(1, Ordering::Relaxed);
    }

    pub fn reset_health_failures(&self) {
        self.health_failures.store(0, Ordering::Relaxed);
    }

    pub fn health_failure_count(&self) -> u32 {
        self.health_failures.load(Ordering::Relaxed)
    }
}
