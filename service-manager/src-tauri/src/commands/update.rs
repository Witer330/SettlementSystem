use base64::Engine;
use chrono::Utc;
use flate2::read::GzDecoder;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, AtomicU8, Ordering};
use tauri::Emitter;
use tokio::time::Duration;

use crate::config::AppConfig;
use crate::process::ProcessManager;

use super::helpers::*;

// ── OSS 配置 ──
// 安全约定：AccessKey ID/Secret 属于敏感凭据，禁止硬编码在源码中（GitHub Push Protection 会拦截）。
// 运行时从 {安装目录}/backend/.env 读取（安装包由 deploy/build.cjs 写入），缺失时回退到进程环境变量。

const OSS_BUCKET: &str = "witer330-update";
const OSS_REGION: &str = "oss-cn-hangzhou";
const OSS_APP_PREFIX: &str = "settlement";

/// OSS 访问凭据（运行时加载，不进入仓库）
struct OssCredentials {
    access_key_id: String,
    access_key_secret: String,
}

/// 读取 OSS 凭据：优先 {install_dir}/backend/.env 中的
/// OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET，缺失时回退进程环境变量。
fn load_oss_credentials(install_dir: &Path) -> Result<OssCredentials, String> {
    let mut file_id: Option<String> = None;
    let mut file_secret: Option<String> = None;
    let env_path = install_dir.join("backend").join(".env");
    if let Ok(content) = std::fs::read_to_string(&env_path) {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                let value = v.trim().trim_matches('"').trim_matches('\'');
                match k.trim() {
                    "OSS_ACCESS_KEY_ID" => file_id = Some(value.to_string()),
                    "OSS_ACCESS_KEY_SECRET" => file_secret = Some(value.to_string()),
                    _ => {}
                }
            }
        }
    }

    let id = file_id
        .filter(|v| !v.is_empty())
        .or_else(|| std::env::var("OSS_ACCESS_KEY_ID").ok().filter(|v| !v.is_empty()));
    let secret = file_secret
        .filter(|v| !v.is_empty())
        .or_else(|| std::env::var("OSS_ACCESS_KEY_SECRET").ok().filter(|v| !v.is_empty()));

    match (id, secret) {
        (Some(access_key_id), Some(access_key_secret)) => {
            Ok(OssCredentials { access_key_id, access_key_secret })
        }
        _ => Err("缺少 OSS 访问凭据：请在安装目录 backend/.env 中配置 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET".to_string()),
    }
}

// ── 版本信息（与 OSS version.json 对应）──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteVersionInfo {
    pub version: String,
    #[serde(rename = "minVersion")]
    pub min_version: String,
    #[serde(rename = "releaseNotes")]
    pub release_notes: String,
    #[serde(rename = "packageUrl")]
    pub package_url: String,
    #[serde(rename = "packageHash")]
    pub package_hash: String,
    pub size: u64,
    #[serde(rename = "depsUrl")]
    pub deps_url: Option<String>,
    #[serde(rename = "depsHash")]
    pub deps_hash: Option<String>,
    #[serde(rename = "depsSize")]
    pub deps_size: u64,
    #[serde(rename = "depsFingerprint")]
    pub deps_fingerprint: String,
    #[serde(rename = "hasDeps")]
    pub has_deps: bool,
    #[serde(rename = "dbMigration")]
    pub db_migration: bool,
    #[serde(rename = "forceUpdate")]
    pub force_update: bool,
    #[serde(rename = "hasManagerUpdate")]
    pub has_manager_update: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub has_update: bool,
    pub remote_version: Option<RemoteVersionInfo>,
}

// ── 下载进度 ──

