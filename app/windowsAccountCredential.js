// Windows keyring writer for Antigravity's keyring-rs credential target.
// Credentials are passed over the child's STDIN, never CLI arguments, logs or temporary files.
const { spawn } = require('child_process');

const TARGET = 'gemini:antigravity';
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$source = @'
using System;
using System.Text;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct NativeCredential {
    public uint Flags;
    public uint Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public long LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
}
public static class AgyWinCredential {
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredWrite(ref NativeCredential credential, uint flags);
    public static void Write(string target, string username, string secret) {
        var bytes = Encoding.UTF8.GetBytes(secret);
        var c = new NativeCredential {
            Type = 1,
            TargetName = Marshal.StringToHGlobalUni(target),
            UserName = Marshal.StringToHGlobalUni(username),
            CredentialBlob = Marshal.AllocHGlobal(bytes.Length),
            CredentialBlobSize = (uint)bytes.Length,
            Persist = 2
        };
        try {
            Marshal.Copy(bytes, 0, c.CredentialBlob, bytes.Length);
            if (!CredWrite(ref c, 0)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        } finally {
            Array.Clear(bytes, 0, bytes.Length);
            Marshal.FreeHGlobal(c.TargetName);
            Marshal.FreeHGlobal(c.UserName);
            Marshal.FreeHGlobal(c.CredentialBlob);
        }
    }
}
'@
Add-Type -TypeDefinition $source -ErrorAction Stop
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json -ErrorAction Stop
[AgyWinCredential]::Write('gemini:antigravity', 'antigravity', [string]$payload)
Write-Output 'CREDENTIAL_UPDATED'
`;

function credentialDocument(token) {
  if (!token || typeof token.refresh_token !== 'string' || !token.refresh_token) {
    throw new Error('目标账号没有有效的刷新凭据，请重新授权');
  }
  const expirySeconds = Number(token.expiry_timestamp);
  const expiry = Number.isFinite(expirySeconds) && expirySeconds > 0
    ? new Date(expirySeconds * 1000).toISOString().replace('.000Z', '.000000Z')
    : '1970-01-01T00:00:00.000000Z';
  return JSON.stringify({
    token: {
      access_token: String(token.access_token || ''),
      token_type: String(token.token_type || 'Bearer'),
      refresh_token: token.refresh_token,
      expiry
    },
    auth_method: 'consumer'
  });
}

function writeWindowsAntigravityCredential(token, { spawnProcess = spawn, platform = process.platform, timeoutMs = 12000 } = {}) {
  if (platform !== 'win32') return Promise.reject(new Error('仅 Windows 支持 Antigravity 系统凭据切换'));
  let doc;
  try { doc = credentialDocument(token); } catch (error) { return Promise.reject(error); }
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64');
    const child = spawnProcess('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let exited = false;
    const timer = setTimeout(() => {
      child.kill();
      if (!exited) reject(new Error('系统凭据写入超时，账号未切换'));
    }, timeoutMs);
    child.stdout.on('data', chunk => { output = (output + String(chunk)).slice(-4096); });
    // Do not capture stderr: PowerShell may echo parts of the script or input.
    child.stderr.resume();
    child.on('error', () => {
      exited = true; clearTimeout(timer);
      reject(new Error('无法启动 Windows 凭据写入进程，账号未切换'));
    });
    child.on('close', code => {
      exited = true; clearTimeout(timer);
      if (code === 0 && output.includes('CREDENTIAL_UPDATED')) resolve({ written: true });
      else reject(new Error('Windows 凭据管理器写入失败，账号未切换'));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(doc, 'utf8');
  });
}

module.exports = { TARGET, credentialDocument, writeWindowsAntigravityCredential };
