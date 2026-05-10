#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod health;
mod process;
mod proxy;
mod tray;

use config::AppConfig;
use process::ProcessManager;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, Manager};

const TASK_NAME: &str = "SettlementServiceManager";

/// 获取安装目录（manager.exe 所在目录）
fn get_install_dir() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe_path.parent().unwrap_or(&exe_path).to_path_buf())
}

/// 获取服务状态
#[tauri::command]
async fn get_server_status(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<process::ServerStatus, String> {
    Ok(manager.status())
}

/// 启动服务（后端 + 代理）
#[tauri::command]
async fn start_server(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    let install_dir = get_install_dir()?;
    let node_path = install_dir.join("node").join("node.exe");
    let server_script = install_dir.join("backend").join("dist").join("index.js");
    let work_dir = install_dir.join("backend");

    let backend_port = manager.start(
        &node_path.to_string_lossy(),
        &server_script.to_string_lossy(),
        &work_dir.to_string_lossy(),
    ).await?;

    let config = config_state.read().await;
    let listen_addr: SocketAddr = format!("{}:{}", config.host, config.proxy_port)
        .parse()
        .map_err(|e| format!("解析监听地址失败: {}", e))?;
    drop(config);

    let manager_clone = manager.inner().clone();
    tokio::spawn(async move {
        if let Err(e) = proxy::start_proxy(listen_addr, manager_clone).await {
            eprintln!("代理启动失败: {}", e);
        }
    });

    let _ = app.emit("server-started", backend_port);
    Ok(())
}

/// 停止服务
#[tauri::command]
async fn stop_server(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<(), String> {
    manager.stop().await
}

/// 重启服务
#[tauri::command]
async fn restart_server(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    manager.stop().await?;
    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

    let install_dir = get_install_dir()?;
    let node_path = install_dir.join("node").join("node.exe");
    let server_script = install_dir.join("backend").join("dist").join("index.js");
    let work_dir = install_dir.join("backend");

    let backend_port = manager.start(
        &node_path.to_string_lossy(),
        &server_script.to_string_lossy(),
        &work_dir.to_string_lossy(),
    ).await?;

    let config = config_state.read().await;
    let listen_addr: SocketAddr = format!("{}:{}", config.host, config.proxy_port)
        .parse()
        .map_err(|e| format!("解析监听地址失败: {}", e))?;
    drop(config);

    let manager_clone = manager.inner().clone();
    tokio::spawn(async move {
        if let Err(e) = proxy::start_proxy(listen_addr, manager_clone).await {
            eprintln!("代理启动失败: {}", e);
        }
    });

    let _ = app.emit("server-started", backend_port);
    Ok(())
}

/// 读取日志
#[tauri::command]
async fn read_logs() -> Result<String, String> {
    let install_dir = get_install_dir()?;
    let log_path = install_dir.join("logs").join("server.log");

    match std::fs::read_to_string(&log_path) {
        Ok(content) => Ok(content),
        Err(_) => Ok(String::new()),
    }
}

/// 打开浏览器
#[tauri::command]
async fn open_browser(config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>) -> Result<(), String> {
    let config = config_state.read().await;
    open::that(config.access_url()).map_err(|e| e.to_string())
}

/// 获取配置
#[tauri::command]
async fn get_config(config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>) -> Result<AppConfig, String> {
    let config = config_state.read().await;
    Ok(config.clone())
}

/// 保存配置
#[tauri::command]
async fn save_config(
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
    new_config: AppConfig,
) -> Result<(), String> {
    let install_dir = get_install_dir()?;
    let mut config = config_state.write().await;
    *config = new_config;
    config.save(&install_dir)
}

/// 检测端口是否可用
#[tauri::command]
async fn check_port(port: u16) -> Result<bool, String> {
    Ok(AppConfig::is_port_available(port))
}

/// 打开 DevTools
#[tauri::command]
async fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
        Ok(())
    } else {
        Err("找不到主窗口".into())
    }
}

