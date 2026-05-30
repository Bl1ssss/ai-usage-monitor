use chrono::{DateTime, Duration, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{env, fs, path::PathBuf};

#[derive(Debug, Deserialize)]
struct OpenCodeGoConfig {
    #[serde(alias = "workspaceId", alias = "workspaceID", alias = "workspace_id")]
    workspace_id: String,

    #[serde(alias = "authCookie", alias = "auth_cookie", alias = "cookie")]
    auth_cookie: String,

    #[serde(default, alias = "apiKey", alias = "api_key", alias = "key")]
    api_key: Option<String>,

    #[serde(default, alias = "authFile", alias = "auth_file")]
    auth_file: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeGoUsageWindow {
    usage_percent: f64,
    remaining_percent: f64,
    reset_in_seconds: i64,
    reset_in: String,
    reset_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeGoMetric {
    provider: String,
    status: String,
    five_hour_usage: Option<f64>,
    five_hour_reset_in: Option<String>,
    five_hour_reset_at: Option<String>,
    weekly_usage: Option<f64>,
    weekly_reset_in: Option<String>,
    weekly_reset_at: Option<String>,
    monthly_usage: Option<f64>,
    monthly_reset_in: Option<String>,
    monthly_reset_at: Option<String>,
    rolling: Option<OpenCodeGoUsageWindow>,
    weekly: Option<OpenCodeGoUsageWindow>,
    monthly: Option<OpenCodeGoUsageWindow>,
    model_count: Option<usize>,
    config_source: String,
    updated_at: String,
}

#[tauri::command]
pub async fn opencode_go_usage(config_path: Option<String>) -> Result<OpenCodeGoMetric, String> {
    let config_file = find_config_path(config_path)?;
    let config = read_config(&config_file)?;

    let client = reqwest::Client::new();

    let api_key = config
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .or_else(|| read_opencode_go_key(config.auth_file.as_deref()).ok());

    let model_count = match api_key.as_deref() {
        Some(api_key) => fetch_model_count(&client, api_key).await.ok(),
        None => None,
    };

    let html = fetch_dashboard_html(&client, &config.workspace_id, &config.auth_cookie).await?;
    let usage = parse_dashboard_usage(&html)?;

    Ok(OpenCodeGoMetric {
        provider: "opencode_go".to_string(),
        status: "ok".to_string(),

        five_hour_usage: usage.rolling.as_ref().map(|w| w.usage_percent),
        five_hour_reset_in: usage.rolling.as_ref().map(|w| w.reset_in.clone()),
        five_hour_reset_at: usage.rolling.as_ref().map(|w| w.reset_at.clone()),

        weekly_usage: usage.weekly.as_ref().map(|w| w.usage_percent),
        weekly_reset_in: usage.weekly.as_ref().map(|w| w.reset_in.clone()),
        weekly_reset_at: usage.weekly.as_ref().map(|w| w.reset_at.clone()),

        monthly_usage: usage.monthly.as_ref().map(|w| w.usage_percent),
        monthly_reset_in: usage.monthly.as_ref().map(|w| w.reset_in.clone()),
        monthly_reset_at: usage.monthly.as_ref().map(|w| w.reset_at.clone()),

        rolling: usage.rolling,
        weekly: usage.weekly,
        monthly: usage.monthly,

        model_count,
        config_source: config_file.display().to_string(),
        updated_at: Utc::now().to_rfc3339(),
    })
}

struct DashboardUsage {
    rolling: Option<OpenCodeGoUsageWindow>,
    weekly: Option<OpenCodeGoUsageWindow>,
    monthly: Option<OpenCodeGoUsageWindow>,
}

fn find_config_path(custom_path: Option<String>) -> Result<PathBuf, String> {
    if let Some(path) = custom_path {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.is_file() {
                return Ok(path);
            }
            return Err(format!("OpenCode Go 配置文件不存在: {}", path.display()));
        }
    }

    for path in config_candidates() {
        if path.is_file() {
            return Ok(path);
        }
    }

    Err("未找到 OpenCode Go 配置文件。请创建 %APPDATA%\\ai-usage-monitor\\opencode-go.json".to_string())
}

fn config_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(appdata) = env::var_os("APPDATA") {
        paths.push(
            PathBuf::from(appdata)
                .join("ai-usage-monitor")
                .join("opencode-go.json"),
        );
    }

    if let Some(home) = env::var_os("USERPROFILE") {
        let home = PathBuf::from(home);

        paths.push(
            home.join(".config")
                .join("opencode-bar")
                .join("opencode-go.json"),
        );

        paths.push(
            home.join(".config")
                .join("opencode-quota")
                .join("opencode-go.json"),
        );
    }

    paths
}

fn read_config(path: &PathBuf) -> Result<OpenCodeGoConfig, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("读取 OpenCode Go 配置失败: {e}"))?;

    serde_json::from_str::<OpenCodeGoConfig>(&text)
        .map_err(|e| format!("解析 OpenCode Go 配置失败: {e}"))
}

