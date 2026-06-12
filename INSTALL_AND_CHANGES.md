# Local discovery + setup actions patch

This patch is based on the current `main` branch of `Bl1ssss/ai-usage-monitor` and implements the first three configuration steps:

1. Rust local discovery for Codex auth, OpenCode Go config, DeepSeek environment key, and proxy environment variables.
2. Startup auto-application of discovered non-secret paths and proxy values when the current setting is blank.
3. Settings UI actions for Auto Detect, Choose File, and provider connection tests.

## Files added

- `src-tauri/src/discovery.rs`
- `src/providers/discovery.ts`

## Files replaced

- `src/App.tsx`
- `src/App.css`
- `src/components/SettingsPanel.tsx`
- `src/providers/deepseek.ts`
- `src/types/settings.ts`
- `src-tauri/src/deepseek.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/Cargo.toml`
- `src-tauri/capabilities/default.json`
- `package.json`

## Install

Copy the files over the repository while preserving their paths, then run:

```powershell
npm install
npm run tauri dev
```

`npm install` is required because this patch adds `@tauri-apps/plugin-dialog`. Cargo will also download `tauri-plugin-dialog` during the next Tauri build.

## Discovery behavior

- Codex: checks `CODEX_HOME/auth.json`, `%USERPROFILE%\.codex\auth.json`, and `$HOME/.codex/auth.json`.
- OpenCode Go: checks the existing ai-usage-monitor, opencode-bar, and opencode-quota config paths.
- DeepSeek: checks `DEEPSEEK_API_KEY` without returning the key to the frontend.
- Proxy: checks `HTTPS_PROXY`, `https_proxy`, `HTTP_PROXY`, and `http_proxy`.

If a proxy URL contains embedded credentials, discovery reports that it exists but does not copy the value to the frontend.

## Security boundary

This patch does not yet migrate secrets out of localStorage. That is the planned fourth step. It does ensure that environment secrets are never returned by the discovery command and are not added to `cache.json`.
