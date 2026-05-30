mod cache;
mod codex;
mod deepseek;
mod opencode_go;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            deepseek::deepseek_balance,
            opencode_go::opencode_go_usage,
            codex::codex_usage,
            cache::load_cache,
            cache::save_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
