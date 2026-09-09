/// 在线更新核心逻辑
///
/// 分层更新策略：
///   - core.tar.gz: backend/dist + frontend/dist + prisma + package.json
///   - deps.tar.gz: 完整 node_modules（依赖指纹不匹配时下载，已解压到 .update/backend/node_modules/）
///
/// 更新流程：
///   1. 读取 update-meta.json 获取更新元数据
///   2. 自动备份数据库（到 .update-auto-backup/）
///   3. 备份当前文件（用于回滚）
///   4. 替换文件（跳过受保护路径）
///   5. 如有 deps → 替换 node_modules
///   6. prisma generate + migrate deploy
///   7. 如有 manager 更新 → 准备暂存 + 启动 updater.exe

use std::os::windows::process::CommandExt;
use std::path::PathBuf;

// ── 受保护路径 ──

const PROTECTED_FILES: &[&str] = &[
    "backend/.env",
    "config.json",
];

const PROTECTED_DIRS: &[&str] = &[
    "backend/prisma/data",
    "backend/prisma/data/backup",
    "backend/prisma/data/.update-auto-backup",
];

pub fn is_protected(path: &PathBuf, install_dir: &PathBuf) -> bool {
    let rel = path.strip_prefix(install_dir).unwrap_or(path);
    let rel_str = rel.to_string_lossy().replace("\\", "/");

    for p in PROTECTED_FILES {
        if rel_str == *p { return true; }
    }
    for d in PROTECTED_DIRS {
        if rel_str.starts_with(&format!("{}/", d)) || rel_str == *d { return true; }
    }
    false
}

// ── 更新元数据 ──

/// 从 .update/update-meta.json 读取更新元数据
#[allow(dead_code)]
pub struct UpdateMeta {
    pub version: String,
    pub has_deps: bool,
    pub deps_fingerprint: String,
    pub db_migration: bool,
    pub has_manager_update: bool,
}

pub fn read_update_meta(update_dir: &PathBuf) -> Option<UpdateMeta> {
    let meta_path = update_dir.join("update-meta.json");
    if !meta_path.exists() { return None; }

    let content = std::fs::read_to_string(&meta_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;

    Some(UpdateMeta {
        version: json["version"].as_str().unwrap_or("").to_string(),
        has_deps: json["has_deps"].as_bool().unwrap_or(false),
        deps_fingerprint: json["depsFingerprint"].as_str().unwrap_or("").to_string(),
        db_migration: json["dbMigration"].as_bool().unwrap_or(false),
        has_manager_update: json["hasManagerUpdate"].as_bool().unwrap_or(false),
    })
}

// ── 自动备份（更新前） ──

/// 更新前自动备份数据库到 .update-auto-backup/（只保留一份，覆盖式）
pub fn auto_backup_before_update(install_dir: &PathBuf) -> Result<(), String> {
    let db_path = install_dir.join("backend/prisma/data/settlement.db");
    let backup_dir = install_dir.join("backend/prisma/data/.update-auto-backup");

    if !db_path.exists() {
        println!("[update] 数据库不存在，跳过自动备份");
        return Ok(());
    }

    // 清理旧备份
    if backup_dir.exists() {
        let _ = std::fs::remove_dir_all(&backup_dir);
    }
    std::fs::create_dir_all(&backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;

    // 备份数据库
    std::fs::copy(&db_path, backup_dir.join("settlement.db"))
        .map_err(|e| format!("备份数据库失败: {}", e))?;

    // 写入备份信息
    let info = serde_json::json!({
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        "type": "update_auto",
    });
    std::fs::write(backup_dir.join("backup-info.json"), info.to_string())
        .map_err(|e| format!("写入备份信息失败: {}", e))?;

    println!("[update] 数据库自动备份完成");
    Ok(())
}

/// 从自动备份恢复数据库
pub fn restore_auto_backup(install_dir: &PathBuf) -> Result<(), String> {
    let backup_dir = install_dir.join("backend/prisma/data/.update-auto-backup");
    let db_backup = backup_dir.join("settlement.db");
    let db_path = install_dir.join("backend/prisma/data/settlement.db");

    if !db_backup.exists() {
        return Err("自动备份不存在，无法恢复".into());
    }

    std::fs::copy(&db_backup, &db_path)
        .map_err(|e| format!("恢复数据库失败: {}", e))?;

    println!("[update] 数据库已从自动备份恢复");
    Ok(())
}

// ── 进程管理 ──

#[allow(dead_code)]
pub fn kill_process_by_pid(pid: u32) {
    std::process::Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .creation_flags(0x08000000)
        .output()
        .ok();
}

#[allow(dead_code)]
pub fn kill_backend_and_proxy(install_dir: &PathBuf) {
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

    std::process::Command::new("taskkill")
        .args(["/F", "/IM", "settlement-proxy.exe"])
        .creation_flags(0x08000000)
        .output()
        .ok();

    std::thread::sleep(std::time::Duration::from_secs(2));
}

// ── 文件操作 ──

pub fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    if !src.exists() { return Ok(()); }
    std::fs::create_dir_all(dst).map_err(|e| format!("创建目录失败: {}", e))?;
    for entry in std::fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(src_path.file_name().unwrap());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            if dst_path.exists() { let _ = std::fs::remove_file(&dst_path); }
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("复制文件失败 {}: {}", src_path.display(), e))?;
        }
    }
    Ok(())
}

