use serde::Serialize;
use serde_json::Value;
use std::{env, fs, path::PathBuf};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SourceCheck {
    found: bool,
    usable: bool,
    path: Option<String>,
    value: Option<String>,
    source: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDiscovery {
    codex_auth: SourceCheck,
    opencode_go_config: SourceCheck,
    deepseek_env: SourceCheck,
    proxy_env: SourceCheck,
}

#[tauri::command]
pub fn discover_local_sources() -> LocalDiscovery {
    LocalDiscovery {
        codex_auth: discover_codex_auth(),
        opencode_go_config: discover_opencode_go_config(),
        deepseek_env: discover_deepseek_env(),
        proxy_env: discover_proxy_env(),
    }
}

fn discover_codex_auth() -> SourceCheck {
    let mut candidates: Vec<(PathBuf, String)> = Vec::new();

    if let Some(codex_home) = env::var_os("CODEX_HOME") {
        candidates.push((
            PathBuf::from(codex_home).join("auth.json"),
            "CODEX_HOME".to_string(),
        ));
    }

    if let Some(user_profile) = env::var_os("USERPROFILE") {
        candidates.push((
            PathBuf::from(user_profile).join(".codex").join("auth.json"),
            "%USERPROFILE%\\.codex\\auth.json".to_string(),
        ));
    }

    if let Some(home) = env::var_os("HOME") {
        candidates.push((
            PathBuf::from(home).join(".codex").join("auth.json"),
            "$HOME/.codex/auth.json".to_string(),
        ));
    }

    for (path, source) in candidates {
        if !path.is_file() {
            continue;
        }

        let path_text = path.display().to_string();
        let text = match fs::read_to_string(&path) {
            Ok(value) => value,
            Err(error) => {
                return source_check(
                    true,
                    false,
                    Some(path_text),
                    None,
                    source,
                    format!("发现 Codex auth.json，但无法读取: {error}"),
                );
            }
        };

        let value: Value = match serde_json::from_str(&text) {
            Ok(value) => value,
            Err(error) => {
                return source_check(
                    true,
                    false,
                    Some(path_text),
                    None,
                    source,
                    format!("发现 Codex auth.json，但 JSON 无效: {error}"),
                );
            }
        };

        let has_access_token = value
            .get("tokens")
            .and_then(|tokens| tokens.get("access_token"))
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|token| !token.is_empty());

        if has_access_token {
            return source_check(
                true,
                true,
                Some(path_text),
                None,
                source,
                "已发现可用的 Codex ChatGPT 登录文件".to_string(),
            );
        }

        let has_api_key = value
            .get("OPENAI_API_KEY")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|key| !key.is_empty());

        if has_api_key {
            return source_check(
                true,
                false,
                Some(path_text),
                None,
                source,
                "发现 Codex API Key 登录文件，但当前用量查询仅支持 ChatGPT 登录".to_string(),
            );
        }

        return source_check(
            true,
            false,
            Some(path_text),
            None,
            source,
            "发现 Codex auth.json，但没有识别到 tokens.access_token".to_string(),
        );
    }

    source_check(
        false,
        false,
        None,
        None,
        "codex".to_string(),
        "未找到 Codex auth.json；请先运行 codex login 或手动选择文件".to_string(),
    )
}

