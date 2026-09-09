//! 独立更新程序 — 替换 manager.exe 和 settlement-proxy.exe
//!
//! 由 manager 在需要更新自身时启动：
//!   updater.exe <staging_dir>
//!
//! 流程：
//!   1. 读取 staging/update-info.json 获取 manager PID 和安装目录
//!   2. 等待 manager 进程退出
//!   3. 用 staging/ 下的新文件替换安装目录的旧文件
//!   4. 重新启动 manager.exe
//!   5. 清理临时文件并退出

use std::fs;
use std::path::PathBuf;
use std::os::windows::process::CommandExt;
use std::thread;
use std::time::Duration;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("[updater] 用法: updater.exe <staging_dir>");
        std::process::exit(1);
    }

    let staging = PathBuf::from(&args[1]);
    if !staging.exists() {
        eprintln!("[updater] 暂存目录不存在: {}", staging.display());
        std::process::exit(1);
    }

    // 读取更新信息
    let info_path = staging.join("update-info.json");
    let info_content = match fs::read_to_string(&info_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[updater] 读取更新信息失败: {}", e);
            std::process::exit(1);
        }
    };
    let info: serde_json::Value = match serde_json::from_str(&info_content) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("[updater] 解析更新信息失败: {}", e);
            std::process::exit(1);
        }
    };

    let manager_pid = info["manager_pid"].as_u64().unwrap_or(0) as u32;
    let install_dir = PathBuf::from(info["install_dir"].as_str().unwrap_or(""));

    if install_dir.as_os_str().is_empty() {
        eprintln!("[updater] 安装目录为空");
        std::process::exit(1);
    }

    println!("[updater] manager PID: {}", manager_pid);
    println!("[updater] 安装目录: {}", install_dir.display());

    // 等待 manager 进程退出（最多 30 秒）
    println!("[updater] 等待 manager 退出...");
    for _ in 0..30 {
        // 检查进程是否还存在
        let output = std::process::Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", manager_pid), "/NH"])
            .creation_flags(0x08000000)
            .output();

        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if !stdout.contains(&manager_pid.to_string()) {
                println!("[updater] manager 已退出");
                break;
            }
        }

        thread::sleep(Duration::from_secs(1));
    }

    // 额外等待确保文件释放
    thread::sleep(Duration::from_secs(2));

    // 替换文件
    println!("[updater] 替换文件...");

    // 替换 manager.exe
    let new_manager = staging.join("manager.exe");
    if new_manager.exists() {
        let dst = install_dir.join("settlement-service-manager.exe");
        // 先尝试直接替换
        if let Err(e) = replace_file(&new_manager, &dst) {
            eprintln!("[updater] 替换 manager.exe 失败: {}", e);
            // 如果直接替换失败，尝试先重命名旧文件
            let old = install_dir.join("settlement-service-manager.exe.old");
            let _ = fs::rename(&dst, &old);
            if let Err(e2) = replace_file(&new_manager, &dst) {
                eprintln!("[updater] 重试替换 manager.exe 失败: {}", e2);
                // 恢复旧文件
                let _ = fs::rename(&old, &dst);
                std::process::exit(1);
            }
            let _ = fs::remove_file(&old);
        }
        println!("[updater] manager.exe 替换完成");
    }

    // 替换 proxy.exe
    let new_proxy = staging.join("settlement-proxy.exe");
    if new_proxy.exists() {
        let dst = install_dir.join("settlement-proxy.exe");
        if let Err(e) = replace_file(&new_proxy, &dst) {
            eprintln!("[updater] 替换 proxy.exe 失败: {}", e);
        } else {
            println!("[updater] proxy.exe 替换完成");
        }
    }

    // 清理暂存目录
    let _ = fs::remove_dir_all(&staging);

    // 重启 manager
    println!("[updater] 重启 manager...");
    let manager_exe = install_dir.join("settlement-service-manager.exe");
    match std::process::Command::new(&manager_exe)
        .creation_flags(0x08000000)
        .spawn()
    {
        Ok(_) => println!("[updater] manager 已启动"),
        Err(e) => eprintln!("[updater] 启动 manager 失败: {}", e),
    }

    println!("[updater] 更新完成，退出");
}

/// 替换文件：先删除目标，再复制源文件
fn replace_file(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    if dst.exists() {
        fs::remove_file(dst).map_err(|e| format!("删除旧文件失败: {}", e))?;
    }
    fs::copy(src, dst).map_err(|e| format!("复制新文件失败: {}", e))?;
    Ok(())
}
