# Rollback

`APPLY_PATCH.ps1` creates a timestamped directory in the project root:

```text
_backup_tray_vertical_YYYYMMDD-HHMMSS
```

Copy its contents back over the project to restore replaced files.

The following newly added files can be deleted manually during rollback:

```text
src/components/ProviderCard.tsx
src/components/UsageProgress.tsx
src-tauri/src/tray.rs
```