#[derive(Debug, Clone, Serialize)]
pub struct UpdateProgress {
    pub step: String,
    pub percent: u32,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadState {
    pub status: String,        // checking | downloading | verifying | extracting | ready | failed
    pub progress: u32,
    pub error: String,
    pub remote_version: Option<RemoteVersionInfo>,
    pub update_dir: Option<String>,
}

/// 内存中的下载状态
struct DownloadStore {
    status: AtomicU8,     // 0=idle, 1=downloading, 2=verifying, 3=extracting, 4=ready, 5=failed
    progress: AtomicU32,
    error: std::sync::Mutex<String>,
    update_dir: std::sync::Mutex<String>,
    remote_info: std::sync::Mutex<Option<RemoteVersionInfo>>,
}

impl DownloadStore {
    fn new() -> Self {
        Self {
            status: AtomicU8::new(0),
            progress: AtomicU32::new(0),
            error: std::sync::Mutex::new(String::new()),
            update_dir: std::sync::Mutex::new(String::new()),
            remote_info: std::sync::Mutex::new(None),
        }
    }
}

static DOWNLOAD_STORE: std::sync::LazyLock<DownloadStore> =
    std::sync::LazyLock::new(|| DownloadStore::new());

// ── 工具函数 ──

/// 生成 OSS 签名 URL
fn oss_sign_url(cred: &OssCredentials, object: &str, expires: u64) -> String {
    let string_to_sign = format!("GET\n\n\n{}\n/{}/{}", expires, OSS_BUCKET, object);
    let mut mac = Hmac::<Sha1>::new_from_slice(cred.access_key_secret.as_bytes()).unwrap();
    mac.update(string_to_sign.as_bytes());
    let signature = mac.finalize().into_bytes();
    let sig_b64 = base64::engine::general_purpose::STANDARD.encode(&signature);
    let sig_encoded = urlencoding(&sig_b64);
    format!(
        "http://{}.{}.aliyuncs.com/{}?OSSAccessKeyId={}&Expires={}&Signature={}",
        OSS_BUCKET, OSS_REGION, object, cred.access_key_id, expires, sig_encoded
    )
}

/// 简单的 URL 编码（只编码 +/= 这三个在签名中需要编码的字符）
fn urlencoding(s: &str) -> String {
    s.replace('+', "%2B")
        .replace('/', "%2F")
        .replace('=', "%3D")
}

/// 比较 semver: a > b → 1, a == b → 0, a < b → -1
fn compare_versions(a: &str, b: &str) -> i32 {
    let pa: Vec<u32> = a.split('.').filter_map(|s| s.parse().ok()).collect();
    let pb: Vec<u32> = b.split('.').filter_map(|s| s.parse().ok()).collect();
    for i in 0..3 {
        let na = pa.get(i).copied().unwrap_or(0);
        let nb = pb.get(i).copied().unwrap_or(0);
        if na > nb { return 1; }
        if na < nb { return -1; }
    }
    0
}

fn local_deps_fingerprint(install_dir: &Path) -> String {
    let pkg_path = install_dir.join("backend").join("package.json");
    let lock_path = install_dir.join("backend").join("package-lock.json");
    let pkg = std::fs::read_to_string(&pkg_path).unwrap_or_default();
    let lock = std::fs::read_to_string(&lock_path).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(pkg.as_bytes());
    hasher.update(lock.as_bytes());
    hex::encode(&hasher.finalize()[..8]) // 取前 8 字节即 16 字符
}

// ── Tauri 命令 ──

/// 检查 OSS 更新（Rust 直连 OSS，不经过后端）
#[tauri::command]
pub async fn check_oss_update() -> Result<UpdateCheckResult, String> {
    let install_dir = get_install_dir()?;
    let current_version = read_current_version(&install_dir)?;
    let cred = load_oss_credentials(&install_dir)?;

    let version_url = format!("{}/version.json", OSS_APP_PREFIX);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let expires = (Utc::now().timestamp() + 3600) as u64;
    let resp = client.get(&oss_sign_url(&cred, &version_url, expires))
        .send().await
        .map_err(|e| format!("读取 OSS version.json 失败: {}", e))?;

    let body = resp.text().await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    let info: RemoteVersionInfo = serde_json::from_str(&body)
        .map_err(|e| format!("解析 version.json 失败: {}", e))?;

    let has_update = compare_versions(&info.version, &current_version) > 0
        && compare_versions(&current_version, &info.min_version) >= 0;

    // 缓存最新版本信息供下载使用
    *DOWNLOAD_STORE.remote_info.lock().unwrap() = Some(info.clone());

    Ok(UpdateCheckResult {
        current_version,
        has_update,
        remote_version: if has_update { Some(info) } else { None },
    })
}

/// 下载 OSS 更新包到 .update/ 目录（异步，通过 get_oss_update_state 轮询进度）
#[tauri::command]
pub async fn download_oss_update(
    app: tauri::AppHandle,
) -> Result<(), String> {
    let remote = match DOWNLOAD_STORE.remote_info.lock().unwrap().as_ref() {
        Some(info) => info.clone(),
        None => return Err("请先检查更新".into()),
    };

    DOWNLOAD_STORE.status.store(1, Ordering::Relaxed);
    DOWNLOAD_STORE.progress.store(0, Ordering::Relaxed);

    let install_dir = get_install_dir()?;
    let tmp_dir = install_dir.join(".update-tmp");
    let update_dir = install_dir.join(".update");

    // 清理 + 创建目录
    if update_dir.exists() {
        let _ = std::fs::remove_dir_all(&update_dir);
    }
    std::fs::create_dir_all(&tmp_dir).map_err(|e| format!("创建临时目录失败: {}", e))?;
    std::fs::create_dir_all(&update_dir).map_err(|e| format!("创建更新目录失败: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let install_dir_clone = install_dir.clone();
    let update_dir_clone = update_dir.clone();
    let app_handle = app.clone();

    // 在后台线程执行下载（避免阻塞 Tauri 主线程）
    tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let result = match load_oss_credentials(&install_dir_clone) {
                Ok(cred) => do_download(
                    &cred, &remote, &install_dir_clone, &tmp_dir, &update_dir_clone,
                    &client, &app_handle,
                ).await,
                Err(e) => Err(e),
            };

            match result {
                Ok(_) => {
                    DOWNLOAD_STORE.status.store(4, Ordering::Relaxed); // ready
                    DOWNLOAD_STORE.progress.store(100, Ordering::Relaxed);
                    *DOWNLOAD_STORE.update_dir.lock().unwrap() = update_dir_clone.to_string_lossy().to_string();
                    let _ = app_handle.emit("update-progress",
                        UpdateProgress { step: "下载完成".into(), percent: 100, error: None });
                }
                Err(e) => {
                    DOWNLOAD_STORE.status.store(5, Ordering::Relaxed); // failed
                    *DOWNLOAD_STORE.error.lock().unwrap() = e.clone();
                    let _ = app_handle.emit("update-progress",
                        UpdateProgress { step: "下载失败".into(), percent: 0, error: Some(e.clone()) });
                }
            }
        });
    });

    Ok(())
}