fn copy_update_files(src: &PathBuf, dst: &PathBuf, install_dir: &PathBuf) -> Result<(), String> {
    if !src.exists() { return Ok(()); }
    std::fs::create_dir_all(dst).map_err(|e| format!("创建目录失败: {}", e))?;
    for entry in std::fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(src_path.file_name().unwrap());

        if is_protected(&dst_path, install_dir) {
            println!("[update] 跳过受保护路径: {}", dst_path.display());
            continue;
        }

        if src_path.is_dir() {
            copy_update_files(&src_path, &dst_path, install_dir)?;
        } else {
            if dst_path.exists() { let _ = std::fs::remove_file(&dst_path); }
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("复制文件失败 {}: {}", src_path.display(), e))?;
        }
    }
    Ok(())
}

fn smart_copy_update(update_dir: &PathBuf, install_dir: &PathBuf) -> Result<(), String> {
    for entry in std::fs::read_dir(update_dir).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let src_path = entry.path();
        let name = src_path.file_name().unwrap().to_string_lossy().to_string();
        let dst_path = install_dir.join(&name);

        if is_protected(&dst_path, install_dir) {
            println!("[update] 跳过受保护文件: {}", name);
            continue;
        }

        // manager/ 目录由 prepare_manager_update 单独处理
        if name == "manager" && src_path.is_dir() {
            println!("[update] 跳过 manager 目录（由自更新流程处理）");
            continue;
        }

        // node_modules/ 由 apply_deps 单独处理
        if name == "node_modules" && src_path.is_dir() {
            println!("[update] 跳过 node_modules（由依赖更新流程处理）");
            continue;
        }

        if src_path.is_dir() {
            copy_update_files(&src_path, &dst_path, install_dir)?;
        } else {
            if dst_path.exists() { let _ = std::fs::remove_file(&dst_path); }
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("复制文件失败 {}: {}", src_path.display(), e))?;
        }
    }
    Ok(())
}

// ── 依赖更新 ──

/// 替换 node_modules（从 .update/backend/node_modules/ → 安装目录的 backend/node_modules/）
fn apply_deps(update_dir: &PathBuf, install_dir: &PathBuf) -> Result<(), String> {
    let src_nm = update_dir.join("backend").join("node_modules");
    if !src_nm.exists() {
        println!("[update] 无依赖更新包，跳过");
        return Ok(());
    }

    let dst_nm = install_dir.join("backend").join("node_modules");

    // 删除旧 node_modules
    if dst_nm.exists() {
        println!("[update] 删除旧 node_modules...");
        std::fs::remove_dir_all(&dst_nm)
            .map_err(|e| format!("删除旧 node_modules 失败: {}", e))?;
    }

    // 复制新 node_modules
    println!("[update] 替换 node_modules...");
    copy_dir_recursive(&src_nm, &dst_nm)?;

    println!("[update] node_modules 替换完成");
    Ok(())
}

// ── 备份与回滚 ──

fn backup_for_rollback(install_dir: &PathBuf, backup_dir: &PathBuf) -> Result<(), String> {
    if backup_dir.exists() {
        let _ = std::fs::remove_dir_all(backup_dir);
    }
    std::fs::create_dir_all(backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;

    for dir_name in &["backend/dist", "frontend/dist", "backend/prisma"] {
        let src = install_dir.join(dir_name);
        if src.exists() {
            let dst = backup_dir.join(dir_name);
            copy_dir_recursive(&src, &dst)?;
        }
    }

    Ok(())
}

fn restore_from_rollback(backup_dir: &PathBuf, install_dir: &PathBuf) -> Result<(), String> {
    if !backup_dir.exists() { return Ok(()); }

    for dir_name in &["backend/dist", "frontend/dist", "backend/prisma"] {
        let src = backup_dir.join(dir_name);
        if src.exists() {
            let dst = install_dir.join(dir_name);
            if dst.exists() { let _ = std::fs::remove_dir_all(&dst); }
            copy_dir_recursive(&src, &dst)?;
        }
    }

    Ok(())
}

// ── 迁移 ──

fn run_prisma_update(install_dir: &PathBuf) -> Result<(), String> {
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
            return Err(format!("prisma 失败:\n{}", String::from_utf8_lossy(&out.stderr)));
        }
    }
    Ok(())
}

// ── Manager 自更新 ──

