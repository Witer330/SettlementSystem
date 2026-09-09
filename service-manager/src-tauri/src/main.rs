#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod db;
mod health;
mod process;
mod tray;
mod updater;

use commands::*;
use config::AppConfig;
use process::ProcessManager;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tauri::{Emitter, Manager};

fn has_silent_flag() -> bool { std::env::args().any(|a| a == "--silent") }

fn is_already_running() -> bool {
    use std::ffi::OsStr; use std::os::windows::ffi::OsStrExt; use std::ptr;
    let name: Vec<u16> = OsStr::new("Local\\SettlementServiceManager").encode_wide().chain(std::iter::once(0)).collect();
    extern "system" { fn CreateMutexW(attr: *const u8, owner: i32, name: *const u16) -> *mut u8; fn GetLastError() -> u32; fn CloseHandle(h: *mut u8) -> i32; }
    unsafe {
        let h = CreateMutexW(ptr::null(), 0, name.as_ptr());
        let already = GetLastError() == 183u32;
        if !h.is_null() { CloseHandle(h); }
        already
    }
}

fn main() {
    if is_already_running() { std::process::exit(0); }

    let manager = Arc::new(ProcessManager::new());
    let silent = has_silent_flag();

    tauri::Builder::default()
        .manage(manager.clone())
        .setup(move |app| {
            let install_dir = commands::get_install_dir().unwrap_or_default();
            let config = AppConfig::load(&install_dir);
            let pp = config.proxy_port;
            let config_state = Arc::new(tokio::sync::RwLock::new(config));
            app.manage(config_state);

            let exit_intended = Arc::new(AtomicBool::new(false));
            tray::create_tray(app.handle(), manager.clone(), pp, exit_intended.clone())?;

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(debug_assertions)] window.open_devtools();
                let wc = window.clone();
                let ei = exit_intended.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if !ei.load(std::sync::atomic::Ordering::SeqCst) {
                            api.prevent_close();
                            let _ = wc.hide();
                        }
                    }
                });

                // 数据库未初始化 → 自动创建（SQLite 零配置）
                if !db::check_db_configured_inner(&install_dir) {
                    println!("数据库未初始化，正在自动创建...");
                    if let Err(e) = db::ensure_db_initialized(&install_dir) {
                        eprintln!("数据库初始化失败: {}", e);
                    }
                }
                if !AppConfig::is_port_available(pp) {
                    window.show()?;
                    window.set_focus()?;
                    let _ = app.handle().emit("port-conflict", pp);
                } else if silent {
                    window.hide()?;
                }
            }

            if silent {
                let ah = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    let _ = ah.emit("auto-start-trigger", ());
                });
            }

            health::start_health_check(app.handle().clone(), manager, pp);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_status, start_server, stop_server, restart_server,
            get_all_services_status,
            start_backend, stop_backend, start_proxy, stop_proxy,
            start_all, stop_all, restart_backend, restart_proxy,
            read_logs, open_browser,
            get_config, save_config, check_port, open_devtools, get_lan_ip, get_db_status,
            is_autostart_enabled, enable_autostart, disable_autostart, get_version_info,
            apply_oss_update, check_oss_update, download_oss_update, get_oss_update_state,
            create_desktop_shortcut,
            db::check_db_configured, db::run_db_migrations,
        ])
        .run(tauri::generate_context!())
        .expect("启动服务管理器失败");
}
