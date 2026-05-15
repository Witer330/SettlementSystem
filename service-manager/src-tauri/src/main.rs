#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod health;
mod process;
mod tray;

use config::AppConfig;
use process::ProcessManager;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Manager};

const TASK_NAME: &str = "SettlementServiceManager";

/// 反向代理进程 PID（独立 exe，脱离托盘生命周期）
static PROXY_PID: AtomicU32 = AtomicU32::new(0);

/// 获取安装目录（manager.exe 所在目录）
fn get_install_dir() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe_path.parent().unwrap_or(&exe_path).to_path_buf())
}

/// 写 PID 文件供安装器/卸载器读取
fn write_pid_file(backend_pid: u32, proxy_pid: u32, backend_port: u16) {
    if let Ok(install_dir) = get_install_dir() {
        let path = install_dir.join("pids.json");
        let content = serde_json::json!({
            "backend_pid": backend_pid,
            "proxy_pid": proxy_pid,
            "backend_port": backend_port
        });
        let _ = std::fs::write(&path, content.to_string());
    }
}

/// 删除 PID 文件（服务停止后清理）
fn remove_pid_file() {
    if let Ok(install_dir) = get_install_dir() {
        let _ = std::fs::remove_file(install_dir.join("pids.json"));
    }
}

// ── 服务生命周期 ──────────────────────────────────────────

/// 启动反向代理独立进程
async fn start_proxy_process(install_dir: &PathBuf, proxy_port: u16, backend_port: u16, host: &str) -> Result<u32, String> {
    let proxy_exe = install_dir.join("settlement-proxy.exe");
    let mut cmd = tokio::process::Command::new(proxy_exe.to_string_lossy().as_ref());
    cmd.args([
        "--port", &proxy_port.to_string(),
        "--backend-port", &backend_port.to_string(),
        "--host", host,
    ])
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped())
    .creation_flags(0x09000200); // NO_WINDOW | NEW_PROCESS_GROUP | BREAKAWAY_FROM_JOB

    let mut child = cmd.spawn().map_err(|e| format!("启动代理失败: {}", e))?;
    let pid = child.id().unwrap_or(0);

    // 读取 stdout 获取 __PROXY_READY__
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
            .creation_flags(0x08000000)
            .output()
            .await;
    }
}

// ── Tauri 命令 ─────────────────────────────────────────────