async fn do_download(
    cred: &OssCredentials,
    remote: &RemoteVersionInfo,
    install_dir: &Path,
    tmp_dir: &Path,
    update_dir: &Path,
    client: &reqwest::Client,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    // ── 1. 下载 core.tar.gz ──
    let _ = app.emit("update-progress",
        UpdateProgress { step: "正在下载核心更新包...".into(), percent: 0, error: None });

    let expires = (Utc::now().timestamp() + 3600) as u64;
    let core_url = oss_sign_url(cred, &remote.package_url, expires);
    let core_path = tmp_dir.join("core.tar.gz");

    download_with_progress(client, &core_url, &core_path, 0, 50, app).await?;

    // ── 2. 校验 core SHA256 ──
    DOWNLOAD_STORE.status.store(2, Ordering::Relaxed);
    let _ = app.emit("update-progress",
        UpdateProgress { step: "正在校验核心更新包...".into(), percent: 50, error: None });

    let expected_hash = remote.package_hash.replace("sha256:", "");
    let actual_hash = compute_sha256_file(&core_path)?;
    if actual_hash != expected_hash {
        return Err(format!("核心更新包校验失败，文件可能被篡改"));
    }

    // ── 3. 解压 core ──
    DOWNLOAD_STORE.status.store(3, Ordering::Relaxed);
    let _ = app.emit("update-progress",
        UpdateProgress { step: "正在解压核心更新包...".into(), percent: 55, error: None });

    extract_tar_gz(&core_path, update_dir)?;

    // ── 4. 判断是否需要 deps ──
    let local_fp = local_deps_fingerprint(install_dir);
    let need_deps = remote.has_deps && remote.deps_fingerprint != local_fp;

    if need_deps {
        if let Some(deps_url) = &remote.deps_url {
            DOWNLOAD_STORE.status.store(1, Ordering::Relaxed);
            let _ = app.emit("update-progress",
                UpdateProgress { step: "正在下载依赖更新包...".into(), percent: 60, error: None });

            let deps_path = tmp_dir.join("deps.tar.gz");
            download_with_progress(client, &oss_sign_url(cred, deps_url, expires), &deps_path, 60, 85, app).await?;

            // 校验 deps
            DOWNLOAD_STORE.status.store(2, Ordering::Relaxed);
            if let Some(deps_hash) = &remote.deps_hash {
                let expected = deps_hash.replace("sha256:", "");
                let actual = compute_sha256_file(&deps_path)?;
                if actual != expected {
                    return Err(format!("依赖更新包校验失败"));
                }
            }

            // 解压 deps 到 backend/node_modules
            DOWNLOAD_STORE.status.store(3, Ordering::Relaxed);
            let _ = app.emit("update-progress",
                UpdateProgress { step: "正在解压依赖更新包...".into(), percent: 85, error: None });

            let nm_dir = update_dir.join("backend").join("node_modules");
            std::fs::create_dir_all(&nm_dir)
                .map_err(|e| format!("创建 node_modules 目录失败: {}", e))?;
            extract_tar_gz(&deps_path, &nm_dir)?;
        }

        DOWNLOAD_STORE.progress.store(90, Ordering::Relaxed);
    } else {
        DOWNLOAD_STORE.progress.store(80, Ordering::Relaxed);
    }

    // ── 5. 写更新元数据 ──
    let meta = serde_json::json!({
        "version": remote.version,
        "hasDeps": need_deps,
        "depsFingerprint": local_fp,
        "dbMigration": remote.db_migration,
        "hasManagerUpdate": remote.has_manager_update,
    });
    std::fs::write(update_dir.join("update-meta.json"), meta.to_string())
        .map_err(|e| format!("写入元数据失败: {}", e))?;

    // 清理临时文件
    let _ = std::fs::remove_dir_all(tmp_dir);

    Ok(())
}