pub fn has_manager_update(update_dir: &PathBuf) -> bool {
    update_dir.join("manager").join("manager.exe").exists()
}

pub fn prepare_manager_update(install_dir: &PathBuf, update_dir: &PathBuf) -> Result<(), String> {
    let manager_src = update_dir.join("manager");
    if !manager_src.exists() { return Ok(()); }

    let staging = install_dir.join(".update-staging");
    if staging.exists() { let _ = std::fs::remove_dir_all(&staging); }
    std::fs::create_dir_all(&staging).map_err(|e| format!("创建暂存目录失败: {}", e))?;

    let new_manager = manager_src.join("manager.exe");
    if new_manager.exists() {
        std::fs::copy(&new_manager, staging.join("manager.exe"))
            .map_err(|e| format!("复制 manager.exe 失败: {}", e))?;
    }

    let new_proxy = manager_src.join("proxy.exe");
    if new_proxy.exists() {
        std::fs::copy(&new_proxy, staging.join("settlement-proxy.exe"))
            .map_err(|e| format!("复制 proxy.exe 失败: {}", e))?;
    }

    // 复制新 updater.exe
    let new_updater = manager_src.join("updater.exe");
    if new_updater.exists() {
        std::fs::copy(&new_updater, staging.join("settlement-updater.exe"))
            .map_err(|e| format!("复制 updater.exe 失败: {}", e))?;
    }

    let info = serde_json::json!({
        "manager_pid": std::process::id(),
        "install_dir": install_dir.to_string_lossy(),
    });
    std::fs::write(staging.join("update-info.json"), info.to_string())
        .map_err(|e| format!("写入更新信息失败: {}", e))?;

    Ok(())
}

pub fn launch_self_updater(install_dir: &PathBuf) -> Result<(), String> {
    let updater_exe = install_dir.join("settlement-updater.exe");
    if !updater_exe.exists() {
        return Err("settlement-updater.exe 不存在，无法更新管理器".into());
    }

    let staging = install_dir.join(".update-staging");
    if !staging.exists() {
        return Err("更新暂存目录不存在".into());
    }

    std::process::Command::new(updater_exe)
        .arg(&staging)
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("启动更新程序失败: {}", e))?;

    Ok(())
}

// ── 主逻辑 ──

/// 在线更新主逻辑
/// 前置条件：调用方必须已停止后端和代理服务
/// 返回 true 表示需要 Manager 自更新
pub fn do_apply_update(install_dir: &PathBuf, update_dir: &PathBuf) -> Result<bool, String> {
    println!("[update] 开始应用更新...");

    // 读取更新元数据
    let meta = read_update_meta(update_dir);
    let has_deps = meta.as_ref().map(|m| m.has_deps).unwrap_or(false);

    // 1. 自动备份数据库
    println!("[update] 自动备份数据库...");
    if let Err(e) = auto_backup_before_update(install_dir) {
        println!("[update] 自动备份失败: {}，继续更新", e);
    }

    // 2. 备份当前文件（用于回滚）
    let backup_dir = install_dir.join(".update-backup");
    println!("[update] 备份当前文件...");
    backup_for_rollback(install_dir, &backup_dir)?;

    // 3. 替换 core 文件
    println!("[update] 替换 core 文件...");
    if let Err(e) = smart_copy_update(update_dir, install_dir) {
        println!("[update] 替换失败，回滚: {}", e);
        let _ = restore_from_rollback(&backup_dir, install_dir);
        let _ = restore_auto_backup(install_dir);
        let _ = std::fs::remove_dir_all(&backup_dir);
        return Err(e);
    }

    // 4. 替换 node_modules（如有 deps）
    if has_deps {
        println!("[update] 替换依赖包...");
        if let Err(e) = apply_deps(update_dir, install_dir) {
            println!("[update] 依赖替换失败: {}，继续更新", e);
        }
    }

    // 5. prisma migrate deploy
    println!("[update] 运行数据库迁移...");
    if let Err(e) = run_prisma_update(install_dir) {
        println!("[update] 数据库迁移失败，回滚: {}", e);
        let _ = restore_from_rollback(&backup_dir, install_dir);
        let _ = restore_auto_backup(install_dir);
        let _ = std::fs::remove_dir_all(&backup_dir);
        return Err(e);
    }

    // 6. 检测是否需要更新 manager 自身
    let needs_manager_update = has_manager_update(update_dir);
    if needs_manager_update {
        println!("[update] 检测到管理器更新，准备暂存文件...");
        prepare_manager_update(install_dir, update_dir)?;
    }

    // 7. 清理
    let _ = std::fs::remove_dir_all(update_dir);
    let _ = std::fs::remove_dir_all(&backup_dir);
    let _ = std::fs::remove_file(install_dir.join("pids.json"));

    println!("[update] 更新完成");
    Ok(needs_manager_update)
}