#[tauri::command]
async fn get_server_status(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<process::ServerStatus, String> {
    Ok(manager.status())
}

#[tauri::command]
async fn start_server(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    let install_dir = get_install_dir()?;
    let node_path = PathBuf::from("node");
    let server_script = install_dir.join("backend").join("dist").join("index.js");
    let work_dir = install_dir.join("backend");

    // 停止旧代理
    stop_proxy_process().await;

    let backend_port = manager.start(
        &node_path.to_string_lossy(),
        &server_script.to_string_lossy(),
        &work_dir.to_string_lossy(),
        true,
    ).await?;

    // 启动独立代理进程
    let config = config_state.read().await;
    let proxy_pid: u32;
    match start_proxy_process(&install_dir, config.proxy_port, backend_port, &config.host).await {
        Ok(pid) => {
            proxy_pid = pid;
            println!("代理进程已启动, PID: {}", pid);
        }
        Err(e) => {
            manager.stop().await;
            return Err(format!("代理启动失败: {}", e));
        }
    }
    drop(config);

    // 写 PID 文件供安装/卸载程序使用
    write_pid_file(manager.get_pid(), proxy_pid, backend_port);

    let _ = app.emit("server-started", backend_port);
    Ok(())
}

#[tauri::command]
async fn stop_server(manager: tauri::State<'_, Arc<ProcessManager>>) -> Result<(), String> {
    stop_proxy_process().await;
    manager.stop().await?;
    remove_pid_file();
    Ok(())
}

#[tauri::command]
async fn restart_server(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
) -> Result<(), String> {
    stop_proxy_process().await;
    manager.stop().await?;
    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

    let install_dir = get_install_dir()?;
    let node_path = PathBuf::from("node");
    let server_script = install_dir.join("backend").join("dist").join("index.js");
    let work_dir = install_dir.join("backend");

    let backend_port = manager.start(
        &node_path.to_string_lossy(),
        &server_script.to_string_lossy(),
        &work_dir.to_string_lossy(),
        true,
    ).await?;

    let config = config_state.read().await;
    match start_proxy_process(&install_dir, config.proxy_port, backend_port, &config.host).await {
        Ok(pid) => {
            write_pid_file(manager.get_pid(), pid, backend_port);
            println!("代理进程已启动, PID: {}", pid);
        }
        Err(e) => {
            manager.stop().await;
            return Err(format!("代理启动失败: {}", e));
        }
    }
    drop(config);

    let _ = app.emit("server-started", backend_port);
    Ok(())
}

#[tauri::command]
async fn read_logs() -> Result<String, String> {
    let install_dir = get_install_dir()?;
    let log_path = install_dir.join("logs").join("server.log");
    match std::fs::read_to_string(&log_path) {
        Ok(content) => Ok(content),
        Err(_) => Ok(String::new()),
    }
}

#[tauri::command]
async fn open_browser(config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>) -> Result<(), String> {
    let config = config_state.read().await;
    open::that(config.access_url()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_config(config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>) -> Result<AppConfig, String> {
    Ok(config_state.read().await.clone())
}

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

#[tauri::command]
async fn check_port(port: u16) -> Result<bool, String> {
    Ok(AppConfig::is_port_available(port))
}

#[tauri::command]
async fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
        Ok(())
    } else {
        Err("找不到主窗口".into())
    }
}

#[tauri::command]
async fn get_lan_ip() -> Result<String, String> {
    use std::net::UdpSocket;
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.connect("8.8.8.8:80").map_err(|e| e.to_string())?;
    Ok(socket.local_addr().map_err(|e| e.to_string())?.ip().to_string())
}

#[tauri::command]
async fn get_db_status() -> Result<bool, String> {
    let install_dir = get_install_dir()?;
    Ok(install_dir.join("backend").join("prisma").join("data").join("settlement.db").exists())
}

// ── 开机自启动 ─────────────────────────────────────────────

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

#[tauri::command]
async fn enable_autostart() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let output = tokio::process::Command::new("schtasks")
        .args([
            "/Create", "/TN", TASK_NAME,
            "/TR", &format!("\"{}\" --autostart", exe_path.display()),
            "/SC", "ONLOGON", "/F",
        ])
        .creation_flags(0x08000000)
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!("注册计划任务失败: {}", String::from_utf8_lossy(&output.stderr).trim()))
    }
}

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
        Err(format!("删除计划任务失败: {}", String::from_utf8_lossy(&output.stderr).trim()))
    }
}

// ── 更新迁移 ────────────────────────────────────────────────

fn has_apply_update_flag() -> bool {
    std::env::args().any(|a| a == "--apply-update")
}

fn kill_process(name: &str) {
    std::process::Command::new("taskkill")
        .args(["/F", "/IM", name])
        .creation_flags(0x08000000)
        .output()
        .ok();
}

fn kill_process_by_pid(pid: u32) {
    std::process::Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .creation_flags(0x08000000)
        .output()
        .ok();
}

fn kill_old_processes(install_dir: &PathBuf) {
    // 1. 读 pids.json 精准杀
    let pid_path = install_dir.join("pids.json");
    if let Ok(content) = std::fs::read_to_string(&pid_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            for key in &["backend_pid", "proxy_pid"] {
                if let Some(pid) = json[key].as_u64() {
                    kill_process_by_pid(pid as u32);
                }
            }
        }
    }
    // 2. 兜底按名字杀
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
        let name = src_path.file_name().unwrap();
        let dst_path = dst.join(name);

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            if dst_path.exists() {
                let _ = std::fs::remove_file(&dst_path);
            }
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("复制文件失败 {}: {}", src_path.display(), e))?;
        }
    }
    Ok(())
}

fn run_post_update(install_dir: &PathBuf) -> Result<(), String> {
    let backend_dir = install_dir.join("backend");

    let gen = std::process::Command::new("node")
        .args(["node_modules/prisma/build/index.js", "generate", "--schema=prisma/schema.prisma"])
        .current_dir(&backend_dir)
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("prisma generate 失败: {}", e))?;
    if !gen.status.success() {
        return Err(format!("prisma generate 失败:\n{}", String::from_utf8_lossy(&gen.stderr)));
    }

    let mig = std::process::Command::new("node")
        .args(["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema=prisma/schema.prisma"])
        .current_dir(&backend_dir)
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("prisma migrate deploy 失败: {}", e))?;
    if !mig.status.success() {
        return Err(format!("prisma migrate deploy 失败:\n{}", String::from_utf8_lossy(&mig.stderr)));
    }

    Ok(())
}

