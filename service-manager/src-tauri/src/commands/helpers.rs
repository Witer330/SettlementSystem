#[allow(unused_imports)]
use std::os::windows::process::CommandExt;

/// 获取安装目录
pub fn get_install_dir() -> Result<std::path::PathBuf, String> {
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

pub async fn start_proxy_process(install_dir: &std::path::PathBuf, proxy_port: u16, backend_port: u16, host: &str) -> Result<u32, String> {
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
    Ok(pid)
}

pub async fn stop_proxy_by_pid(pid: u32) {
    if pid != 0 {
        let _ = tokio::process::Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .creation_flags(0x08000000).output().await;
    }
}
