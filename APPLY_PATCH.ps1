param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath
)

$ErrorActionPreference = "Stop"
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectPath = (Resolve-Path $ProjectPath).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupPath = Join-Path $ProjectPath "_backup_tray_vertical_$Timestamp"

Write-Host "Project: $ProjectPath"
Write-Host "Backup:  $BackupPath"

New-Item -ItemType Directory -Force $BackupPath | Out-Null

$Files = @(
    "src\App.tsx",
    "src\App.css",
    "src\types\metrics.ts",
    "src\providers\snapshots.ts",
    "src\components\UsageCard.tsx",
    "src-tauri\Cargo.toml",
    "src-tauri\tauri.conf.json",
    "src-tauri\src\lib.rs"
)

foreach ($RelativePath in $Files) {
    $Source = Join-Path $ProjectPath $RelativePath
    if (Test-Path $Source) {
        $BackupFile = Join-Path $BackupPath $RelativePath
        New-Item -ItemType Directory -Force (Split-Path -Parent $BackupFile) | Out-Null
        Copy-Item $Source $BackupFile -Force
    }
}

Copy-Item (Join-Path $PatchRoot "src\*") (Join-Path $ProjectPath "src") -Recurse -Force
Copy-Item (Join-Path $PatchRoot "src-tauri\*") (Join-Path $ProjectPath "src-tauri") -Recurse -Force

Write-Host "Patch applied."
Write-Host "Run: cd `"$ProjectPath`"; npm run tauri dev"
Write-Host "The window starts hidden. Click the system tray icon to show it."
