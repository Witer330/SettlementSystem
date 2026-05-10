use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};

use crate::process::ProcessManager;
use std::sync::Arc;

/// 获取安装目录（manager.exe 所在目录）
fn get_install_dir() -> std::path::PathBuf {
    let exe_path = std::env::current_exe().unwrap_or_default();
    exe_path.parent().unwrap_or(&exe_path).to_path_buf()
}

/// 创建系统托盘
pub fn create_tray(app: &AppHandle, _manager: Arc<ProcessManager>, proxy_port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let start_item = MenuItem::with_id(app, "start", "启动服务", true, None::<&str>)?;
    let stop_item = MenuItem::with_id(app, "stop", "停止服务", true, None::<&str>)?;
    let browser_item = MenuItem::with_id(app, "browser", "打开浏览器", true, None::<&str>)?;
    let log_item = MenuItem::with_id(app, "logs", "查看日志", true, None::<&str>)?;
    let exit_item = MenuItem::with_id(app, "exit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&start_item, &stop_item, &browser_item, &log_item, &exit_item],
    )?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip(&format!("SettlementSystem - 端口 {}", proxy_port))
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "start" => {
                    let manager = app.state::<Arc<ProcessManager>>();
                    let install_dir = get_install_dir();
                    let node_path = install_dir.join("node").join("node.exe");
                    let server_script = install_dir.join("backend").join("dist").join("index.js");
                    let work_dir = install_dir.join("backend");

                    let mgr = manager.inner().clone();
                    let node = node_path.to_string_lossy().to_string();
                    let script = server_script.to_string_lossy().to_string();
                    let work = work_dir.to_string_lossy().to_string();

                    tokio::spawn(async move {
                        let _ = mgr.start(&node, &script, &work).await;
                    });
                }
                "stop" => {
                    let manager = app.state::<Arc<ProcessManager>>();
                    let mgr = manager.inner().clone();
                    tokio::spawn(async move {
                        let _ = mgr.stop().await;
                    });
                }
                "browser" => {
                    let _ = open::that(format!("http://localhost:{}", proxy_port));
                }
                "logs" => {
                    let install_dir = get_install_dir();
                    let log_path = install_dir.join("logs").join("server.log");
                    let _ = open::that(log_path);
                }
                "exit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
