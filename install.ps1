# Antigravity 2.0 Chinese Localization & UX Optimization Patch Installer
# Cross-version safe local asar patching mechanism

$Host.UI.RawUI.WindowTitle = "Antigravity 2.0 Chinese Patch Installer"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Antigravity 2.0 Chinese Patch Installer    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Locate Antigravity directory
$appPath = "$env:LOCALAPPDATA\Programs\antigravity"
$asarPath = "$appPath\resources\app.asar"
$backupPath = "$appPath\resources\app.asar.backup"

if (-not (Test-Path $asarPath)) {
    Write-Host "[X] ERROR: Antigravity client not found at default path:" -ForegroundColor Red
    Write-Host "    $asarPath" -ForegroundColor Red
    Write-Host "    Please ensure Antigravity client is installed." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Found client core file: $asarPath" -ForegroundColor Green

# 3. Create backup if it doesn't exist
if (-not (Test-Path $backupPath)) {
    Write-Host "[+] Creating official app.asar backup..." -ForegroundColor Green
    Copy-Item -Path $asarPath -Destination $backupPath -Force
} else {
    Write-Host "[*] Backup already exists, proceeding with installation" -ForegroundColor Yellow
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$prebuiltAsar = Join-Path $scriptDir "app.asar"

# 4. Check if prebuilt package is available (Bypasses Node.js requirement)
if (Test-Path $prebuiltAsar) {
    Write-Host "[+] Found prebuilt package, deploying directly..." -ForegroundColor Cyan
    try {
        Copy-Item -Path $prebuiltAsar -Destination $asarPath -Force
        
        $prebuiltUnpacked = Join-Path $scriptDir "app.asar.unpacked"
        if (Test-Path $prebuiltUnpacked) {
            Write-Host "[+] Deploying app.asar.unpacked dependencies..." -ForegroundColor Cyan
            $destUnpacked = Join-Path $appPath "resources\app.asar.unpacked"
            if (Test-Path $destUnpacked) {
                Remove-Item -Path $destUnpacked -Recurse -Force -ErrorAction SilentlyContinue
            }
            Copy-Item -Path $prebuiltUnpacked -Destination "$appPath\resources" -Recurse -Force
        }
        Write-Host "[OK] Prebuilt package deployed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "[X] Failed to deploy prebuilt package: $_" -ForegroundColor Red
        exit 1
    }
} else {
    # 5. Check for node/npx (Compilation fallback)
    $npxCheck = Get-Command npx -ErrorAction SilentlyContinue
    if (-not $npxCheck) {
        Write-Host "[X] ERROR: Node.js (npx) is not installed on this system." -ForegroundColor Red
        Write-Host "    Local compilation requires Node.js." -ForegroundColor Yellow
        Write-Host "    Please install Node.js from https://nodejs.org and try again." -ForegroundColor Yellow
        exit 1
    }

    # 6. Extract to temporary folder
    $tempDir = "$env:TEMP\antigravity-unpack-repo"
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host "[+] Extracting app.asar..." -ForegroundColor Cyan
    & npx.cmd -y @electron/asar extract $asarPath $tempDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Extraction failed. Check permissions." -ForegroundColor Red
        exit 1
    }

    # 7. Apply patch files
    Write-Host "[+] Applying Chinese patch..." -ForegroundColor Cyan
    $patchDir = Join-Path $scriptDir "patch"

    Copy-Item -Path "$patchDir\preload.js" -Destination "$tempDir\dist\preload.js" -Force
    Copy-Item -Path "$patchDir\ideInstall\wizardPreload.js" -Destination "$tempDir\dist\ideInstall\wizardPreload.js" -Force
    Copy-Item -Path "$patchDir\menu.js" -Destination "$tempDir\dist\menu.js" -Force
    Copy-Item -Path "$patchDir\tray.js" -Destination "$tempDir\dist\tray.js" -Force
    Copy-Item -Path "$patchDir\main.js" -Destination "$tempDir\dist\main.js" -Force
    Copy-Item -Path "$patchDir\utils.js" -Destination "$tempDir\dist\utils.js" -Force
    Copy-Item -Path "$patchDir\languageServer.js" -Destination "$tempDir\dist\languageServer.js" -Force
    Copy-Item -Path "$patchDir\ipcHandlers.js" -Destination "$tempDir\dist\ipcHandlers.js" -Force
    Copy-Item -Path "$patchDir\accountVault.js" -Destination "$tempDir\dist\accountVault.js" -Force

    # 8. Repack asar
    Write-Host "[+] Repacking app.asar..." -ForegroundColor Cyan
    & npx.cmd -y @electron/asar pack $tempDir $asarPath --unpack-dir "**/chrome-devtools-mcp"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Repack failed. Restoring original backup..." -ForegroundColor Red
        Copy-Item -Path $backupPath -Destination $asarPath -Force
        exit 1
    }

    # Clean up
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

# 9. Register Auto-Healer in Startup Folder
Write-Host "[+] Registering patch auto-healer..." -ForegroundColor Cyan
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
WshShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File " & Chr(34) & "$scriptDir\auto_heal.ps1" & Chr(34), 0, False
"@
[System.IO.File]::WriteAllText($startupFile, $vbsContent, [System.Text.Encoding]::ASCII)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "      Installation completed successfully!                 " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Please restart Antigravity client to apply changes." -ForegroundColor Green
