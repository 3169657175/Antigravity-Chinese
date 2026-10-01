const { execFile } = require('child_process');

function buildWindowsLifecycleScript() {
  return String.raw`
$ErrorActionPreference = 'Stop'

function Write-Result([hashtable]$result) {
  $result | ConvertTo-Json -Compress
}

try {
  $package = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue |
    Sort-Object Version -Descending |
    Select-Object -First 1

  $appId = $null
  $installLocation = $null
  if ($package) {
    $appId = "$($package.PackageFamilyName)!App"
    $installLocation = [System.IO.Path]::GetFullPath($package.InstallLocation).TrimEnd('\')
  }

  $packageProcesses = @()
  if ($installLocation) {
    $packageProcesses = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
      try {
        $_.Path -and [System.IO.Path]::GetFullPath($_.Path).StartsWith(
          "$installLocation\",
          [System.StringComparison]::OrdinalIgnoreCase
        )
      } catch {
        $false
      }
    })
  }

  $fallbackMain = $null
  if (-not $package -and $packageProcesses.Count -eq 0) {
    $fallbackMain = Get-Process -Name 'ChatGPT' -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } |
      Select-Object -First 1
  }

  $wasRunning = $packageProcesses.Count -gt 0 -or $null -ne $fallbackMain
  $fallbackPath = if ($fallbackMain) { $fallbackMain.Path } else { $null }

  if ($packageProcesses.Count -gt 0) {
    $windowProcesses = @($packageProcesses | Where-Object { $_.MainWindowHandle -ne 0 })
    foreach ($process in $windowProcesses) {
      try { [void]$process.CloseMainWindow() } catch {}
    }
    if ($windowProcesses.Count -gt 0) { Start-Sleep -Milliseconds 1200 }

    $remaining = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
      try {
        $_.Path -and [System.IO.Path]::GetFullPath($_.Path).StartsWith(
          "$installLocation\",
          [System.StringComparison]::OrdinalIgnoreCase
        )
      } catch {
        $false
      }
    })
    $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
    if ($remaining.Count -gt 0) { Start-Sleep -Milliseconds 700 }
  } elseif ($fallbackMain) {
    try { [void]$fallbackMain.CloseMainWindow() } catch {}
    Start-Sleep -Milliseconds 1200
    if (Get-Process -Id $fallbackMain.Id -ErrorAction SilentlyContinue) {
      Stop-Process -Id $fallbackMain.Id -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 500
    }
  }

  if ($appId) {
    Start-Process -FilePath 'explorer.exe' -ArgumentList "shell:AppsFolder\$appId"
  } elseif ($fallbackPath -and (Test-Path -LiteralPath $fallbackPath)) {
    Start-Process -FilePath $fallbackPath
  } else {
    $startApp = Get-StartApps |
      Where-Object { $_.Name -match '^(Codex|ChatGPT)$' -or $_.AppID -match 'OpenAI\.Codex' } |
      Select-Object -First 1
    if (-not $startApp) { throw '未找到已安装的 Codex 应用' }
    $appId = $startApp.AppID
    Start-Process -FilePath 'explorer.exe' -ArgumentList "shell:AppsFolder\$appId"
  }

  Write-Result @{
    success = $true
    wasRunning = $wasRunning
    action = if ($wasRunning) { 'restarted' } else { 'launched' }
    appId = $appId
  }
} catch {
  Write-Result @{
    success = $false
    error = $_.Exception.Message
  }
  exit 1
}
`;
}

function parseLifecycleOutput(stdout) {
  const lines = String(stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]);
      if (parsed && typeof parsed.success === 'boolean') return parsed;
    } catch (_) {}
  }
  throw new Error('Codex 生命周期命令未返回有效结果');
}

function restartOrLaunchCodex({
  execFileImpl = execFile,
  platform = process.platform
} = {}) {
  if (platform !== 'win32') {
    return Promise.resolve({
      success: false,
      error: '自动启动 Codex 目前仅支持 Windows'
    });
  }

  const script = buildWindowsLifecycleScript();
  return new Promise(resolve => {
    execFileImpl(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        try {
          const result = parseLifecycleOutput(stdout);
          if (error && result.success) {
            resolve({ success: false, error: error.message });
            return;
          }
          resolve(result);
        } catch (parseError) {
          resolve({
            success: false,
            error: String(stderr || '').trim() || error?.message || parseError.message
          });
        }
      }
    );
  });
}

module.exports = {
  buildWindowsLifecycleScript,
  parseLifecycleOutput,
  restartOrLaunchCodex
};