/// 获取 OSS 更新下载状态
#[tauri::command]
pub fn get_oss_update_state() -> DownloadState {
    let status_code = DOWNLOAD_STORE.status.load(Ordering::Relaxed);
    let status = match status_code {
        0 => "idle",
        1 => "downloading",
        2 => "verifying",
        3 => "extracting",
        4 => "ready",
        5 => "failed",
        _ => "idle",
    };
    DownloadState {
        status: status.into(),
        progress: DOWNLOAD_STORE.progress.load(Ordering::Relaxed),
        error: DOWNLOAD_STORE.error.lock().unwrap().clone(),
        remote_version: DOWNLOAD_STORE.remote_info.lock().unwrap().clone(),
        update_dir: if status_code == 4 {
            Some(DOWNLOAD_STORE.update_dir.lock().unwrap().clone())
        } else {
            None
        },
    }
}

// ── 保留原有命令 ──

/// 应用 OSS 更新
#[tauri::command]
pub async fn apply_oss_update(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<ProcessManager>>,
    config_state: tauri::State<'_, Arc<tokio::sync::RwLock<AppConfig>>>,
    update_dir: String,
) -> Result<String, String> {
    let install_dir = get_install_dir()?;
    let update_path = PathBuf::from(&update_dir);

    if !update_path.exists() {
        return Err("更新目录不存在".into());
    }

    // 安全检查
    let canonical_install = install_dir.canonicalize().unwrap_or_else(|_| install_dir.clone());
    let canonical_update = update_path.canonicalize().unwrap_or_else(|_| update_path.clone());
    let expected_prefix = canonical_install.join(".update");
    if !canonical_update.starts_with(&expected_prefix) {
        return Err("更新目录路径不合法".into());
    }

    // 1. 停止服务 (0-10%)
    let _ = app.emit("update-progress", UpdateProgress { step: "停止服务".into(), percent: 5, error: None });
    let proxy_pid = manager.get_proxy_pid();
    stop_proxy_by_pid(proxy_pid).await;
    manager.clear_proxy();
    let _ = manager.stop().await;
    let _ = app.emit("update-progress", UpdateProgress { step: "服务已停止".into(), percent: 10, error: None });

    // 2. 应用更新
    let _ = app.emit("update-progress", UpdateProgress { step: "备份数据".into(), percent: 15, error: None });
    let install_dir_clone = install_dir.clone();
    let update_path_clone = update_path.clone();
    let result = tokio::task::spawn_blocking(move || {
        crate::updater::do_apply_update(&install_dir_clone, &update_path_clone)
    }).await.map_err(|e| format!("更新任务失败: {}", e))??;

    // 3. 根据结果处理
    if result {
        let _ = app.emit("update-progress", UpdateProgress { step: "管理器更新中".into(), percent: 95, error: None });
        crate::updater::launch_self_updater(&install_dir)?;
        app.exit(0);
        Ok("manager_update_needed".into())
    } else {
        let _ = app.emit("update-progress", UpdateProgress { step: "重启服务".into(), percent: 90, error: None });
        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

        let backend_port = manager.start(
            "node",
            &install_dir.join("backend").join("dist").join("index.js").to_string_lossy(),
            &install_dir.join("backend").to_string_lossy(),
            true
        ).await?;

        let config = config_state.read().await;
        let pid = start_proxy_process(&install_dir, config.proxy_port, backend_port, &config.host).await?;
        drop(config);
        manager.set_proxy(pid);
        write_pid_file(manager.get_pid(), pid, backend_port);

        let _ = app.emit("update-progress", UpdateProgress { step: "更新完成".into(), percent: 100, error: None });
        Ok("ok".into())
    }
}

