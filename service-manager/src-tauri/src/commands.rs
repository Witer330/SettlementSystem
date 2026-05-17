use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Manager};

use crate::config::AppConfig;
use crate::process::{ProcessManager, ServerStatus};

/// 反向代理进程 PID
pub static PROXY_PID: AtomicU32 = AtomicU32::new(0);

/// 获取安装目录
pub fn get_install_dir() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe_path.parent().unwrap_or(&exe_path).to_path_buf())
}

pub fn write_pid_file(backend_pid: u32, proxy_pid: u32, backend_port: u16) {
    if let Ok(install_dir) = get_install_dir() {
        let content = serde_json::json!({ "backend_pid": backend_pid, "proxy_pid": proxy_pid, "backend_port": backend_port });
        let _ = std::fs::write(install_dir.join("pids.json"), content.to_string());
    }
}

pub fn remove_pid_file() {
    if let Ok(install_dir) = get_install_dir() {
        let _ = std::fs::remove_file(install_dir.join("pids.json"));
    }
}

pub async fn start_proxy_process(install_dir: &PathBuf, proxy_port: u16, backend_port: u16, host: &str) -> Result<u32, String> {
    let proxy_exe = install_dir.join("settlement-proxy.exe");
    let mut cmd = tokio::process::Command::new(proxy_exe.to_string_lossy().as_ref());
    cmd.args(["--port", &proxy_port.to_string(), "--backend-port", &backend_port.to_string(), "--host", host])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x09000200);

    let mut child = cmd.spawn().map_err(|e| format!("启动代理失败: {}", e))?;
    let pid = child.id().unwrap_or(0);
    if let Some(stdout) = child.stdout.take() {
        use tokio::io::AsyncBufReadExt;
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        if let Ok(Some(line)) = reader.next_line().await {
            println!("[proxy] {}", line);
        }
    }
    PROXY_PID.store(pid, Ordering::Relaxed);
    Ok(pid)
}

pub async fn stop_proxy_process() {
    let pid = PROXY_PID.swap(0, Ordering::Relaxed);
    if pid != 0 {
        let _ = tokio::process::Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .creation_flags(0x08000000).output().await;
    }
}

// ── Tauri 命令 ──

#[tauri::command]
pub async fn get_server_status(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<ServerStatus, String> {
    Ok(manager.status())
}

#[tauri::command]
pub async fn start_server(app: tauri::AppHandle, manager: tauri::State<'_, Arc<ProcessManager>>, config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>) -> Result<(), String> {
    let install_dir = get_install_dir()?;
    stop_proxy_process().await;
    let backend_port = manager.start("node", &install_dir.join("backend").join("dist").join("index.js").to_string_lossy(), &install_dir.join("backend").to_string_lossy(), true).await?;

    let config = config_state.read().await;
    match start_proxy_process(&install_dir, config.proxy_port, backend_port, &config.host).await {
        Ok(pid) => { write_pid_file(manager.get_pid(), pid, backend_port); }
        Err(e) => { manager.stop().await; return Err(format!("代理启动失败: {}", e)); }
    }
    drop(config);
    let _ = app.emit("server-started", backend_port);
    Ok(())
}

#[tauri::command]
pub async fn stop_server(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<(), String> {
    stop_proxy_process().await;
    manager.stop().await?;
    remove_pid_file();
    Ok(())
}

#[tauri::command]
pub async fn restart_server(app: tauri::AppHandle, manager: tauri::State<'_, Arc<ProcessManager>>, config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>) -> Result<(), String> {
    stop_proxy_process().await;
    manager.stop().await?;
    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
    let install_dir = get_install_dir()?;
    let backend_port = manager.start("node", &install_dir.join("backend").join("dist").join("index.js").to_string_lossy(), &install_dir.join("backend").to_string_lossy(), true).await?;
    let config = config_state.read().await;
    match start_proxy_process(&install_dir, config.proxy_port, backend_port, &config.host).await {
        Ok(pid) => { write_pid_file(manager.get_pid(), pid, backend_port); }
        Err(e) => { manager.stop().await; return Err(format!("代理启动失败: {}", e)); }
    }
    drop(config);
    let _ = app.emit("server-started", backend_port);
    Ok(())
}

macro_rules! simple_cmd {
    ($name:ident, $ret:ty, $body:block) => {
        #[tauri::command] pub async fn $name() -> Result<$ret, String> $body
    };
}

simple_cmd!(read_logs, String, {
    let d = get_install_dir()?;
    match std::fs::read_to_string(d.join("logs").join("server.log")) { Ok(c) => Ok(c), Err(_) => Ok(String::new()) }
});

#[tauri::command]
pub async fn open_browser(config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>) -> Result<(), String> {
    open::that(config_state.read().await.access_url()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_config(config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>) -> Result<AppConfig, String> {
    Ok(config_state.read().await.clone())
}

#[tauri::command]
pub async fn save_config(config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>, new_config: AppConfig) -> Result<(), String> {
    let mut config = config_state.write().await;
    *config = new_config;
    config.save(&get_install_dir()?)
}

#[tauri::command] pub async fn check_port(port: u16) -> Result<bool, String> { Ok(AppConfig::is_port_available(port)) }

#[tauri::command] pub async fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    app.get_webview_window("main").ok_or::<String>("找不到主窗口".into())?.open_devtools();
    Ok(())
}

#[tauri::command] pub async fn get_lan_ip() -> Result<String, String> {
    use std::net::UdpSocket;
    let s = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    s.connect("8.8.8.8:80").map_err(|e| e.to_string())?;
    Ok(s.local_addr().map_err(|e| e.to_string())?.ip().to_string())
}

#[tauri::command] pub async fn get_db_status() -> Result<bool, String> {
    Ok(get_install_dir()?.join("backend").join("prisma").join("data").join("settlement.db").exists())
}

// ── 开机自启动 ──

const TASK_NAME: &str = "SettlementServiceManager";

#[tauri::command] pub async fn is_autostart_enabled() -> Result<bool, String> {
    use std::os::windows::process::CommandExt;
    Ok(tokio::process::Command::new("schtasks").args(["/Query", "/TN", TASK_NAME]).creation_flags(0x08000000).output().await.map_err(|e| e.to_string())?.status.success())
}

#[tauri::command] pub async fn enable_autostart() -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let out = tokio::process::Command::new("schtasks").args(["/Create", "/TN", TASK_NAME, "/TR", &format!("\"{}\" --autostart", exe.display()), "/SC", "ONLOGON", "/F"]).creation_flags(0x08000000).output().await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(format!("注册计划任务失败: {}", String::from_utf8_lossy(&out.stderr).trim())) }
}

#[tauri::command] pub async fn disable_autostart() -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let out = tokio::process::Command::new("schtasks").args(["/Delete", "/TN", TASK_NAME, "/F"]).creation_flags(0x08000000).output().await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(format!("删除计划任务失败: {}", String::from_utf8_lossy(&out.stderr).trim())) }
}
