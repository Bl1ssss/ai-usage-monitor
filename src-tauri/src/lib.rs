mod opencode_go;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct DeepSeekBalanceResponse {
    is_available: bool,
    balance_infos: Vec<DeepSeekBalanceInfo>,
}

#[derive(Debug, Deserialize)]
struct DeepSeekBalanceInfo {
    currency: String,
    total_balance: String,
    granted_balance: String,
    topped_up_balance: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeepSeekMetric {
    provider: String,
    status: String,
    currency: String,
    total_balance: f64,
    granted_balance: f64,
    topped_up_balance: f64,
    updated_at: String,
}

fn parse_balance(value: &str) -> f64 {
    value.parse::<f64>().unwrap_or(0.0)
}

#[tauri::command]
async fn deepseek_balance(api_key: String) -> Result<DeepSeekMetric, String> {
    if api_key.trim().is_empty() {
        return Err("未设置 DeepSeek API Key".to_string());
    }

    let client = reqwest::Client::new();

    let response = client
        .get("https://api.deepseek.com/user/balance")
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| format!("请求 DeepSeek 失败: {e}"))?;

    let status_code = response.status();

    if !status_code.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("DeepSeek 返回 HTTP {status_code}: {text}"));
    }

    let data = response
        .json::<DeepSeekBalanceResponse>()
        .await
        .map_err(|e| format!("解析 DeepSeek 返回失败: {e}"))?;

    let info = data
        .balance_infos
        .iter()
        .find(|item| item.currency == "CNY")
        .or_else(|| data.balance_infos.first())
        .ok_or_else(|| "DeepSeek 未返回余额信息".to_string())?;

    Ok(DeepSeekMetric {
        provider: "deepseek".to_string(),
        status: if data.is_available {
            "ok".to_string()
        } else {
            "warning".to_string()
        },
        currency: info.currency.clone(),
        total_balance: parse_balance(&info.total_balance),
        granted_balance: parse_balance(&info.granted_balance),
        topped_up_balance: parse_balance(&info.topped_up_balance),
        updated_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![deepseek_balance,opencode_go::opencode_go_usage])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}