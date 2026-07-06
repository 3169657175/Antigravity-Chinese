# Antigravity 2.0 Chinese Localization & UX Optimization Patch Installer
# Cross-version safe local asar patching mechanism

$Host.UI.RawUI.WindowTitle = "Antigravity 2.0 汉化优化"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Antigravity 2.0 汉化与免 TUN 优化    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Locate Antigravity directory
$appPath = "$env:LOCALAPPDATA\Programs\antigravity"
$asarPath = "$appPath\resources\app.asar"
$backupPath = "$appPath\resources\app.asar.backup"

if (-not (Test-Path $asarPath)) {
    Write-Host "[X] 错误: 未在默认路径找到 Antigravity 客户端:" -ForegroundColor Red
    Write-Host "    $asarPath" -ForegroundColor Red
    Write-Host "    请确认已安装 Antigravity 客户端。" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] 找到客户端核心文件: $asarPath" -ForegroundColor Green

# 2. Check for running processes (Bypassed to prevent killing active AI session)
# $processes = Get-Process -Name "antigravity" -ErrorAction SilentlyContinue
# if ($processes) {
#     Write-Host "[i] 检测到 Antigravity 运行中，正在关闭进程..." -ForegroundColor Yellow
#     Stop-Process -Name "antigravity" -Force -ErrorAction SilentlyContinue
#     Start-Sleep -Seconds 2
# }

# 3. Create backup if it doesn't exist
if (-not (Test-Path $backupPath)) {
    Write-Host "[+] 首次安装，备份官方原版 app.asar 为 app.asar.backup..." -ForegroundColor Green
    Copy-Item -Path $asarPath -Destination $backupPath -Force
} else {
    Write-Host "[*] 备份已存在，直接进行覆盖安装" -ForegroundColor Yellow
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$prebuiltAsar = Join-Path $scriptDir "app.asar"

# 4. Check if prebuilt package is available (Bypasses Node.js requirement)
if (Test-Path $prebuiltAsar) {
    Write-Host "[+] 发现预编译成品包，正在直接覆盖部署..." -ForegroundColor Cyan
    try {
        Copy-Item -Path $prebuiltAsar -Destination $asarPath -Force
        
        $prebuiltUnpacked = Join-Path $scriptDir "app.asar.unpacked"
        if (Test-Path $prebuiltUnpacked) {
            Write-Host "[+] 正在部署配套依赖项 app.asar.unpacked..." -ForegroundColor Cyan
            $destUnpacked = Join-Path $appPath "resources\app.asar.unpacked"
            if (Test-Path $destUnpacked) {
                Remove-Item -Path $destUnpacked -Recurse -Force -ErrorAction SilentlyContinue
            }
            Copy-Item -Path $prebuiltUnpacked -Destination "$appPath\resources" -Recurse -Force
        }
        Write-Host "[OK] 预编译成品包部署完成！" -ForegroundColor Green
    } catch {
        Write-Host "[X] 部署预编译包失败，原因为: $_" -ForegroundColor Red
        exit 1
    }
} else {
    # 5. Check for node/npx (Compilation fallback)
    $npxCheck = Get-Command npx -ErrorAction SilentlyContinue
    if (-not $npxCheck) {
        Write-Host "[X] 错误: 系统未检测到 Node.js 环境 (npx)。" -ForegroundColor Red
        Write-Host "    本地动态编译需要 Node.js 支持。" -ForegroundColor Yellow
        Write-Host "    请前往 https://nodejs.org 安装 Node.js 稳定版后重试。" -ForegroundColor Yellow
        exit 1
    }

    # 6. Extract to temporary folder
    $tempDir = "$env:TEMP\antigravity-unpack-repo"
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host "[+] 正在解包 app.asar..." -ForegroundColor Cyan
    & npx.cmd -y @electron/asar extract $asarPath $tempDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] 解包失败，可能是文件写保护或权限不足。" -ForegroundColor Red
        exit 1
    }

    # 7. Apply patch files
    Write-Host "[+] 正在注入汉化补丁..." -ForegroundColor Cyan
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

    # 8. Repack asar
    Write-Host "[+] 正在重新打包 app.asar..." -ForegroundColor Cyan
    & npx.cmd -y @electron/asar pack $tempDir $asarPath --unpack-dir "**/chrome-devtools-mcp"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] 打包失败，正在恢复原始备份..." -ForegroundColor Red
        Copy-Item -Path $backupPath -Destination $asarPath -Force
        exit 1
    }

    # Clean up
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

# 9. Register Auto-Healer in Startup Folder
Write-Host "[+] 正在配置开机自愈服务..." -ForegroundColor Cyan
$scratchDir = Join-Path $env:USERPROFILE ".gemini\antigravity\scratch"
if (-not (Test-Path $scratchDir)) {
    New-Item -ItemType Directory -Path $scratchDir -Force | Out-Null
}
$cachedPatchedAsar = Join-Path $scratchDir "app.asar"
Copy-Item -Path $asarPath -Destination $cachedPatchedAsar -Force
if (Test-Path "$appPath\resources\app.asar.unpacked") {
    $cachedUnpacked = Join-Path $scratchDir "app.asar.unpacked"
    if (Test-Path $cachedUnpacked) {
        Remove-Item -Path $cachedUnpacked -Recurse -Force -ErrorAction SilentlyContinue
    }
    Copy-Item -Path "$appPath\resources\app.asar.unpacked" -Destination $scratchDir -Recurse -Force
}

$startupFile = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AntigravityPatchAutoHealer.vbs"
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & Chr(34) & "$scriptDir\auto_heal.ps1" & Chr(34) & """", 0, False
"@
[System.IO.File]::WriteAllText($startupFile, $vbsContent, [System.Text.Encoding]::ASCII)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "      补丁覆盖安装成功！                    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  新增优化特性已生效，祝你使用愉快！" -ForegroundColor Green
