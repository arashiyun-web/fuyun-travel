# Supervisor for the Fuyun operations worker on 8940 (run by the Fuyun-Operations-Worker scheduled task).
# - Pins the Node binary and logs its real path/version (no PATH lookup).
# - Restarts the worker when it exits, with exponential backoff (5 s → 60 s) so a persistent
#   failure (e.g. bad config) never becomes a tight restart loop.
# - Worker settings come from a protected env file; nothing secret is written to the log.
param(
  [string]$NodeExe = "C:\Program Files\nodejs\node.exe",
  [string]$WorkerScript = "$env:USERPROFILE\.fuyun-tools\worker\operations-worker.mjs",
  [string]$EnvFile = "$env:USERPROFILE\.fuyun-secrets\worker.env",
  [string]$LogDir = "$env:USERPROFILE\.fuyun-tools\worker\logs"
)
$ErrorActionPreference = "Continue"
New-Item -ItemType Directory -Force $LogDir | Out-Null
$log = Join-Path $LogDir "operations-worker.log"
function Log($message) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format o), $message) -Encoding UTF8 }

$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$nodeInfo = & $NodeExe -e "process.stdout.write(process.execPath + ' ' + process.version)"
Log "supervisor start identity=$identity node=$nodeInfo script=$WorkerScript envFileReadable=$(Test-Path $EnvFile)"
$env:OPERATIONS_WORKER_ENV_FILE = $EnvFile
$backoff = 5
while ($true) {
  $started = Get-Date
  # Pipe through Out-File so the log stays UTF-8 (Windows PowerShell 5.1 redirection writes UTF-16).
  & $NodeExe $WorkerScript --loop 2>&1 | ForEach-Object { "[{0}] {1}" -f (Get-Date -Format o), $_ } | Out-File -FilePath $log -Append -Encoding utf8
  $code = $LASTEXITCODE
  $ranSeconds = [int]((Get-Date) - $started).TotalSeconds
  if ($ranSeconds -ge 120) { $backoff = 5 } else { $backoff = [Math]::Min($backoff * 2, 60) }
  Log "worker exited code=$code after ${ranSeconds}s; restarting in ${backoff}s"
  Start-Sleep -Seconds $backoff
}
