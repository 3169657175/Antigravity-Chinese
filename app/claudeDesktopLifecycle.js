const { execFile } = require('child_process');

function buildWindowsLifecycleScript() {
  return String.raw`
$ErrorActionPreference = 'Stop'

function Write-Result([hashtable]$result) {
  $result | ConvertTo-Json -Compress
}

function Get-SafeProcessPath($process) {
  try { return $process.Path } catch { return $null }
}

function Test-ClaudeDesktopProcess($process, $installLocation) {
  $name = [string]$process.ProcessName
  if ($name -match '^(agy-hub|Codex|ChatGPT|Antigravity)$') { return $false }

  $path = Get-SafeProcessPath $process
  if ($installLocation -and $path) {
    try {
      if ([System.IO.Path]::GetFullPath($path).StartsWith(
        "$installLocation\",
        [System.StringComparison]::OrdinalIgnoreCase
      )) { return $true }
    } catch {}
  }

  if ($name -notmatch '^Claude(?:Desktop)?$') { return $false }
  if ($path -and [System.IO.Path]::GetFileName($path) -match '^Claude(?:Desktop)?\.exe$') { return $true }
  return $process.MainWindowHandle -ne 0
}

try {
  $package = Get-AppxPackage -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match 'Claude|Anthropic' -or
      $_.PackageFamilyName -match '^Claude_|Claude|Anthropic'
    } |
    Sort-Object Version -Descending |
    Select-Object -First 1

  $installLocation = $null
  if ($package -and $package.InstallLocation) {
    $installLocation = [System.IO.Path]::GetFullPath($package.InstallLocation).TrimEnd('\')
  }

  $allProcesses = @(Get-Process -ErrorAction SilentlyContinue)
  $claudeProcesses = @($allProcesses | Where-Object {
    Test-ClaudeDesktopProcess $_ $installLocation
  })
  $mainProcess = $claudeProcesses |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Select-Object -First 1
  $wasRunning = $claudeProcesses.Count -gt 0
  $runningExecutable = if ($mainProcess) { Get-SafeProcessPath $mainProcess } else { $null }

  if ($wasRunning) {
    foreach ($process in @($claudeProcesses | Where-Object { $_.MainWindowHandle -ne 0 })) {
      try { [void]$process.CloseMainWindow() } catch {}
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    do {
      Start-Sleep -Milliseconds 250
      $remaining = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        Test-ClaudeDesktopProcess $_ $installLocation
      })
    } while ($remaining.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline)

    if ($remaining.Count -gt 0) {
      $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 600
    }
  }

  $launchMethod = $null
  $launchTarget = $null
  $startApp = Get-StartApps -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match '^Claude(?: Desktop)?$' -or
      $_.AppID -match '^Claude_.*!Claude$|Claude|Anthropic'
    } |
    Select-Object -First 1

  if ($startApp -and $startApp.AppID) {
    $launchTarget = $startApp.AppID
    Start-Process -FilePath 'explorer.exe' -ArgumentList "shell:AppsFolder\$launchTarget"
    $launchMethod = 'app-id'
  } elseif ($runningExecutable -and (Test-Path -LiteralPath $runningExecutable)) {
    $launchTarget = $runningExecutable
    Start-Process -FilePath $runningExecutable
    $launchMethod = 'executable'
  } else {
    $commonExecutables = @(
      (Join-Path $env:LOCALAPPDATA 'Programs\Claude\Claude.exe'),
      (Join-Path $env:LOCALAPPDATA 'AnthropicClaude\Claude.exe'),
      (Join-Path $env:LOCALAPPDATA 'Claude\Claude.exe')
    )
    $executable = $commonExecutables |
      Where-Object { Test-Path -LiteralPath $_ } |
      Select-Object -First 1

    if ($executable) {
      $launchTarget = $executable
      Start-Process -FilePath $executable
      $launchMethod = 'executable'
    } else {
      $shortcutRoots = @(
        (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
        (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'),
        $env:USERPROFILE + '\Desktop',
        $env:PUBLIC + '\Desktop'
      )
      $shortcut = $shortcutRoots |
        Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
        ForEach-Object {
          Get-ChildItem -LiteralPath $_ -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue
        } |
        Where-Object { $_.BaseName -match '^Claude(?: Desktop)?$' } |
        Select-Object -First 1

      if (-not $shortcut) {
        Write-Result @{
          success = $false
          action = 'not-found'
          wasRunning = $wasRunning
          error = '未找到 Claude Desktop 的安装程序、应用注册或快捷方式'
        }
        exit 2
      }

      $launchTarget = $shortcut.FullName
      Start-Process -FilePath $shortcut.FullName
      $launchMethod = 'shortcut'
    }
  }

  Write-Result @{
    success = $true
    wasRunning = $wasRunning
    action = if ($wasRunning) { 'restarted' } else { 'launched' }
    launchMethod = $launchMethod
    launchTarget = $launchTarget
  }
} catch {
  Write-Result @{
    success = $false
    action = 'failed'
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
  throw new Error('Claude Desktop 生命周期命令未返回有效结果');
}

function restartOrLaunchClaudeDesktop({
  execFileImpl = execFile,
  platform = process.platform
} = {}) {
  if (platform !== 'win32') {
    return Promise.resolve({
      success: false,
      action: 'failed',
      error: '自动启动 Claude Desktop 目前仅支持 Windows'
    });
  }

  const script = buildWindowsLifecycleScript();
  return new Promise(resolve => {
    execFileImpl(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        try {
          const result = parseLifecycleOutput(stdout);
          if (error && result.success) {
            resolve({ success: false, action: 'failed', error: error.message });
            return;
          }
          resolve(result);
        } catch (parseError) {
          resolve({
            success: false,
            action: 'failed',
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
  restartOrLaunchClaudeDesktop
};
