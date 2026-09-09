use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::process::ProcessManager;

/// 创建系统托盘
pub fn create_tray(
    app: &AppHandle,
    _manager: Arc<ProcessManager>,
    proxy_port: u16,
    exit_intended: Arc<AtomicBool>,
) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "显示面板", true, None::<&str>)?;
    let start_item = MenuItem::with_id(app, "start", "启动服务", true, None::<&str>)?;
    let stop_item = MenuItem::with_id(app, "stop", "停止服务", true, None::<&str>)?;
    let browser_item = MenuItem::with_id(app, "browser", "打开浏览器", true, None::<&str>)?;
    let exit_item = MenuItem::with_id(app, "exit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show_item, &start_item, &stop_item, &browser_item, &exit_item],
    )?;

    let pkg_path = crate::commands::get_install_dir()
        .unwrap_or_default()
        .join("package.json");
    let version = std::fs::read_to_string(&pkg_path)
        .ok()
        .and_then(|c| c.lines().find(|l| l.contains("\"version\""))
            .and_then(|l| l.split('"').nth(3).map(|s| s.to_string())))
        .unwrap_or_else(|| "?".into());

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip(&format!("SettlementSystem v{} - 端口 {}", version, proxy_port))
        .on_menu_event({
            let ei = exit_intended.clone();
            move |app, event| {
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
                            let manager = app_handle.state::<Arc<ProcessManager>>();
                            let mgr = manager.inner().clone();

                            // 启动后端
                            if mgr.get_pid() == 0 {
                                let install_dir = crate::commands::get_install_dir().unwrap_or_default();
                                let _ = mgr.start(
                                    "node",
                                    &install_dir.join("backend").join("dist").join("index.js").to_string_lossy(),
                                    &install_dir.join("backend").to_string_lossy(),
                                    true,
                                ).await;
                            }

                            // 启动代理
                            if mgr.get_proxy_pid() == 0 && mgr.get_backend_port() != 0 {
                                let install_dir = crate::commands::get_install_dir().unwrap_or_default();
                                let config_state = app_handle.state::<Arc<tokio::sync::RwLock<crate::config::AppConfig>>>();
                                let config = config_state.read().await;
                                if let Ok(pid) = crate::commands::start_proxy_process(
                                    &install_dir, config.proxy_port, mgr.get_backend_port(), &config.host
                                ).await {
                                    mgr.set_proxy(pid);
                                    crate::commands::write_pid_file(mgr.get_pid(), pid, mgr.get_backend_port());
                                }
                            }
                        });
                    }
                    "stop" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let manager = app_handle.state::<Arc<ProcessManager>>();
                            let mgr = manager.inner().clone();
                            // 停代理
                            crate::commands::stop_proxy_by_pid(mgr.get_proxy_pid()).await;
                            mgr.clear_proxy();
                            // 停后端
                            let _ = mgr.stop().await;
                            crate::commands::remove_pid_file();
                        });
                    }
                    "browser" => {
                        let _ = open::that(format!("http://localhost:{}", proxy_port));
                    }
                    "exit" => {
                        let app_handle = app.clone();
                        let ei = ei.clone();
                        tauri::async_runtime::spawn(async move {
                            let manager = app_handle.state::<Arc<ProcessManager>>();
                            let mgr = manager.inner().clone();
                            crate::commands::stop_proxy_by_pid(mgr.get_proxy_pid()).await;
                            let _ = mgr.stop().await;
                            crate::commands::remove_pid_file();
                            ei.store(true, std::sync::atomic::Ordering::SeqCst);
                            app_handle.exit(0);
                        });
                    }
                    _ => {}
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
