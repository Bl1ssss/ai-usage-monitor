# AI Usage Monitor: cache + provider refactor

This archive contains a refactored version of the project with:

- Frontend provider split:
  - `src/providers/deepseek.ts`
  - `src/providers/opencodeGo.ts`
  - `src/providers/cache.ts`
- Frontend component split:
  - `src/components/UsageCard.tsx`
  - `src/components/SettingsPanel.tsx`
- Shared frontend types and format utilities.
- Rust backend split:
  - `src-tauri/src/deepseek.rs`
  - `src-tauri/src/opencode_go.rs`
  - `src-tauri/src/cache.rs`
- Local cache commands:
  - `load_cache`
  - `save_cache`

Cache path on Windows:

```text
%APPDATA%\ai-usage-monitor\cache.json
```

OpenCode Go config path remains:

```text
%APPDATA%\ai-usage-monitor\opencode-go.json
```

Do not commit `opencode-go.json`, `cache.json`, `.env`, or API keys.
