#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod process;
mod health;
mod tray;

use process::ProcessManager;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

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

/// 启动服务
#[tauri::command]
async fn start_server(
    manager: tauri::State<'_, Arc<ProcessManager>>,
) -> Result<(), String> {
    let install_dir = get_install_dir()?;
    let node_path = install_dir.join("node").join("node.exe");
    let server_script = install_dir.join("backend").join("dist").join("index.js");
    let work_dir = install_dir.join("backend");

    manager.start(
        &node_path.to_string_lossy(),
        &server_script.to_string_lossy(),
        &work_dir.to_string_lossy(),
    ).await
}

/// 停止服务
#[tauri::command]
async fn stop_server(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<(), String> {
    manager.stop().await
}

/// 重启服务
#[tauri::command]
async fn restart_server(
    manager: tauri::State<'_, Arc<ProcessManager>>,
) -> Result<(), String> {
    let install_dir = get_install_dir()?;
    let node_path = install_dir.join("node").join("node.exe");
    let server_script = install_dir.join("backend").join("dist").join("index.js");
    let work_dir = install_dir.join("backend");

    manager.restart(
        &node_path.to_string_lossy(),
        &server_script.to_string_lossy(),
        &work_dir.to_string_lossy(),
    ).await
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
async fn open_browser() -> Result<(), String> {
    open::that("http://localhost:4000").map_err(|e| e.to_string())
}

fn main() {
    let manager = Arc::new(ProcessManager::new());

    tauri::Builder::default()
        .manage(manager.clone())
        .invoke_handler(tauri::generate_handler![
            get_server_status,
            start_server,
            stop_server,
            restart_server,
            read_logs,
            open_browser,
        ])
        .setup(move |app| {
            // 创建系统托盘
            tray::create_tray(app.handle(), manager.clone())?;

            // 窗口默认隐藏，点击托盘图标显示
            if let Some(window) = app.get_webview_window("main") {
                window.hide()?;
            }

            // 启动健康检查
            health::start_health_check(app.handle().clone(), manager, 4000);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动服务管理器失败");
}
