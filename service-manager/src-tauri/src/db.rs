/// 数据库初始化 — SQLite 自动创建 + 迁移执行

use std::os::windows::process::CommandExt;
use std::path::PathBuf;

use crate::process::DbStatus;

const DB_RELATIVE_PATH: &str = "backend/prisma/data/settlement.db";

/// 检查数据库是否已初始化（SQLite 文件存在即视为已配置）
pub fn check_db_configured_inner(install_dir: &PathBuf) -> bool {
    install_dir.join(DB_RELATIVE_PATH).exists()
}

/// 确保 SQLite 数据库已初始化（首次运行自动创建）
pub fn ensure_db_initialized(install_dir: &PathBuf) -> Result<(), String> {
    let data_dir = install_dir.join("backend/prisma/data");
    if !data_dir.exists() {
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| format!("创建数据目录失败: {}", e))?;
    }
    run_prisma_init(install_dir)
}

/// 运行 prisma generate + migrate deploy
fn run_prisma_init(install_dir: &PathBuf) -> Result<(), String> {
    let bd = install_dir.join("backend");
    for (cmd, arg) in &[("generate", "--schema=prisma/schema.prisma"), ("migrate deploy", "--schema=prisma/schema.prisma")] {
        let args: Vec<&str> = cmd.split_whitespace().chain(std::iter::once(*arg)).collect();
        let out = std::process::Command::new("node")
            .arg("node_modules/prisma/build/index.js")
            .args(&args)
            .current_dir(&bd)
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| format!("prisma 失败: {}", e))?;
        if !out.status.success() {
            return Err(format!("prisma {} 失败:\n{}", cmd, String::from_utf8_lossy(&out.stderr)));
        }
    }
    Ok(())
}

/// 获取数据库状态（用于面板显示）
pub fn get_db_status(install_dir: &PathBuf) -> DbStatus {
    let exists = install_dir.join(DB_RELATIVE_PATH).exists();
    DbStatus {
        configured: exists,
        connected: exists,
        path: DB_RELATIVE_PATH.to_string(),
    }
}

// ── Tauri 命令 ──

#[tauri::command]
pub async fn check_db_configured() -> Result<bool, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let install_dir = exe.parent().unwrap_or(&exe).to_path_buf();
    Ok(check_db_configured_inner(&install_dir))
}

#[tauri::command]
pub async fn run_db_migrations() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let install_dir = exe.parent().unwrap_or(&exe).to_path_buf();
    run_prisma_init(&install_dir)
}
