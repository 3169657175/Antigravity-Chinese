# Antigravity 2.0 Patch Auto-Healer
# Restores the patched app.asar automatically if official updates overwrite it.

$appPath = "$env:LOCALAPPDATA\Programs\antigravity"
$asarPath = "$appPath\resources\app.asar"
$cachedPatchedAsar = "C:\Users\niu\.gemini\antigravity\scratch\app.asar"

if (-not (Test-Path $asarPath)) {
    exit 0
}

# If our cached patched version doesn't exist, we can't restore it
if (-not (Test-Path $cachedPatchedAsar)) {
    exit 0
}

try {
    # Check if the active app.asar contains our patch signature
    $content = [System.IO.File]::ReadAllText($asarPath, [System.Text.Encoding]::GetEncoding('latin1'))
    if ($content -notlike "*antigravity-quota-widget*") {
        # The patch has been overwritten by an official update! Let's heal it!
        
        # Check if antigravity is running. If so, close it to release the file lock.
        $processes = Get-Process -Name "antigravity" -ErrorAction SilentlyContinue
        if ($processes) {
            Stop-Process -Name "antigravity" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        
        # Overwrite with our cached patched version
        Copy-Item -Path $cachedPatchedAsar -Destination $asarPath -Force
        
        # Restart the app so the user doesn't notice any disruption
        if ($processes) {
            Start-Process -FilePath "$appPath\Antigravity.exe"
        }
    }
} catch {
    # Fail silently in the background to avoid bothering the user
}
