# Antigravity 2.0 Chinese Localization Patch Installer v2
# Direct compilation without complex branches

$Host.UI.RawUI.WindowTitle = "Antigravity 2.0 Chinese Patch Installer v2"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Antigravity 2.0 Chinese Patch Installer (v2)        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$appPath = "$env:LOCALAPPDATA\Programs\antigravity"
$asarPath = "$appPath\resources\app.asar"
$backupPath = "$appPath\resources\app.asar.backup"

if (-not (Test-Path $asarPath)) {
    Write-Host "[X] ERROR: Client core app.asar not found!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Found core file: $asarPath" -ForegroundColor Green



# 2. Backup app.asar if not exists
if (-not (Test-Path $backupPath)) {
    Write-Host "[+] Backing up original app.asar..." -ForegroundColor Green
    Copy-Item -Path $asarPath -Destination $backupPath -Force
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# 3. Check compilation requirements
$npxCheck = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npxCheck) {
    Write-Host "[X] ERROR: Node.js (npx) is required for repack compiling." -ForegroundColor Red
    exit 1
}

# 4. Clear and Extract
$tempDir = "$env:TEMP\antigravity-unpack-repo"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "[+] Extracting app.asar package..." -ForegroundColor Cyan
& npx.cmd -y @electron/asar extract $asarPath $tempDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Extraction failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[+] Waiting for file handles to flush..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# 5. Apply new patch files
Write-Host "[+] Compiling sandbox bundle and injecting Chinese v2 patch..." -ForegroundColor Cyan
$patchDir = Join-Path $scriptDir "patch"

# Run sandbox bundle generator
& node.exe "$scriptDir\bundle.js"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Bundle compilation failed!"
    exit 1
}

Write-Host "    [DEBUG] Source preload.js size: $((Get-Item "$scriptDir\dist_preload.js").Length) bytes" -ForegroundColor Gray

# Use .NET native file copy for strict verification
try {
    [System.IO.File]::Copy("$scriptDir\dist_preload.js", "$tempDir\dist\preload.js", $true)
    [System.IO.File]::Copy("$patchDir\menu.js", "$tempDir\dist\menu.js", $true)
    [System.IO.File]::Copy("$patchDir\tray.js", "$tempDir\dist\tray.js", $true)
    [System.IO.File]::Copy("$patchDir\main.js", "$tempDir\dist\main.js", $true)
    [System.IO.File]::Copy("$patchDir\utils.js", "$tempDir\dist\utils.js", $true)
    [System.IO.File]::Copy("$patchDir\languageServer.js", "$tempDir\dist\languageServer.js", $true)
    [System.IO.File]::Copy("$patchDir\ipcHandlers.js", "$tempDir\dist\ipcHandlers.js", $true)
} catch {
    Write-Error "CRITICAL ERROR during file override: $_"
    exit 1
}

# Copy catalogs (exclude raw source core/modules since they are now bundled inside preload.js)
if (Test-Path "$patchDir\ideInstall") {
    Copy-Item -Path "$patchDir\ideInstall" -Destination "$tempDir\dist" -Recurse -Force -ErrorAction Stop
}
if (Test-Path "$patchDir\locales") {
    Copy-Item -Path "$patchDir\locales" -Destination "$tempDir\dist" -Recurse -Force -ErrorAction Stop
}

$appliedSize = (Get-Item "$tempDir\dist\preload.js").Length
Write-Host "    [DEBUG] Applied preload.js size: $appliedSize bytes" -ForegroundColor Gray
if ($appliedSize -gt 500000) {
    Write-Error "CRITICAL ERROR: preload.js replacement failed! Size: $appliedSize"
    exit 1
}

# 5.5 计算核心文件的 SHA-256 校验和并写入到解包目录下的 package.json
Write-Host "[+] Generating SHA-256 integrity checksums..." -ForegroundColor Cyan
$pkgJsonPath = "$tempDir\package.json"
if (Test-Path $pkgJsonPath) {
    $pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
    $checksums = @{}
    $filesToCheck = @("dist/main.js", "dist/preload.js", "dist/ipcHandlers.js", "dist/accountVault.js")
    
    foreach ($relFile in $filesToCheck) {
        $fullFilePath = "$tempDir\$relFile"
        if (Test-Path $fullFilePath) {
            # 计算 SHA-256 指纹
            $hashBytes = [System.Security.Cryptography.HashAlgorithm]::Create("SHA256").ComputeHash([System.IO.File]::ReadAllBytes($fullFilePath))
            $hashStr = [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()
            $checksums[$relFile] = $hashStr
            Write-Host "    [HASH] $relFile -> $hashStr" -ForegroundColor Gray
        } else {
            Write-Warning "    [HASH] Missing core file for checksum: $relFile"
        }
    }
    
    # 强制将哈希指纹注入为 package.json 的元数据
    $pkg | Add-Member -MemberType NoteProperty -Name "checksums" -Value $checksums -Force
    # 将更新后的 package.json 重新写入
    $newJson = $pkg | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($pkgJsonPath, $newJson, [System.Text.Encoding]::UTF8)
    Write-Host "[OK] SHA-256 checksums embedded into package.json!" -ForegroundColor Green
} else {
    Write-Error "CRITICAL ERROR: package.json not found in unpacked temp dir!"
    exit 1
}

# 6. Repack asar package
Write-Host "[+] Compiling and repacking app.asar..." -ForegroundColor Cyan
& npx.cmd -y @electron/asar pack $tempDir $asarPath --unpack-dir "**/chrome-devtools-mcp"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Repacking failed!" -ForegroundColor Red
    exit 1
}

Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
# Clean temp bundle file
Remove-Item -Path "$scriptDir\dist_preload.js" -Force -ErrorAction SilentlyContinue

# 7. Register Auto-Healer Cache
Write-Host "[+] Syncing auto-healer offline cache..." -ForegroundColor Cyan
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
