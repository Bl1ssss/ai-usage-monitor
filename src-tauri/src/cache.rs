use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{env, fs, path::PathBuf};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppCache {
    pub deepseek: Option<Value>,
    pub opencode_go: Option<Value>,
    pub updated_at: Option<String>,
}

#[tauri::command]
pub fn load_cache() -> Result<AppCache, String> {
    let path = cache_path()?;

    if !path.is_file() {
        return Ok(AppCache {
            deepseek: None,
            opencode_go: None,
            updated_at: None,
        });
    }

    let text = fs::read_to_string(&path).map_err(|e| format!("读取缓存失败: {e}"))?;

    serde_json::from_str::<AppCache>(&text).map_err(|e| format!("解析缓存失败: {e}"))
}

#[tauri::command]
pub fn save_cache(cache: AppCache) -> Result<(), String> {
    let path = cache_path()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建缓存目录失败: {e}"))?;
    }

    let text = serde_json::to_string_pretty(&cache)
        .map_err(|e| format!("序列化缓存失败: {e}"))?;

    fs::write(&path, text).map_err(|e| format!("写入缓存失败: {e}"))
}

fn cache_path() -> Result<PathBuf, String> {
    let appdata = env::var_os("APPDATA").ok_or_else(|| "未找到 APPDATA 环境变量".to_string())?;

    Ok(PathBuf::from(appdata)
        .join("ai-usage-monitor")
        .join("cache.json"))
}
