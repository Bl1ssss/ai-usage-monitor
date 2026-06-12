# AI Usage Monitor v0.3 Tray + Vertical UI patch

This patch is based on the current `Bl1ssss/ai-usage-monitor` main branch and preserves:

- DeepSeek balance query
- Codex usage query and proxy configuration
- OpenCode Go usage query
- ProviderSnapshot architecture
- local cache
- local source discovery
- settings auto-detect / choose file / test buttons

## Added

### Windows tray behavior

- Starts hidden in the Windows system tray
- Left-click tray icon toggles show/hide
- Right-click menu: Show, Hide, Refresh, Quit
- Clicking the native close button hides the window instead of exiting
- Window moves to the bottom-right before showing
- Window stays always-on-top and does not occupy the taskbar

### Vertical dashboard

- Replaces the 2 x 2 grid with a single vertical provider list
- Codex displays primary and secondary windows as separate progress bars
- OpenCode Go displays 5H, WEEK and MONTH as separate progress bars
- DeepSeek retains a balance-focused card
- Cursor no longer shows misleading mock percentages; it is clearly marked as not connected

### UI update

- G-Helper-inspired light panel layout
- Rounded cards, status chips and provider accent colors
- Scrollable narrow window designed for the lower-right corner
- Full-window settings overlay adapted for the narrow layout

## Files replaced

- `src/App.tsx`
- `src/App.css`
- `src/types/metrics.ts`
- `src/providers/snapshots.ts`
- `src/components/UsageCard.tsx`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`

## Files added

- `src/components/ProviderCard.tsx`
- `src/components/UsageProgress.tsx`
- `src-tauri/src/tray.rs`

## Apply automatically

From the extracted patch directory:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\APPLY_PATCH.ps1 -ProjectPath "F:\Postgraduate\Yue\ai-usage-monitor"
```

Then:

```powershell
cd F:\Postgraduate\Yue\ai-usage-monitor
npm run tauri dev
```

The first Rust build downloads and compiles `tauri-plugin-positioner` and the Tauri tray feature.

## Apply manually

Copy the patch's `src` and `src-tauri` directories over the project directories, preserving the folder structure.

## Important behavior

`src-tauri/tauri.conf.json` contains:

```json
"visible": false,
"skipTaskbar": true
```

Therefore the development window does not open automatically. Look for the application icon in the Windows system tray and left-click it.

For temporary UI debugging, change `visible` to `true`.
