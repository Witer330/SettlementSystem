use std::sync::Arc;
use tauri::{Emitter, Manager};

use crate::config::AppConfig;
use crate::db;
use crate::process::{AllServicesStatus, BackendStatus, ProcessManager};

use super::helpers::*;

// ── 聚合状态 ──

#[tauri::command]
pub async fn get_all_services_status(
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<AllServicesStatus, String> {
    let config = config_state.read().await;
    let proxy_port = config.proxy_port;
    drop(config);

    let backend = manager.backend_status();
    let proxy = manager.proxy_status(proxy_port);
    let install_dir = get_install_dir()?;
    let database = db::get_db_status(&install_dir);

    Ok(AllServicesStatus { backend, proxy, database })
}

// ── 分服务命令 ──

#[tauri::command]
pub async fn start_backend(app: tauri::AppHandle, manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<u16, String> {
    let install_dir = get_install_dir()?;
    let backend_port = manager.start("node", &install_dir.join("backend").join("dist").join("index.js").to_string_lossy(), &install_dir.join("backend").to_string_lossy(), true).await?;
    let _ = app.emit("server-started", backend_port);
    Ok(backend_port)
}

#[tauri::command]
pub async fn stop_backend(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<(), String> {
    // 级联：先停代理
    let proxy_pid = manager.get_proxy_pid();
    stop_proxy_by_pid(proxy_pid).await;
    manager.clear_proxy();

    // 再停后端
    manager.stop().await?;
    remove_pid_file();
    Ok(())
}

#[tauri::command]
pub async fn start_proxy(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    let backend_port = manager.get_backend_port();
    if backend_port == 0 {
        return Err("请先启动后端服务".into());
    }

    let install_dir = get_install_dir()?;

    // 先停旧代理
    let old_pid = manager.get_proxy_pid();
    stop_proxy_by_pid(old_pid).await;
    manager.clear_proxy();

    let config = config_state.read().await;
    let pid = start_proxy_process(&install_dir, config.proxy_port, backend_port, &config.host).await?;
    drop(config);

    manager.set_proxy(pid);
    write_pid_file(manager.get_pid(), pid, backend_port);
    let _ = app.emit("server-started", backend_port);
    Ok(())
}

#[tauri::command]
pub async fn stop_proxy(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<(), String> {
    let pid = manager.get_proxy_pid();
    stop_proxy_by_pid(pid).await;
    manager.clear_proxy();
    Ok(())
}

#[tauri::command]
pub async fn start_all(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    // 1. 启动后端（如未运行）
    let backend_port = if manager.get_pid() == 0 {
        let install_dir = get_install_dir()?;
        manager.start("node", &install_dir.join("backend").join("dist").join("index.js").to_string_lossy(), &install_dir.join("backend").to_string_lossy(), true).await?
    } else {
        manager.get_backend_port()
    };

    // 2. 启动代理（如未运行）
    if manager.get_proxy_pid() == 0 {
        let install_dir = get_install_dir()?;
        let config = config_state.read().await;
        let pid = start_proxy_process(&install_dir, config.proxy_port, backend_port, &config.host).await?;
        drop(config);
        manager.set_proxy(pid);
        write_pid_file(manager.get_pid(), pid, backend_port);
    }

    let _ = app.emit("server-started", backend_port);
    Ok(())
}

#[tauri::command]
pub async fn stop_all(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<(), String> {
    // 先停代理
    let proxy_pid = manager.get_proxy_pid();
    stop_proxy_by_pid(proxy_pid).await;
    manager.clear_proxy();

    // 再停后端
    manager.stop().await?;
    remove_pid_file();
    Ok(())
}

#[tauri::command]
pub async fn restart_backend(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    // 级联：重启后端需要重启代理
    let had_proxy = manager.get_proxy_pid() != 0;

    // 停代理
    let proxy_pid = manager.get_proxy_pid();
    stop_proxy_by_pid(proxy_pid).await;
    manager.clear_proxy();

    // 停后端
    manager.stop().await?;
    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

    // 启动后端
    let install_dir = get_install_dir()?;
    let backend_port = manager.start("node", &install_dir.join("backend").join("dist").join("index.js").to_string_lossy(), &install_dir.join("backend").to_string_lossy(), true).await?;

    // 如之前有代理，重新启动
    if had_proxy {
        let config = config_state.read().await;
        let pid = start_proxy_process(&install_dir, config.proxy_port, backend_port, &config.host).await?;
        drop(config);
        manager.set_proxy(pid);
        write_pid_file(manager.get_pid(), pid, backend_port);
    }

    let _ = app.emit("server-started", backend_port);
    Ok(())
}

#[tauri::command]
pub async fn restart_proxy(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    let backend_port = manager.get_backend_port();
    if backend_port == 0 {
        return Err("后端服务未运行，无法重启代理".into());
    }

    // 停旧代理
    let old_pid = manager.get_proxy_pid();
    stop_proxy_by_pid(old_pid).await;
    manager.clear_proxy();

    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // 启动新代理
    let install_dir = get_install_dir()?;
    let config = config_state.read().await;
    let pid = start_proxy_process(&install_dir, config.proxy_port, backend_port, &config.host).await?;
    drop(config);

    manager.set_proxy(pid);
    write_pid_file(manager.get_pid(), pid, backend_port);
    let _ = app.emit("server-started", backend_port);
    Ok(())
}

// ── 兼容旧命令（别名） ──

#[tauri::command]
pub async fn get_server_status(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<BackendStatus, String> {
    Ok(manager.backend_status())
}

#[tauri::command]
pub async fn start_server(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    start_all(app, manager, config_state).await
}

#[tauri::command]
pub async fn stop_server(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<(), String> {
    stop_all(manager).await
}

#[tauri::command]
pub async fn restart_server(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    restart_backend(app, manager, config_state).await
}

// ── 其他命令 ──

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
    let install_dir = get_install_dir()?;
    Ok(crate::db::check_db_configured_inner(&install_dir))
}

/// 获取各组件版本号
#[tauri::command]
pub fn get_version_info() -> Result<serde_json::Value, String> {
    let install_dir = get_install_dir()?;
    fn read_pkg_version(path: &std::path::Path) -> Option<String> {
        let content = std::fs::read_to_string(path).ok()?;
        let json: serde_json::Value = serde_json::from_str(&content).ok()?;
        json["version"].as_str().map(|s| s.to_string())
    }
    fn read_cargo_version(path: &std::path::Path) -> Option<String> {
        let content = std::fs::read_to_string(path).ok()?;
        for line in content.lines() {
            if line.starts_with("version") {
                return line.split('"').nth(1).map(|s| s.to_string());
            }
        }
        None
    }
    Ok(serde_json::json!({
        "project": read_pkg_version(&install_dir.join("package.json")).unwrap_or_default(),
        "backend": read_pkg_version(&install_dir.join("backend").join("package.json")).unwrap_or_default(),
        "frontend": read_pkg_version(&install_dir.join("frontend").join("package.json")).unwrap_or_default(),
        "manager": read_cargo_version(&install_dir.join("service-manager").join("src-tauri").join("Cargo.toml")).unwrap_or_default(),
    }))
}

// ── 开机自启动 ──

const TASK_NAME: &str = "SettlementServiceManager";

#[tauri::command] pub async fn is_autostart_enabled() -> Result<bool, String> {
    Ok(tokio::process::Command::new("schtasks").args(["/Query", "/TN", TASK_NAME]).creation_flags(0x08000000).output().await.map_err(|e| e.to_string())?.status.success())
}

#[tauri::command] pub async fn enable_autostart() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let out = tokio::process::Command::new("schtasks").args(["/Create", "/TN", TASK_NAME, "/TR", &format!("\"{}\" --silent", exe.display()), "/SC", "ONLOGON", "/F"]).creation_flags(0x08000000).output().await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(format!("注册计划任务失败: {}", String::from_utf8_lossy(&out.stderr).trim())) }
}

#[tauri::command] pub async fn disable_autostart() -> Result<(), String> {
    let out = tokio::process::Command::new("schtasks").args(["/Delete", "/TN", TASK_NAME, "/F"]).creation_flags(0x08000000).output().await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(format!("删除计划任务失败: {}", String::from_utf8_lossy(&out.stderr).trim())) }
}

// ── 桌面快捷方式 ──

#[tauri::command]
pub fn create_desktop_shortcut(url: String) -> Result<(), String> {
    let desktop = dirs::desktop_dir()
        .ok_or_else(|| "无法获取桌面路径".to_string())?;

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_default();
    let icon_path = exe_dir.join("SettlementSystem.ico");

    // 组装 .url 文件内容
    let mut content = format!("[InternetShortcut]\nURL={}", url);
    if icon_path.exists() {
        content.push_str(&format!("\nIconFile={}\nIconIndex=0", icon_path.display()));
    }

    let shortcut_path = desktop.join("SettlementSystem.url");
    std::fs::write(&shortcut_path, content)
        .map_err(|e| format!("创建快捷方式失败: {}", e))?;

    Ok(())
}
