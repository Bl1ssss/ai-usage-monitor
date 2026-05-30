use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{env, fs, path::PathBuf, time::Duration};

#[derive(Debug, Deserialize)]
struct CodexAuthFile {
    tokens: Option<CodexTokenData>,

    #[serde(rename = "OPENAI_API_KEY")]
    openai_api_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CodexTokenData {
    access_token: String,

    #[serde(default)]
    account_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexMetric {
    provider: String,
    status: String,

    plan_type: Option<String>,

    primary_usage: Option<f64>,
    primary_window_minutes: Option<i64>,
    primary_reset_at: Option<String>,
    primary_reset_in: Option<String>,

    secondary_usage: Option<f64>,
    secondary_window_minutes: Option<i64>,
    secondary_reset_at: Option<String>,
    secondary_reset_in: Option<String>,

    credits_balance: Option<String>,
    unlimited_credits: Option<bool>,
    rate_limit_reached_type: Option<String>,

    auth_source: String,
    base_url: String,
    updated_at: String,
}

#[derive(Debug)]
struct CodexWindow {
    usage_percent: Option<f64>,
    window_minutes: Option<i64>,
    reset_at: Option<String>,
    reset_in: Option<String>,
}

#[tauri::command]
pub async fn codex_usage(
    auth_path: Option<String>,
    base_url: Option<String>,
    proxy_url: Option<String>,
) -> Result<CodexMetric, String> {
    let auth_file = find_codex_auth_file(auth_path)?;
    let auth = read_codex_auth(&auth_file)?;

    let tokens = auth.tokens.ok_or_else(|| {
        if auth.openai_api_key.is_some() {
            "当前 Codex auth.json 是 OPENAI_API_KEY 模式；第一版只支持 ChatGPT 登录产生的 tokens.access_token".to_string()
        } else {
            "Codex auth.json 中没有 tokens.access_token，请先运行 codex login".to_string()
        }
    })?;

    if tokens.access_token.trim().is_empty() {
        return Err("Codex tokens.access_token 为空，请重新运行 codex login".to_string());
    }

    let base_url = normalize_base_url(base_url);
    let usage_url = build_usage_url(&base_url);

    let client = build_codex_client(proxy_url)?;

    let mut request = client
        .get(&usage_url)
        .bearer_auth(tokens.access_token.trim())
        .header(reqwest::header::ACCEPT, "application/json")
        .header(reqwest::header::USER_AGENT, "codex-cli");

    if let Some(account_id) = tokens.account_id.as_deref().map(str::trim).filter(|v| !v.is_empty())
    {
        request = request.header("ChatGPT-Account-ID", account_id);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("请求 Codex usage 失败: {e}"))?;

    let status = response.status();

    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!(
            "Codex usage 返回 HTTP {status}: {}",
            summarize_error_body(&text)
        ));
    }

    let value = response
        .json::<Value>()
        .await
        .map_err(|e| format!("解析 Codex usage JSON 失败: {e}"))?;

    parse_codex_metric(value, auth_file, base_url)
}

fn find_codex_auth_file(custom_path: Option<String>) -> Result<PathBuf, String> {
    if let Some(path) = custom_path {
        let trimmed = path.trim();

        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);

            if path.is_file() {
                return Ok(path);
            }

            return Err(format!("Codex auth.json 不存在: {}", path.display()));
        }
    }

    let mut candidates = Vec::new();

    if let Some(codex_home) = env::var_os("CODEX_HOME") {
        candidates.push(PathBuf::from(codex_home).join("auth.json"));
    }

    if let Some(user_profile) = env::var_os("USERPROFILE") {
        candidates.push(PathBuf::from(user_profile).join(".codex").join("auth.json"));
    }

    if let Some(home) = env::var_os("HOME") {
        candidates.push(PathBuf::from(home).join(".codex").join("auth.json"));
    }

    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| {
            "未找到 Codex auth.json。请先运行 codex login，或在设置里填写 auth.json 路径"
                .to_string()
        })
}

fn read_codex_auth(path: &PathBuf) -> Result<CodexAuthFile, String> {
    let text = fs::read_to_string(path)
        .map_err(|e| format!("读取 Codex auth.json 失败: {e}"))?;

    serde_json::from_str::<CodexAuthFile>(&text)
        .map_err(|e| format!("解析 Codex auth.json 失败: {e}"))
}

fn normalize_base_url(base_url: Option<String>) -> String {
    base_url
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("https://chatgpt.com")
        .trim_end_matches('/')
        .to_string()
}

