# Antigravity 2.0 Patch Uninstaller / Restorer
# Safely restores the official original app.asar

$Host.UI.RawUI.WindowTitle = "Antigravity 2.0 还原备份工具"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         Antigravity 2.0 汉化与优化补丁 还原卸载工具       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$appPath = "$env:LOCALAPPDATA\Programs\antigravity"
$asarPath = "$appPath\resources\app.asar"
$backupPath = "$appPath\resources\app.asar.backup"
$cachedPatchedAsar = "C:\Users\niu\.gemini\antigravity\scratch\app.asar"
$startupFile = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AntigravityPatchAutoHealer.vbs"

# 1. Check if backup exists
if (-not (Test-Path $backupPath)) {
    Write-Host "[X] 错误: 未找到原版备份文件 app.asar.backup" -ForegroundColor Red
    Write-Host "    备份路径: $backupPath" -ForegroundColor Red
    Write-Host "    无法为您自动恢复。如果您想重置，请重新安装官方客户端。" -ForegroundColor Yellow
    exit 1
}

# 2. Check for running processes and close them
$processes = Get-Process -Name "antigravity" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "[i] 检测到 Antigravity 正在运行，正在关闭进程以释放文件锁..." -ForegroundColor Yellow
    Stop-Process -Name "antigravity" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 3. Restore backup
try {
    Write-Host "[+] 正在恢复官方原版 app.asar..." -ForegroundColor Cyan
    Copy-Item -Path $backupPath -Destination $asarPath -Force
    Write-Host "[OK] 原版核心包已成功还原。" -ForegroundColor Green
} catch {
    Write-Host "[X] 还原失败，原因: $_" -ForegroundColor Red
    exit 1
}

# 4. Remove Auto-Healer from startup and cache
if (Test-Path $startupFile) {
    Write-Host "[-] 正在从开机启动文件夹中移除自愈服务..." -ForegroundColor Cyan
    Remove-Item -Path $startupFile -Force -ErrorAction SilentlyContinue
}
if (Test-Path $cachedPatchedAsar) {
    Write-Host "[-] 正在清除本地缓存的补丁包..." -ForegroundColor Cyan
    Remove-Item -Path $cachedPatchedAsar -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "      恭喜您！官方原版客户端已成功还原！                  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  您可以重新启动您的官方英文版 Antigravity 客户端。" -ForegroundColor Cyan
Write-Host ""
