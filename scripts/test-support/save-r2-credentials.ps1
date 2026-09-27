# Saves the bucket-scoped R2 S3 credentials for the PR #33 Preview E2E into the ACL-protected
# %USERPROFILE%\.fuyun-secrets\preview-e2e.env. Values are typed at a hidden prompt: they are not
# echoed, not put on a command line and not written to PowerShell history.
# Run in your own PowerShell window on 8940:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-support\save-r2-credentials.ps1
$ErrorActionPreference = "Stop"
$envFile = Join-Path $env:USERPROFILE ".fuyun-secrets\preview-e2e.env"

function Read-Hidden([string]$prompt) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$keyId = Read-Hidden "R2 Access Key ID (hidden)"
$secret = Read-Hidden "R2 Secret Access Key (hidden)"
if ($keyId -notmatch '^[0-9a-f]{32}$') { throw "Access Key ID should be 32 hex characters; nothing saved." }
if ($secret -notmatch '^[0-9a-f]{64}$') { throw "Secret Access Key should be 64 hex characters; nothing saved." }

$lines = @()
if (Test-Path $envFile) { $lines = Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -notmatch '^R2_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)=' } }
$lines += "R2_ACCESS_KEY_ID=$keyId"
$lines += "R2_SECRET_ACCESS_KEY=$secret"
[IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object Text.UTF8Encoding($false)))
Remove-Variable keyId, secret
Write-Host "Saved to $envFile (inherits the .fuyun-secrets ACL: you + SYSTEM). You can close this window."