fn build_usage_url(base_url: &str) -> String {
    if base_url.ends_with("/backend-api") {
        return format!("{base_url}/wham/usage");
    }

    if base_url.contains("chatgpt.com") || base_url.contains("chat.openai.com") {
        return format!("{base_url}/backend-api/wham/usage");
    }

    format!("{base_url}/api/codex/usage")
}

fn parse_codex_metric(
    value: Value,
    auth_file: PathBuf,
    base_url: String,
) -> Result<CodexMetric, String> {
    let rate_limit = value.get("rate_limit").unwrap_or(&value);

    let primary = parse_window(
        rate_limit
            .get("primary_window")
            .or_else(|| rate_limit.get("primary"))
            .or_else(|| value.get("primary")),
    );

    let secondary = parse_window(
        rate_limit
            .get("secondary_window")
            .or_else(|| rate_limit.get("secondary"))
            .or_else(|| value.get("secondary")),
    );

    if primary.usage_percent.is_none() && secondary.usage_percent.is_none() {
        return Err(format!(
            "Codex usage 返回中没有可解析的 primary_window / secondary_window 用量字段: {}",
            truncate_chars(&value.to_string(), 360)
        ));
    }

    let plan_type = get_string(
        &value,
        &[
            "plan_type",
            "planType",
            "plan",
            "subscriptionPlan",
            "subscription_plan",
        ],
    );

    let rate_limit_reached_type = get_string(
        &value,
        &[
            "rate_limit_reached_type",
            "rateLimitReachedType",
            "reachedType",
            "reached_type",
        ],
    );

    let credits = value.get("credits");

    let credits_balance = credits.and_then(|item| {
        get_string(item, &["balance", "creditsBalance", "credits_balance"])
            .or_else(|| get_f64(item, &["balance"]).map(|v| v.to_string()))
    });

    let unlimited_credits = credits.and_then(|item| {
        get_bool(item, &["unlimited", "isUnlimited", "is_unlimited"])
    });

    let limit_reached = get_bool(rate_limit, &["limit_reached", "limitReached"]).unwrap_or(false);

    let status = if limit_reached
        || rate_limit_reached_type
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .is_some()
    {
        "warning"
    } else {
        "ok"
    };

    Ok(CodexMetric {
        provider: "codex".to_string(),
        status: status.to_string(),

        plan_type,

        primary_usage: primary.usage_percent,
        primary_window_minutes: primary.window_minutes,
        primary_reset_at: primary.reset_at,
        primary_reset_in: primary.reset_in,

        secondary_usage: secondary.usage_percent,
        secondary_window_minutes: secondary.window_minutes,
        secondary_reset_at: secondary.reset_at,
        secondary_reset_in: secondary.reset_in,

        credits_balance,
        unlimited_credits,
        rate_limit_reached_type,

        auth_source: auth_file.display().to_string(),
        base_url,
        updated_at: Utc::now().to_rfc3339(),
    })
}

fn find_snapshot(value: &Value) -> &Value {
    for key in [
        "rateLimitSnapshot",
        "rate_limit_snapshot",
        "usage",
        "rateLimits",
        "rate_limits",
        "snapshot",
    ] {
        if let Some(item) = value.get(key) {
            if item.is_object() {
                return item;
            }
        }
    }

    if let Some(data) = value.get("data") {
        if data.is_object() {
            return find_snapshot(data);
        }

        if let Some(array) = data.as_array() {
            if let Some(first) = array.first() {
                return find_snapshot(first);
            }
        }
    }

    if let Some(array) = value.as_array() {
        if let Some(first) = array.first() {
            return find_snapshot(first);
        }
    }

    value
}

fn parse_window(value: Option<&Value>) -> CodexWindow {
    let Some(value) = value else {
        return CodexWindow {
            usage_percent: None,
            window_minutes: None,
            reset_at: None,
            reset_in: None,
        };
    };

    let usage_percent = get_f64(
        value,
        &[
            "used_percent",
            "usedPercent",
            "usagePercent",
            "usage_percent",
            "percent",
            "used",
        ],
    );

    let window_minutes = get_i64(
        value,
        &[
            "windowDurationMins",
            "window_duration_mins",
            "windowMinutes",
            "window_minutes",
            "durationMinutes",
            "duration_minutes",
        ],
    )
    .or_else(|| {
        get_i64(
            value,
            &[
                "limit_window_seconds",
                "limitWindowSeconds",
                "window_seconds",
                "windowSeconds",
            ],
        )
        .map(|seconds| seconds / 60)
    });

    let reset_at = parse_reset_at(value);

    let reset_in = get_i64(
        value,
        &[
            "reset_after_seconds",
            "resetAfterSeconds",
            "reset_in_seconds",
            "resetInSeconds",
        ],
    )
    .map(format_duration)
    .or_else(|| reset_at.as_deref().and_then(format_reset_in));

    CodexWindow {
        usage_percent,
        window_minutes,
        reset_at,
        reset_in,
    }
}

