# Stop the isolated operations test stack started by start-ops-db-stack.mjs.
# Only kills PIDs listed in pids.json whose command line matches the expected test process.
param([Parameter(Mandatory = $true)][string]$WorkDir, [string[]]$Only = @())
$pids = Get-Content (Join-Path $WorkDir 'pids.json') -Raw | ConvertFrom-Json
foreach ($name in $pids.PSObject.Properties.Name) {
  if ($Only.Count -and -not ($Only -contains $name)) { continue }
  $processId = $pids.$name
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
  if (-not $proc) { "$name pid=$processId already gone"; continue }
  if ($proc.CommandLine -notmatch 's3-mock\.mjs|next[\\/]dist[\\/]bin[\\/]next') { "$name pid=$processId unexpected command line; not killed"; continue }
  taskkill /PID $processId /T /F | Out-Null
  "$name pid=$processId stopped"
}