fn discover_opencode_go_config() -> SourceCheck {
    let mut candidates: Vec<(PathBuf, String)> = Vec::new();

    if let Some(appdata) = env::var_os("APPDATA") {
        candidates.push((
            PathBuf::from(appdata)
                .join("ai-usage-monitor")
                .join("opencode-go.json"),
            "%APPDATA%\\ai-usage-monitor\\opencode-go.json".to_string(),
        ));
    }

    if let Some(user_profile) = env::var_os("USERPROFILE") {
        let home = PathBuf::from(user_profile);
        candidates.push((
            home.join(".config")
                .join("opencode-bar")
                .join("opencode-go.json"),
            "opencode-bar config".to_string(),
        ));
        candidates.push((
            home.join(".config")
                .join("opencode-quota")
                .join("opencode-go.json"),
            "opencode-quota config".to_string(),
        ));
    }

    let mut first_invalid: Option<SourceCheck> = None;

    for (path, source) in candidates {
        if !path.is_file() {
            continue;
        }

        let path_text = path.display().to_string();
        let text = match fs::read_to_string(&path) {
            Ok(value) => value,
            Err(error) => {
                first_invalid.get_or_insert_with(|| {
                    source_check(
                        true,
                        false,
                        Some(path_text),
                        None,
                        source,
                        format!("发现 OpenCode Go 配置，但无法读取: {error}"),
                    )
                });
                continue;
            }
        };

        let value: Value = match serde_json::from_str(&text) {
            Ok(value) => value,
            Err(error) => {
                first_invalid.get_or_insert_with(|| {
                    source_check(
                        true,
                        false,
                        Some(path_text),
                        None,
                        source,
                        format!("发现 OpenCode Go 配置，但 JSON 无效: {error}"),
                    )
                });
                continue;
            }
        };

        let workspace_id = get_nonempty_string(
            &value,
            &["workspaceId", "workspaceID", "workspace_id"],
        );
        let auth_cookie = get_nonempty_string(
            &value,
            &["authCookie", "auth_cookie", "cookie"],
        );

        if workspace_id.is_some() && auth_cookie.is_some() {
            return source_check(
                true,
                true,
                Some(path_text),
                None,
                source,
                "已发现包含 workspaceId 和 authCookie 的 OpenCode Go 配置".to_string(),
            );
        }

        first_invalid.get_or_insert_with(|| {
            source_check(
                true,
                false,
                Some(path_text),
                None,
                source,
                "发现 OpenCode Go 配置，但缺少 workspaceId 或 authCookie".to_string(),
            )
        });
    }

    first_invalid.unwrap_or_else(|| {
        source_check(
            false,
            false,
            None,
            None,
            "opencode_go".to_string(),
            "未自动发现 OpenCode Go 配置；可在设置中手动选择 JSON 文件".to_string(),
        )
    })
}

fn discover_deepseek_env() -> SourceCheck {
    match env::var("DEEPSEEK_API_KEY") {
        Ok(value) if !value.trim().is_empty() => source_check(
            true,
            true,
            None,
            None,
            "DEEPSEEK_API_KEY".to_string(),
            "已发现 DEEPSEEK_API_KEY；密钥不会返回前端或写入缓存".to_string(),
        ),
        _ => source_check(
            false,
            false,
            None,
            None,
            "DEEPSEEK_API_KEY".to_string(),
            "未发现 DEEPSEEK_API_KEY；可继续使用设置中的手动 API Key".to_string(),
        ),
    }
}

fn discover_proxy_env() -> SourceCheck {
    let candidates = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"];

    for name in candidates {
        let Ok(value) = env::var(name) else {
            continue;
        };

        let value = value.trim();
        if value.is_empty() {
            continue;
        }

        let contains_credentials = value
            .split_once("://")
            .map(|(_, rest)| rest.contains('@'))
            .unwrap_or_else(|| value.contains('@'));

        return source_check(
            true,
            true,
            None,
            if contains_credentials {
                None
            } else {
                Some(value.to_string())
            },
            name.to_string(),
            if contains_credentials {
                format!("已发现 {name}；代理包含凭据，因此不会显示或复制到前端")
            } else {
                format!("已发现 {name}: {value}")
            },
        );
    }

    source_check(
        false,
        false,
        None,
        None,
        "proxy".to_string(),
        "未发现 HTTP_PROXY / HTTPS_PROXY 环境变量".to_string(),
    )
}

fn get_nonempty_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_string)
    })
}

fn source_check(
    found: bool,
    usable: bool,
    path: Option<String>,
    value: Option<String>,
    source: String,
    message: String,
) -> SourceCheck {
    SourceCheck {
        found,
        usable,
        path,
        value,
        source,
        message,
    }
}