fn read_opencode_go_key(custom_auth_file: Option<&str>) -> Result<String, String> {
    let auth_file = if let Some(path) = custom_auth_file.map(str::trim).filter(|v| !v.is_empty()) {
        PathBuf::from(path)
    } else {
        find_opencode_auth_file()?
    };

    let text = fs::read_to_string(&auth_file).map_err(|e| format!("读取 OpenCode auth.json 失败: {e}"))?;

    let value: Value =
        serde_json::from_str(&text).map_err(|e| format!("解析 OpenCode auth.json 失败: {e}"))?;

    value
        .get("opencode-go")
        .and_then(|item| item.get("key"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("未在 {} 中找到 opencode-go.key", auth_file.display()))
}

fn find_opencode_auth_file() -> Result<PathBuf, String> {
    let mut paths = Vec::new();

    if let Some(home) = env::var_os("USERPROFILE") {
        let home = PathBuf::from(home);
        paths.push(home.join(".local").join("share").join("opencode").join("auth.json"));
        paths.push(home.join("AppData").join("Roaming").join("opencode").join("auth.json"));
        paths.push(home.join("AppData").join("Local").join("opencode").join("auth.json"));
    }

    if let Some(appdata) = env::var_os("APPDATA") {
        paths.push(PathBuf::from(appdata).join("opencode").join("auth.json"));
    }

    if let Some(localappdata) = env::var_os("LOCALAPPDATA") {
        paths.push(PathBuf::from(localappdata).join("opencode").join("auth.json"));
    }

    paths
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "未找到 OpenCode auth.json，请在 opencode-go.json 中设置 authFile".to_string())
}

async fn fetch_model_count(client: &reqwest::Client, api_key: &str) -> Result<usize, String> {
    let response = client
        .get("https://opencode.ai/zen/go/v1/models")
        .bearer_auth(api_key)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|e| format!("请求 OpenCode Go models 失败: {e}"))?;

    let status = response.status();

    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("OpenCode Go models 返回 HTTP {status}: {text}"));
    }

    let value = response
        .json::<Value>()
        .await
        .map_err(|e| format!("解析 OpenCode Go models 失败: {e}"))?;

    if let Some(array) = value.get("data").and_then(Value::as_array) {
        return Ok(array.len());
    }

    if let Some(array) = value.get("models").and_then(Value::as_array) {
        return Ok(array.len());
    }

    if let Some(array) = value.as_array() {
        return Ok(array.len());
    }

    Err("OpenCode Go models 返回结构不符合预期".to_string())
}

async fn fetch_dashboard_html(
    client: &reqwest::Client,
    workspace_id: &str,
    auth_cookie: &str,
) -> Result<String, String> {
    let url = format!("https://opencode.ai/workspace/{workspace_id}/go");

    let response = client
        .get(url)
        .header(reqwest::header::ACCEPT, "text/html,application/xhtml+xml")
        .header(reqwest::header::COOKIE, cookie_header(auth_cookie))
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
        )
        .send()
        .await
        .map_err(|e| format!("请求 OpenCode Go dashboard 失败: {e}"))?;

    let status = response.status();

    if !status.is_success() {
    let text = response.text().await.unwrap_or_default();
    let summary = summarize_dashboard_error(&text);

    return Err(format!(
        "OpenCode Go dashboard 返回 HTTP {status}: {summary}"
    ));
}

    response
        .text()
        .await
        .map_err(|e| format!("读取 OpenCode Go dashboard HTML 失败: {e}"))
}

fn cookie_header(raw: &str) -> String {
    let value = raw.trim();

    if value.contains("auth=") {
        value.to_string()
    } else {
        format!("auth={value}")
    }
}