// ── 内部工具函数 ──

fn read_current_version(install_dir: &Path) -> Result<String, String> {
    let pkg_path = install_dir.join("backend").join("package.json");
    let content = std::fs::read_to_string(&pkg_path)
        .map_err(|e| format!("读取 package.json 失败: {}", e))?;
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 package.json 失败: {}", e))?;
    json["version"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "package.json 中未找到 version 字段".into())
}

async fn download_with_progress(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    progress_start: u32,
    progress_end: u32,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let resp = client.get(url).send().await
        .map_err(|e| format!("下载失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = std::fs::File::create(dest)
        .map_err(|e| format!("创建文件失败: {}", e))?;
    let mut last_report: u32 = 0;

    let mut stream = resp.bytes_stream();
    use futures::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取数据失败: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("写入文件失败: {}", e))?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let pct = if progress_end > progress_start {
                let file_pct = (downloaded * 100 / total) as u32;
                progress_start + file_pct * (progress_end - progress_start) / 100
            } else {
                (downloaded * 100 / total) as u32
            };

            if pct > last_report {
                last_report = pct;
                DOWNLOAD_STORE.progress.store(pct, Ordering::Relaxed);
                let _ = app.emit("update-progress",
                    UpdateProgress { step: "下载中...".into(), percent: pct, error: None });
            }
        }
    }

    file.sync_all().map_err(|e| format!("同步文件失败: {}", e))?;
    Ok(())
}

fn compute_sha256_file(path: &Path) -> Result<String, String> {
    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("打开文件失败: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf).map_err(|e| format!("读取文件失败: {}", e))?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(&hasher.finalize()))
}

fn extract_tar_gz(src: &Path, dest: &Path) -> Result<(), String> {
    let file = std::fs::File::open(src)
        .map_err(|e| format!("打开压缩包失败: {}", e))?;
    let decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);
    archive.unpack(dest)
        .map_err(|e| format!("解压失败: {}", e))?;
    Ok(())
}

// ── hex encode helper ──
mod hex {
    pub fn encode(data: &[u8]) -> String {
        data.iter().map(|b| format!("{:02x}", b)).collect()
    }
}
