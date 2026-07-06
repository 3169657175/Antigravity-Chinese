# Antigravity 2.0 Patch Uninstaller / Restorer
# Safely restores the official original app.asar

$Host.UI.RawUI.WindowTitle = "Antigravity 2.0 Patch Restorer"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         Antigravity 2.0 Patch Restorer       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$appPath = "$env:LOCALAPPDATA\Programs\antigravity"
$asarPath = "$appPath\resources\app.asar"
$backupPath = "$appPath\resources\app.asar.backup"
$cachedPatchedAsar = "$env:USERPROFILE\.gemini\antigravity\scratch\app.asar"
$startupFile = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AntigravityPatchAutoHealer.vbs"

# 1. Check if backup exists
if (-not (Test-Path $backupPath)) {
    Write-Host "[X] ERROR: Original backup file not found: app.asar.backup" -ForegroundColor Red
    Write-Host "    Path: $backupPath" -ForegroundColor Red
    Write-Host "    Please reinstall Antigravity official client." -ForegroundColor Yellow
    exit 1
}

# 2. Check for running processes and close them
$processes = Get-Process -Name "antigravity" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "[i] Closing running Antigravity processes..." -ForegroundColor Yellow
    Stop-Process -Name "antigravity" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 3. Restore backup
try {
    Write-Host "[+] Restoring official app.asar..." -ForegroundColor Cyan
    Copy-Item -Path $backupPath -Destination $asarPath -Force
    Write-Host "[OK] Restored official app.asar successfully" -ForegroundColor Green
} catch {
    Write-Host "[X] Restore failed: $_" -ForegroundColor Red
    exit 1
}

# 4. Remove Auto-Healer from startup and cache
if (Test-Path $startupFile) {
    Write-Host "[-] Removing auto-healer from startup..." -ForegroundColor Cyan
    Remove-Item -Path $startupFile -Force -ErrorAction SilentlyContinue
}
if (Test-Path $cachedPatchedAsar) {
    Write-Host "[-] Removing cached patched asar..." -ForegroundColor Cyan
    Remove-Item -Path $cachedPatchedAsar -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "      Official restore completed successfully!            " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  You are now running official English Antigravity client." -ForegroundColor Cyan
Write-Host ""
