use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;
use tokio::io::{AsyncBufReadExt, BufReader};

// ── 状态结构体 ──

#[derive(Debug, Clone, Serialize)]
pub struct BackendStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub port: u16,
    pub unhealthy: bool,
    pub memory_mb: f64,
    pub cpu_percent: f32,
    pub uptime: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProxyStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub port: u16,
    pub uptime: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DbStatus {
    pub configured: bool,
    pub connected: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AllServicesStatus {
    pub backend: BackendStatus,
    pub proxy: ProxyStatus,
    pub database: DbStatus,
}

// ── 进程管理器 ──

pub struct ProcessManager {
    // 后端
    pid: Arc<AtomicU32>,
    backend_port: Arc<AtomicU16>,
    should_be_running: Arc<AtomicBool>,
    health_failures: Arc<AtomicU32>,
    started_at: Arc<AtomicU64>,
    // 代理
    proxy_pid: Arc<AtomicU32>,
    proxy_started_at: Arc<AtomicU64>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            pid: Arc::new(AtomicU32::new(0)),
            backend_port: Arc::new(AtomicU16::new(0)),
            should_be_running: Arc::new(AtomicBool::new(false)),
            health_failures: Arc::new(AtomicU32::new(0)),
            started_at: Arc::new(AtomicU64::new(0)),
            proxy_pid: Arc::new(AtomicU32::new(0)),
            proxy_started_at: Arc::new(AtomicU64::new(0)),
        }
    }

    // ── 后端 ──

    /// 启动 Node.js 后端服务（自动分配端口）
    pub async fn start(&self, node_path: &str, server_script: &str, work_dir: &str, detached: bool) -> Result<u16, String> {
        if self.pid.load(Ordering::Relaxed) != 0 {
            return Err("服务已在运行".to_string());
        }

        // 检查 Node.js 是否可用
        let version_check = tokio::process::Command::new(node_path)
            .arg("--version")
            .creation_flags(0x08000000)
            .output()
            .await;
        if version_check.is_err() || !version_check.unwrap().status.success() {
            return Err("未检测到 Node.js，请安装 Node.js v20 LTS:\nhttps://nodejs.org/zh-cn/download".into());
        }

        let mut cmd = tokio::process::Command::new(node_path);
        cmd.arg(server_script)
           .current_dir(work_dir)
           .env("NODE_ENV", "production")
           .env("PORT", "0")
           .stdout(std::process::Stdio::piped())
           .stderr(std::process::Stdio::piped());

        let flags = if detached { 0x09000200 } else { 0x08000000 };
        cmd.creation_flags(flags);

        let mut child = cmd.spawn().map_err(|e| format!("启动失败: {}", e))?;
        let child_pid = child.id().unwrap_or(0);

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

    /// 停止后端服务
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

    /// 脱管：停止管理但不杀进程
    #[allow(dead_code)]
    pub fn detach(&self) {
        self.should_be_running.store(false, Ordering::Relaxed);
        self.pid.store(0, Ordering::Relaxed);
        self.backend_port.store(0, Ordering::Relaxed);
        self.started_at.store(0, Ordering::Relaxed);
    }

    /// 获取后端状态
    pub fn backend_status(&self) -> BackendStatus {
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

        BackendStatus {
            running,
            pid: if running { Some(pid_val) } else { None },
            port: self.backend_port.load(Ordering::Relaxed),
            unhealthy,
            memory_mb,
            cpu_percent,
            uptime,
        }
    }

    pub fn get_backend_port(&self) -> u16 {
        self.backend_port.load(Ordering::Relaxed)
    }

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

    // ── 代理 ──

    pub fn set_proxy(&self, pid: u32) {
        self.proxy_pid.store(pid, Ordering::Relaxed);
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        self.proxy_started_at.store(now, Ordering::Relaxed);
    }

    pub fn clear_proxy(&self) {
        self.proxy_pid.store(0, Ordering::Relaxed);
        self.proxy_started_at.store(0, Ordering::Relaxed);
    }

    pub fn get_proxy_pid(&self) -> u32 {
        self.proxy_pid.load(Ordering::Relaxed)
    }

    pub fn proxy_status(&self, proxy_port: u16) -> ProxyStatus {
        let pid_val = self.proxy_pid.load(Ordering::Relaxed);
        let running = pid_val != 0;

        let uptime = if running {
            let started = self.proxy_started_at.load(Ordering::Relaxed);
            if started > 0 {
                let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
                now.saturating_sub(started)
            } else {
                0
            }
        } else {
            0
        };

        ProxyStatus {
            running,
            pid: if running { Some(pid_val) } else { None },
            port: proxy_port,
            uptime,
        }
    }

    // ── 内部 ──

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
}

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}
