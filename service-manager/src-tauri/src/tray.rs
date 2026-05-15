use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};

use crate::process::ProcessManager;
use std::sync::Arc;

/// 获取安装目录
fn get_install_dir() -> std::path::PathBuf {
    let exe_path = std::env::current_exe().unwrap_or_default();
    exe_path.parent().unwrap_or(&exe_path).to_path_buf()
}

/// 创建系统托盘
pub fn create_tray(app: &AppHandle, manager: Arc<ProcessManager>, proxy_port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "显示面板", true, None::<&str>)?;
    let start_item = MenuItem::with_id(app, "start", "启动服务", true, None::<&str>)?;
    let stop_item = MenuItem::with_id(app, "stop", "停止服务", true, None::<&str>)?;
    let browser_item = MenuItem::with_id(app, "browser", "打开浏览器", true, None::<&str>)?;
    let exit_item = MenuItem::with_id(app, "exit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show_item, &start_item, &stop_item, &browser_item, &exit_item],
    )?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip(&format!("SettlementSystem - 端口 {}", proxy_port))
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "start" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        // 通过调用 start_server Tauri 命令来启动
                        let manager = app_handle.state::<Arc<ProcessManager>>();
                        let install_dir = get_install_dir();
                        let node_path = std::path::PathBuf::from("node");
                        let server_script = install_dir.join("backend").join("dist").join("index.js");
                        let work_dir = install_dir.join("backend");

                        let mgr = manager.inner().clone();
                        let _ = mgr.start(
                            &node_path.to_string_lossy(),
                            &server_script.to_string_lossy(),
                            &work_dir.to_string_lossy(),
                            true,
                        ).await;
                    });
                }
                "stop" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let manager = app_handle.state::<Arc<ProcessManager>>();
                        let _ = manager.stop().await;
                    });
                }
                "browser" => {
                    let _ = open::that(format!("http://localhost:{}", proxy_port));
                }
                "exit" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let manager = app_handle.state::<Arc<ProcessManager>>();
                        crate::stop_proxy_process().await;
                        let _ = manager.stop().await;
                        crate::remove_pid_file();
                        app_handle.exit(0);
                    });
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