fn parse_reset_at(value: &Value) -> Option<String> {
    if let Some(epoch_seconds) = get_i64(
        value,
        &[
            "reset_at",
            "resetAt",
            "resets_at",
            "resetsAt",
            "reset_time",
            "resetTime",
        ],
    ) {
        return DateTime::<Utc>::from_timestamp(epoch_seconds, 0)
            .map(|time| time.to_rfc3339());
    }

    let raw = get_string(
        value,
        &[
            "reset_at",
            "resetAt",
            "resets_at",
            "resetsAt",
            "reset_time",
            "resetTime",
        ],
    )?;

    if let Ok(epoch_seconds) = raw.parse::<i64>() {
        return DateTime::<Utc>::from_timestamp(epoch_seconds, 0)
            .map(|time| time.to_rfc3339());
    }

    Some(raw)
}

fn get_string(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(item) = value.get(*key) {
            if let Some(text) = item.as_str() {
                return Some(text.to_string());
            }

            if item.is_number() || item.is_boolean() {
                return Some(item.to_string());
            }
        }
    }

    None
}

fn get_f64(value: &Value, keys: &[&str]) -> Option<f64> {
    for key in keys {
        if let Some(item) = value.get(*key) {
            if let Some(number) = item.as_f64() {
                return Some(number);
            }

            if let Some(text) = item.as_str() {
                if let Ok(number) = text.parse::<f64>() {
                    return Some(number);
                }
            }
        }
    }

    None
}

fn get_i64(value: &Value, keys: &[&str]) -> Option<i64> {
    for key in keys {
        if let Some(item) = value.get(*key) {
            if let Some(number) = item.as_i64() {
                return Some(number);
            }

            if let Some(number) = item.as_f64() {
                return Some(number.round() as i64);
            }

            if let Some(text) = item.as_str() {
                if let Ok(number) = text.parse::<i64>() {
                    return Some(number);
                }
            }
        }
    }

    None
}

fn get_bool(value: &Value, keys: &[&str]) -> Option<bool> {
    for key in keys {
        if let Some(item) = value.get(*key) {
            if let Some(value) = item.as_bool() {
                return Some(value);
            }

            if let Some(text) = item.as_str() {
                match text.to_ascii_lowercase().as_str() {
                    "true" | "1" | "yes" => return Some(true),
                    "false" | "0" | "no" => return Some(false),
                    _ => {}
                }
            }
        }
    }

    None
}

fn format_reset_in(reset_at: &str) -> Option<String> {
    let reset_at = DateTime::parse_from_rfc3339(reset_at).ok()?;
    let now = Utc::now();

    let seconds = reset_at
        .with_timezone(&Utc)
        .signed_duration_since(now)
        .num_seconds()
        .max(0);

    Some(format_duration(seconds))
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

fn summarize_error_body(text: &str) -> String {
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");

    if compact.contains("Unauthorized") || compact.contains("401") {
        return "认证失败，请重新运行 codex login".to_string();
    }

    if compact.contains("Forbidden") || compact.contains("403") {
        return "无权限访问 Codex usage，请检查账号或 ChatGPT-Account-ID".to_string();
    }

    if compact.contains("Too Many Requests") || compact.contains("429") {
        return "请求过于频繁，请稍后重试".to_string();
    }

    truncate_chars(&compact, 220)
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    let count = text.chars().count();

    if count <= max_chars {
        return text.to_string();
    }

    let mut result = text.chars().take(max_chars).collect::<String>();
    result.push_str("...");
    result
}

fn build_codex_client(proxy_url: Option<String>) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(30));

    if let Some(proxy) = normalize_proxy_url(proxy_url).or_else(read_env_proxy_url) {
        let proxy = reqwest::Proxy::all(&proxy)
            .map_err(|e| format!("Codex proxy 配置错误: {e}"))?;

        builder = builder.proxy(proxy);
    }

    builder
        .build()
        .map_err(|e| format!("创建 Codex HTTP client 失败: {e}"))
}

fn normalize_proxy_url(proxy_url: Option<String>) -> Option<String> {
    proxy_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn read_env_proxy_url() -> Option<String> {
    env::var("HTTPS_PROXY")
        .ok()
        .or_else(|| env::var("https_proxy").ok())
        .or_else(|| env::var("HTTP_PROXY").ok())
        .or_else(|| env::var("http_proxy").ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}