fn apply_update(install_dir: &PathBuf) -> Result<(), String> {
    let update_dir = install_dir.join(".update");
    if !update_dir.exists() {
        return Ok(());
    }

    println!("[apply-update] 检测到 .update 目录，开始迁移...");

    // 1. 杀旧进程
    println!("[apply-update] 停止旧进程...");
    kill_old_processes(install_dir);

    // 2. 备份数据库
    let db_path = install_dir.join("backend").join("prisma").join("data").join("settlement.db");
    let db_bak = install_dir.join("backend").join("prisma").join("data").join("settlement.db.pre-update");
    if db_path.exists() {
        println!("[apply-update] 备份数据库...");
        std::fs::copy(&db_path, &db_bak)
            .map_err(|e| format!("备份数据库失败: {}", e))?;
    }

    // 3. 递归复制 .update/* → install_dir
    println!("[apply-update] 迁移文件...");
    copy_dir_recursive(&update_dir, install_dir)?;

    // 4. 运行 Prisma 初始化和迁移
    println!("[apply-update] 运行数据库迁移...");
    if let Err(e) = run_post_update(install_dir) {
        // 回滚：恢复数据库
        println!("[apply-update] 迁移失败，回滚数据库: {}", e);
        if db_bak.exists() {
            let _ = std::fs::copy(&db_bak, &db_path);
        }
        return Err(e);
    }

    // 5. 清理
    println!("[apply-update] 清理临时文件...");
    let _ = std::fs::remove_dir_all(&update_dir);
    let _ = std::fs::remove_file(&db_bak);
    let _ = std::fs::remove_file(install_dir.join("pids.json"));

    println!("[apply-update] 迁移完成");
    Ok(())
}

// ── 主入口 ──────────────────────────────────────────────────

fn has_autostart_flag() -> bool {
    std::env::args().any(|a| a == "--autostart")
}

/// 检测是否已有实例运行（Windows 命名 Mutex）
fn is_already_running() -> bool {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;

    let name: Vec<u16> = OsStr::new("Local\\SettlementServiceManager")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    extern "system" {
        fn CreateMutexW(attr: *const u8, owner: i32, name: *const u16) -> *mut u8;
        fn GetLastError() -> u32;
        fn CloseHandle(h: *mut u8) -> i32;
    }

    const ERROR_ALREADY_EXISTS: u32 = 183;

    let already: bool;
    unsafe {
        let handle = CreateMutexW(ptr::null(), 0, name.as_ptr());
        already = GetLastError() == ERROR_ALREADY_EXISTS;
        if !handle.is_null() {
            CloseHandle(handle);
        }
    }
    already
}

fn main() {
    // 单实例检测
    if is_already_running() {
        std::process::exit(0);
    }

    // --apply-update 模式：迁移文件后正常启动
    if has_apply_update_flag() {
        if let Ok(install_dir) = get_install_dir() {
            if let Err(e) = apply_update(&install_dir) {
                eprintln!("[apply-update] 迁移失败: {}", e);
                // 不退出——即使迁移失败也要启动托盘，让用户能看到错误
            }
        }
    }

    let manager = Arc::new(ProcessManager::new());
    let autostart = has_autostart_flag();

    tauri::Builder::default()
        .manage(manager.clone())
        .setup(move |app| {
            let install_dir = get_install_dir().unwrap_or_default();
            let config = AppConfig::load(&install_dir);
            let proxy_port = config.proxy_port;
            let config_state = Arc::new(tokio::sync::RwLock::new(config));
            app.manage(config_state);

            // 创建系统托盘
            tray::create_tray(app.handle(), manager.clone(), proxy_port)?;

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(debug_assertions)]
                window.open_devtools();

                // 关闭窗口 → 隐藏到托盘（不退出）
                let win_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let _ = win_clone.hide();
                    }
                });

                // 端口冲突 → 显示窗口
                if !AppConfig::is_port_available(proxy_port) {
                    window.show()?;
                    window.set_focus()?;
                    let _ = app.handle().emit("port-conflict", proxy_port);
                } else {
                    window.hide()?;
                }
            }

            // --autostart 模式
            if autostart {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    let _ = app_handle.emit("auto-start-trigger", ());
                });
            }

            health::start_health_check(app.handle().clone(), manager, proxy_port);

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
