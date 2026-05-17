#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod health;
mod process;
mod tray;

use commands::*;
use config::AppConfig;
use process::ProcessManager;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, Manager};

// ── 更新迁移 ────────────────────────────────────────────────

fn has_apply_update_flag() -> bool { std::env::args().any(|a| a == "--apply-update") }

fn kill_process(name: &str) {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("taskkill").args(["/F", "/IM", name]).creation_flags(0x08000000).output().ok();
}

fn kill_process_by_pid(pid: u32) {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("taskkill").args(["/F", "/PID", &pid.to_string()]).creation_flags(0x08000000).output().ok();
}

fn kill_old_processes(install_dir: &PathBuf) {
    let pid_path = install_dir.join("pids.json");
    if let Ok(content) = std::fs::read_to_string(&pid_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            for key in &["backend_pid", "proxy_pid"] {
                if let Some(pid) = json[key].as_u64() { kill_process_by_pid(pid as u32); }
            }
        }
    }
    kill_process("settlement-proxy.exe");
    kill_process("node.exe");
    std::thread::sleep(std::time::Duration::from_secs(2));
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    if !src.exists() { return Ok(()); }
    std::fs::create_dir_all(dst).map_err(|e| format!("创建目录失败: {}", e))?;
    for entry in std::fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(src_path.file_name().unwrap());
        if src_path.is_dir() { copy_dir_recursive(&src_path, &dst_path)?; }
        else { if dst_path.exists() { let _ = std::fs::remove_file(&dst_path); } std::fs::copy(&src_path, &dst_path).map_err(|e| format!("复制文件失败 {}: {}", src_path.display(), e))?; }
    }
    Ok(())
}

fn run_post_update(install_dir: &PathBuf) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let bd = install_dir.join("backend");
    for (cmd, arg) in &[("generate", "--schema=prisma/schema.prisma"), ("migrate deploy", "--schema=prisma/schema.prisma")] {
        let args: Vec<&str> = cmd.split_whitespace().chain(std::iter::once(*arg)).collect();
        let out = std::process::Command::new("node").arg("node_modules/prisma/build/index.js").args(&args).current_dir(&bd).creation_flags(0x08000000).output().map_err(|e| format!("prisma 失败: {}", e))?;
        if !out.status.success() { return Err(format!("prisma 失败:\n{}", String::from_utf8_lossy(&out.stderr))); }
    }
    Ok(())
}

fn apply_update(install_dir: &PathBuf) -> Result<(), String> {
    let update_dir = install_dir.join(".update");
    if !update_dir.exists() { return Ok(()); }
    println!("[apply-update] 检测到 .update 目录...");
    kill_old_processes(install_dir);

    let db = install_dir.join("backend").join("prisma").join("data").join("settlement.db");
    let db_bak = db.with_extension("db.pre-update");
    if db.exists() { std::fs::copy(&db, &db_bak).map_err(|e| format!("备份数据库失败: {}", e))?; }

    copy_dir_recursive(&update_dir, install_dir)?;

    if let Err(e) = run_post_update(install_dir) {
        if db_bak.exists() { let _ = std::fs::copy(&db_bak, &db); }
        return Err(e);
    }

    let _ = std::fs::remove_dir_all(&update_dir);
    let _ = std::fs::remove_file(&db_bak);
    let _ = std::fs::remove_file(install_dir.join("pids.json"));
    println!("[apply-update] 迁移完成");
    Ok(())
}

// ── 主入口 ──────────────────────────────────────────────────

fn has_autostart_flag() -> bool { std::env::args().any(|a| a == "--autostart") }

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
    if has_apply_update_flag() {
        if let Ok(d) = commands::get_install_dir() { let _ = apply_update(&d); }
    }

    let manager = Arc::new(ProcessManager::new());
    let autostart = has_autostart_flag();

    tauri::Builder::default()
        .manage(manager.clone())
        .setup(move |app| {
            let install_dir = commands::get_install_dir().unwrap_or_default();
            let config = AppConfig::load(&install_dir);
            let pp = config.proxy_port;
            let config_state = Arc::new(tokio::sync::RwLock::new(config));
            app.manage(config_state);

            tray::create_tray(app.handle(), manager.clone(), pp)?;

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(debug_assertions)] window.open_devtools();
                let wc = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event { let _ = wc.hide(); }
                });
                if !AppConfig::is_port_available(pp) { window.show()?; window.set_focus()?; let _ = app.handle().emit("port-conflict", pp); }
                else { window.hide()?; }
            }

            if autostart {
                let ah = app.handle().clone();
                tauri::async_runtime::spawn(async move { tokio::time::sleep(std::time::Duration::from_secs(2)).await; let _ = ah.emit("auto-start-trigger", ()); });
            }
            health::start_health_check(app.handle().clone(), manager, pp);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_status, start_server, stop_server, restart_server, read_logs, open_browser,
            get_config, save_config, check_port, open_devtools, get_lan_ip, get_db_status,
            is_autostart_enabled, enable_autostart, disable_autostart,
        ])
        .run(tauri::generate_context!())
        .expect("启动服务管理器失败");
}