/// 获取局域网 IP
#[tauri::command]
async fn get_lan_ip() -> Result<String, String> {
    use std::net::UdpSocket;
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.connect("8.8.8.8:80").map_err(|e| e.to_string())?;
    let addr = socket.local_addr().map_err(|e| e.to_string())?;
    Ok(addr.ip().to_string())
}

/// 检查数据库连接状态
#[tauri::command]
async fn get_db_status() -> Result<bool, String> {
    let install_dir = get_install_dir()?;
    let db_path = install_dir.join("backend").join("prisma").join("data").join("settlement.db");
    Ok(db_path.exists())
}

// ── 开机自启动（计划任务） ──────────────────────────────────

/// 检查计划任务是否存在
#[tauri::command]
async fn is_autostart_enabled() -> Result<bool, String> {
    let output = tokio::process::Command::new("schtasks")
        .args(["/Query", "/TN", TASK_NAME])
        .creation_flags(0x08000000)
        .output()
        .await
        .map_err(|e| e.to_string())?;
    Ok(output.status.success())
}

/// 注册开机自启动计划任务
#[tauri::command]
async fn enable_autostart() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let output = tokio::process::Command::new("schtasks")
        .args([
            "/Create",
            "/TN", TASK_NAME,
            "/TR", &format!("\"{}\" --autostart", exe_path.display()),
            "/SC", "ONLOGON",
            "/F",
        ])
        .creation_flags(0x08000000)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("注册计划任务失败: {}", stderr.trim()))
    }
}

/// 注销开机自启动计划任务
#[tauri::command]
async fn disable_autostart() -> Result<(), String> {
    let output = tokio::process::Command::new("schtasks")
        .args(["/Delete", "/TN", TASK_NAME, "/F"])
        .creation_flags(0x08000000)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("删除计划任务失败: {}", stderr.trim()))
    }
}

// ── 主入口 ──────────────────────────────────────────────────

/// 检查是否携带 --autostart 参数
fn has_autostart_flag() -> bool {
    std::env::args().any(|a| a == "--autostart")
}

fn main() {
    let manager = Arc::new(ProcessManager::new());
    let autostart = has_autostart_flag();

    tauri::Builder::default()
        .manage(manager.clone())
        .setup(move |app| {
            let install_dir = get_install_dir().unwrap_or_default();

            // 加载配置
            let config = AppConfig::load(&install_dir);
            let config_state = Arc::new(tokio::sync::RwLock::new(config.clone()));
            app.manage(config_state);

            // 创建系统托盘
            tray::create_tray(app.handle(), manager.clone(), config.proxy_port)?;

            // 窗口默认隐藏，点击托盘图标显示
            if let Some(window) = app.get_webview_window("main") {
                // 调试模式下自动打开 DevTools
                #[cfg(debug_assertions)]
                window.open_devtools();

                // 检测端口是否可用
                if !AppConfig::is_port_available(config.proxy_port) {
                    window.show()?;
                    window.set_focus()?;
                    let _ = app.handle().emit("port-conflict", config.proxy_port);
                } else {
                    window.hide()?;
                }
            }

            // --autostart 模式：自动启动前后端服务
            if autostart {
                let app_handle = app.handle().clone();
                let mgr = manager.clone();
                tauri::async_runtime::spawn(async move {
                    // 延迟 2 秒，等托盘和窗口初始化完成
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    let _ = app_handle.emit("auto-start-trigger", ());
                });
            }

            // 启动健康检查
            health::start_health_check(app.handle().clone(), manager, 4000);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_status,
            start_server,
            stop_server,
            restart_server,
            read_logs,
            open_browser,
            get_config,
            save_config,
            check_port,
            open_devtools,
            get_lan_ip,
            get_db_status,
            is_autostart_enabled,
            enable_autostart,
            disable_autostart,
        ])
        .run(tauri::generate_context!())
        .expect("启动服务管理器失败");
}
