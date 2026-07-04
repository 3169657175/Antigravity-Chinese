# Antigravity 2.0 Chinese Localization & UX Optimization Patch Installer
# Cross-version safe local asar patching mechanism

$Host.UI.RawUI.WindowTitle = "Antigravity 2.0 汉化与优化工具"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Antigravity 2.0 智能汉化与免 TUN 代理网络优化补丁    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Locate Antigravity directory
$appPath = "$env:LOCALAPPDATA\Programs\antigravity"
$asarPath = "$appPath\resources\app.asar"
$backupPath = "$appPath\resources\app.asar.backup"

if (-not (Test-Path $asarPath)) {
    Write-Host "[X] 错误: 未能在默认路径找到 Antigravity 客户端:" -ForegroundColor Red
    Write-Host "    $asarPath" -ForegroundColor Red
    Write-Host "    请确保您已正确安装 Antigravity 桌面客户端。" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] 找到客户端核心文件: $asarPath" -ForegroundColor Green

# 2. Check for running processes and close them
$processes = Get-Process -Name "antigravity" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "[i] 检测到 Antigravity 正在运行，正在尝试安全关闭进程..." -ForegroundColor Yellow
    Stop-Process -Name "antigravity" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 3. Create backup if it doesn't exist
if (-not (Test-Path $backupPath)) {
    Write-Host "[+] 首次安装，正在备份官方原版 app.asar 至 app.asar.backup..." -ForegroundColor Green
    Copy-Item -Path $asarPath -Destination $backupPath -Force
} else {
    Write-Host "[*] 备份已存在，将直接进行覆盖升级。" -ForegroundColor Yellow
}

# 4. Check for node/npx
$npxCheck = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npxCheck) {
    Write-Host "[X] 错误: 系统未检测到 Node.js 运行环境 (npx)。" -ForegroundColor Red
    Write-Host "    本补丁采用本地 ASAR 动态反编译打包技术，需要 Node.js 支持。" -ForegroundColor Yellow
    Write-Host "    请前往 https://nodejs.org 安装 Node.js 稳定版后重新运行本脚本。" -ForegroundColor Yellow
    exit 1
}

# 5. Extract to temporary folder
$tempDir = "$env:TEMP\antigravity-unpack-repo"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "[+] 正在解包 app.asar..." -ForegroundColor Cyan
& npx.cmd -y @electron/asar extract $asarPath $tempDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] 解包失败，请检查文件写入权限。" -ForegroundColor Red
    exit 1
}

# 6. Apply patch files
Write-Host "[+] 正在向资源包中植入汉化与优化补丁..." -ForegroundColor Cyan
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$patchDir = Join-Path $scriptDir "patch"

# Copy modified files
Copy-Item -Path "$patchDir\preload.js" -Destination "$tempDir\dist\preload.js" -Force
Copy-Item -Path "$patchDir\ideInstall\wizardPreload.js" -Destination "$tempDir\dist\ideInstall\wizardPreload.js" -Force
Copy-Item -Path "$patchDir\menu.js" -Destination "$tempDir\dist\menu.js" -Force
Copy-Item -Path "$patchDir\tray.js" -Destination "$tempDir\dist\tray.js" -Force
Copy-Item -Path "$patchDir\main.js" -Destination "$tempDir\dist\main.js" -Force
Copy-Item -Path "$patchDir\utils.js" -Destination "$tempDir\dist\utils.js" -Force
Copy-Item -Path "$patchDir\languageServer.js" -Destination "$tempDir\dist\languageServer.js" -Force
Copy-Item -Path "$patchDir\ipcHandlers.js" -Destination "$tempDir\dist\ipcHandlers.js" -Force

# 7. Repack asar
Write-Host "[+] 正在重包 app.asar..." -ForegroundColor Cyan
& npx.cmd -y @electron/asar pack $tempDir $asarPath --unpack-dir "**/chrome-devtools-mcp"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] 打包失败，还原备份中..." -ForegroundColor Red
    Copy-Item -Path $backupPath -Destination $asarPath -Force
    exit 1
}

# 8. Clean up
Write-Host "[+] 正在清理临时工作文件..." -ForegroundColor Cyan
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "      恭喜您！汉化与优化补丁安装成功！                    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  新功能已生效：" -ForegroundColor Green
Write-Host "  1. 100% 完整汉化（支持云端热更新字典，支持标题栏翻译）" -ForegroundColor Green
Write-Host "  2. 高精度代码防护（Monaco 代码区/终端日志绝不误翻译）" -ForegroundColor Green
Write-Host "  3. 0ms 瞬间还原（托盘双击/左键立即还原，无 loading 重新加载）" -ForegroundColor Green
Write-Host "  4. 免 TUN 代理优化（自动解析系统代理传递给智能体）" -ForegroundColor Green
Write-Host ""
Write-Host "  请手动重新运行您的 Antigravity 2.0 桌面客户端享受极速体验！" -ForegroundColor Cyan
