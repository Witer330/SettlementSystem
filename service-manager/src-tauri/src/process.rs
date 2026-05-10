use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;
use tokio::io::{AsyncBufReadExt, BufReader};

/// 服务状态
#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub backend_port: u16,
    pub unhealthy: bool,
    pub memory_mb: f64,
    pub cpu_percent: f32,
    pub uptime: u64,
}

/// 进程管理器
pub struct ProcessManager {
    pid: Arc<AtomicU32>,
    backend_port: Arc<AtomicU16>,
    should_be_running: Arc<AtomicBool>,
    health_failures: Arc<AtomicU32>,
    started_at: Arc<AtomicU64>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            pid: Arc::new(AtomicU32::new(0)),
            backend_port: Arc::new(AtomicU16::new(0)),
            should_be_running: Arc::new(AtomicBool::new(false)),
            health_failures: Arc::new(AtomicU32::new(0)),
            started_at: Arc::new(AtomicU64::new(0)),
        }
    }

    /// 启动 Node.js 服务（自动分配端口）
    pub async fn start(&self, node_path: &str, server_script: &str, work_dir: &str) -> Result<u16, String> {
        if self.pid.load(Ordering::Relaxed) != 0 {
            return Err("服务已在运行".to_string());
        }

        let mut cmd = tokio::process::Command::new(node_path);
        cmd.arg(server_script)
           .current_dir(work_dir)
           .env("NODE_ENV", "production")
           .env("PORT", "0") // OS 自动分配端口
           .stdout(std::process::Stdio::piped())
           .stderr(std::process::Stdio::piped())
           .creation_flags(0x08000000); // CREATE_NO_WINDOW

        let mut child = cmd.spawn().map_err(|e| format!("启动失败: {}", e))?;
        let child_pid = child.id().unwrap_or(0);

        // 读取 stdout 获取实际端口
        let stdout = child.stdout.take().unwrap();
        let pid_clone = self.pid.clone();
        let port_clone = self.backend_port.clone();
        let should_be_running = self.should_be_running.clone();

        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            let mut port_found = false;

            while let Ok(Some(line)) = reader.next_line().await {
                if let Some(port_str) = line.strip_prefix("__PORT__:") {
                    if let Ok(port) = port_str.trim().parse::<u16>() {
                        port_clone.store(port, Ordering::Relaxed);
                        port_found = true;
                        println!("后端实际端口: {}", port);
                    }
                } else {
                    println!("[backend] {}", line);
                }
            }

            pid_clone.store(0, Ordering::Relaxed);
            should_be_running.store(false, Ordering::Relaxed);
            if !port_found {
                port_clone.store(0, Ordering::Relaxed);
            }
        });

        self.pid.store(child_pid, Ordering::Relaxed);
        self.should_be_running.store(true, Ordering::Relaxed);
        self.health_failures.store(0, Ordering::Relaxed);

        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        self.started_at.store(now, Ordering::Relaxed);

        // 等待后端输出端口号（最多 10 秒）
        let mut waited = 0;
        while self.backend_port.load(Ordering::Relaxed) == 0 && waited < 100 {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            waited += 1;
        }

        let port = self.backend_port.load(Ordering::Relaxed);
        if port == 0 {
            return Err("后端启动超时，未获取到端口号".into());
        }

        Ok(port)
    }

    /// 停止服务
    pub async fn stop(&self) -> Result<(), String> {
        self.should_be_running.store(false, Ordering::Relaxed);

        let pid = self.pid.load(Ordering::Relaxed);
        let port = self.backend_port.load(Ordering::Relaxed);

        if pid == 0 {
            return Ok(());
        }

        // 尝试优雅关闭
        if port > 0 {
            let _ = reqwest::Client::new()
                .post(format!("http://127.0.0.1:{}/api/v1/shutdown", port))
                .timeout(std::time::Duration::from_secs(3))
                .send()
                .await;
        }

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // 使用 taskkill 强制终止
        let _ = tokio::process::Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .creation_flags(0x08000000)
            .output()
            .await;

        self.pid.store(0, Ordering::Relaxed);
        self.backend_port.store(0, Ordering::Relaxed);
        self.started_at.store(0, Ordering::Relaxed);
        Ok(())
    }

    /// 重启服务
    pub async fn restart(&self, node_path: &str, server_script: &str, work_dir: &str) -> Result<u16, String> {
        self.stop().await?;
        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        self.start(node_path, server_script, work_dir).await
    }

    /// 获取状态（含内存和 CPU）
    pub fn status(&self) -> ServerStatus {
        let pid_val = self.pid.load(Ordering::Relaxed);
        let running = pid_val != 0;
        let unhealthy = self.health_failures.load(Ordering::Relaxed) >= 3;

        let (memory_mb, cpu_percent) = if running {
            self.query_process_metrics(pid_val)
        } else {
            (0.0, 0.0)
        };

        let uptime = if running {
            let started = self.started_at.load(Ordering::Relaxed);
            if started > 0 {
                let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
                now.saturating_sub(started)
            } else {
                0
            }
        } else {
            0
        };

        ServerStatus {
            running,
            pid: if running { Some(pid_val) } else { None },
            backend_port: self.backend_port.load(Ordering::Relaxed),
            unhealthy,
            memory_mb,
            cpu_percent,
            uptime,
        }
    }

    /// 通过 sysinfo 获取进程内存和 CPU
    fn query_process_metrics(&self, pid: u32) -> (f64, f32) {
        let mut sys = System::new();
        let target = sysinfo::Pid::from_u32(pid);
        sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[target]), true);
        if let Some(proc) = sys.process(target) {
            let mem_mb = proc.memory() as f64 / 1024.0 / 1024.0;
            let cpu = proc.cpu_usage();
            (round1(mem_mb), cpu)
        } else {
            (0.0, 0.0)
        }
    }

    /// 获取后端端口
    pub fn get_backend_port(&self) -> u16 {
        self.backend_port.load(Ordering::Relaxed)
    }

    /// 获取进程 PID
    pub fn get_pid(&self) -> u32 {
        self.pid.load(Ordering::Relaxed)
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

/// 保留一位小数
fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}
