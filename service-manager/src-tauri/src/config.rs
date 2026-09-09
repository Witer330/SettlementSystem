use serde::{Deserialize, Serialize};
use std::path::Path;

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 代理监听端口
    pub proxy_port: u16,
    /// 绑定地址
    pub host: String,
    /// 外网访问地址（用户手动填入，如 http://公网IP:端口 或 http://域名:端口）
    #[serde(default)]
    pub external_url: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            proxy_port: 4000,
            host: "0.0.0.0".to_string(),
            external_url: None,
        }
    }
}

impl AppConfig {
    /// 从 config.json 加载配置，不存在则返回默认值
    pub fn load(install_dir: &Path) -> Self {
        let config_path = install_dir.join("config.json");
        if config_path.exists() {
            match std::fs::read_to_string(&config_path) {
                Ok(content) => match serde_json::from_str(&content) {
                    Ok(config) => return config,
                    Err(e) => eprintln!("解析 config.json 失败: {}", e),
                },
                Err(e) => eprintln!("读取 config.json 失败: {}", e),
            }
        }
        let config = Self::default();
        let _ = config.save(install_dir);
        config
    }

    /// 保存配置到 config.json
    pub fn save(&self, install_dir: &Path) -> Result<(), String> {
        let config_path = install_dir.join("config.json");
        let content = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(&config_path, content).map_err(|e| e.to_string())
    }

    /// 检测端口是否可用
    pub fn is_port_available(port: u16) -> bool {
        std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
    }

    /// 获取访问 URL
    pub fn access_url(&self) -> String {
        if self.host == "0.0.0.0" {
            format!("http://localhost:{}", self.proxy_port)
        } else {
            format!("http://{}:{}", self.host, self.proxy_port)
        }
    }
}
