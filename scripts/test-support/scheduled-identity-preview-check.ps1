# One-shot check that the 8940 scheduled-task identity (S4U, Limited — same principal as
# Fuyun-Operations-Worker) can reach the isolated PR #33 Preview, read its protected config and run
# the worker once. Uses a temporary task and a temporary env file; the production worker task and its
# destination are not touched. Afterwards run:  node scripts/operations-preview-e2e.mjs sched <previewUrl>
# Usage (bypass secret passed via the process environment, never on the command line):
#   $env:VERCEL_AUTOMATION_BYPASS_SECRET = ...; powershell -File scheduled-identity-preview-check.ps1 -PreviewUrl https://...
param([Parameter(Mandatory = $true)][string]$PreviewUrl)
$ErrorActionPreference = "Stop"
if ($PreviewUrl -notmatch '^https://[a-z0-9-]+\.vercel\.app/?$') { throw "PreviewUrl must be a https *.vercel.app deployment URL" }
$taskName = "Fuyun-Operations-Worker-PreviewE2E"
$root = Join-Path $env:USERPROFILE ".fuyun-tools\worker-preview-e2e"
$envFile = Join-Path $env:USERPROFILE ".fuyun-secrets\preview-worker.env"
$log = Join-Path $root "worker-once.log"
$node = "C:\Program Files\nodejs\node.exe"
New-Item -ItemType Directory -Force $root | Out-Null
Copy-Item (Join-Path $PSScriptRoot "..\operations-worker.mjs") (Join-Path $root "operations-worker.mjs") -Force

$cfg = @{}
Get-Content (Join-Path $env:USERPROFILE ".fuyun-secrets\preview-e2e.env") -Encoding UTF8 | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object { $i = $_.IndexOf("="); $cfg[$_.Substring(0, $i)] = $_.Substring($i + 1) }
if (-not $env:VERCEL_AUTOMATION_BYPASS_SECRET) { throw "VERCEL_AUTOMATION_BYPASS_SECRET not set in this process" }
$lines = @(
  "OPERATIONS_AGENT_BASE_URL=$($PreviewUrl.TrimEnd('/'))",
  "OPERATIONS_CRON_TOKEN=$($cfg['PREVIEW_OPERATIONS_CRON_TOKEN'])",
  "OPERATIONS_AGENT_PROTECTION_BYPASS=$($env:VERCEL_AUTOMATION_BYPASS_SECRET)",
  "OPERATIONS_WORKER_LOCK=$root\worker.lock"
)
[IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object Text.UTF8Encoding($false)))  # inherits .fuyun-secrets ACL

try {
  $cmd = "set OPERATIONS_WORKER_ENV_FILE=$envFile&& `"$node`" `"$root\operations-worker.mjs`" > `"$log`" 2>&1"
  $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/d /c $cmd"
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
  Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName $taskName
  $deadline = (Get-Date).AddMinutes(4)
  do { Start-Sleep -Seconds 3; $state = (Get-ScheduledTask -TaskName $taskName).State } while ($state -eq "Running" -and (Get-Date) -lt $deadline)
  $info = Get-ScheduledTaskInfo -TaskName $taskName
  $p = (Get-ScheduledTask -TaskName $taskName).Principal
  "task=$taskName principal=$($p.UserId) logon=$($p.LogonType) runlevel=$($p.RunLevel) lastResult=$($info.LastTaskResult) state=$state"
  "worker log: " + ((Get-Content $log -Encoding UTF8 -ErrorAction SilentlyContinue) -join " | ")
} finally {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Remove-Item $envFile -Force -ErrorAction SilentlyContinue
  "cleanup: temporary task removed, temporary env file removed"
}