fn parse_dashboard_usage(html: &str) -> Result<DashboardUsage, String> {
    let now = Utc::now();
    let text = normalize_dashboard_html(html);

    let rolling = parse_window("rollingUsage", &text, &now);
    let weekly = parse_window("weeklyUsage", &text, &now);
    let monthly = parse_window("monthlyUsage", &text, &now);

    if rolling.is_none() && weekly.is_none() && monthly.is_none() {
        return Err("未在 OpenCode Go dashboard HTML 中找到 rollingUsage / weeklyUsage / monthlyUsage".to_string());
    }

    Ok(DashboardUsage {
        rolling,
        weekly,
        monthly,
    })
}

fn parse_window(field_name: &str, text: &str, now: &DateTime<Utc>) -> Option<OpenCodeGoUsageWindow> {
    let object_pattern = format!(
        r#"["']?{}["']?\s*:\s*(?:\$R\[\d+\]\s*=\s*)?\{{(?P<body>[^{{}}]*)\}}"#,
        regex::escape(field_name)
    );

    let object_re = Regex::new(&object_pattern).ok()?;
    let caps = object_re.captures(text)?;
    let body = caps.name("body")?.as_str();

    let usage_percent = capture_number("usagePercent", body)?;
    let reset_in_seconds = capture_number("resetInSec", body)?.round() as i64;
    let reset_in_seconds = reset_in_seconds.max(0);

    let reset_at = now.to_owned() + Duration::seconds(reset_in_seconds);

    Some(OpenCodeGoUsageWindow {
        usage_percent,
        remaining_percent: (100.0 - usage_percent).max(0.0),
        reset_in_seconds,
        reset_in: format_duration(reset_in_seconds),
        reset_at: reset_at.to_rfc3339(),
    })
}

fn capture_number(field_name: &str, text: &str) -> Option<f64> {
    let pattern = format!(
        r#"["']?{}["']?\s*:\s*"?(-?\d+(?:\.\d+)?)"?"#,
        regex::escape(field_name)
    );

    let re = Regex::new(&pattern).ok()?;
    let caps = re.captures(text)?;
    caps.get(1)?.as_str().parse::<f64>().ok()
}

fn normalize_dashboard_html(html: &str) -> String {
    let replacements = [
        ("&quot;", "\""),
        ("&#34;", "\""),
        ("&#x27;", "'"),
        ("&#39;", "'"),
        ("&amp;", "&"),
        ("\\\"", "\""),
        ("\\u0022", "\""),
    ];

    let mut text = html.to_string();

    for (encoded, decoded) in replacements {
        text = text.replace(encoded, decoded);
    }

    text
}

fn format_duration(seconds: i64) -> String {
    let seconds = seconds.max(0);
    let days = seconds / 86_400;
    let hours = (seconds % 86_400) / 3_600;
    let minutes = (seconds % 3_600) / 60;

    if days > 0 {
        format!("{days}d {hours}h")
    } else if hours > 0 {
        format!("{hours}h {minutes}m")
    } else {
        format!("{minutes}m")
    }
}

fn summarize_dashboard_error(html: &str) -> String {
    let normalized = normalize_dashboard_html(html);
    let plain = strip_html_tags(&normalized);
    let compact = plain.split_whitespace().collect::<Vec<_>>().join(" ");

    if compact.contains("ResourceExhausted")
        || compact.contains("connection limit exceeded")
        || compact.contains("transaction pool")
    {
        return "OpenCode 服务端数据库连接池已满，稍后重试；本地配置通常没问题".to_string();
    }

    if compact.contains("Unauthorized") || compact.contains("401") {
        return "认证失败，请重新复制 opencode.ai 的 auth cookie".to_string();
    }

    if compact.contains("Forbidden") || compact.contains("403") {
        return "无权限访问该 workspace，请检查 workspaceId 和 authCookie 是否匹配".to_string();
    }

    if compact.trim().is_empty() {
        return "返回了空错误页".to_string();
    }

    truncate_chars(&compact, 220)
}

fn strip_html_tags(text: &str) -> String {
    Regex::new(r"<[^>]+>")
        .map(|re| re.replace_all(text, " ").to_string())
        .unwrap_or_else(|_| text.to_string())
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    let mut result = text.chars().take(max_chars).collect::<String>();

    if text.chars().count() > max_chars {
        result.push_str("...");
    }

    result
}
