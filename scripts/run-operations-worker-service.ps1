$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logDir = Join-Path $projectRoot "data\operations\logs"
$logFile = Join-Path $logDir "operations-worker.log"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
Add-Content -LiteralPath $logFile -Value ("[{0}] worker wrapper starting" -f (Get-Date -Format o))
$exitCode = 1
Push-Location $projectRoot
try {
  & "C:\Program Files\nodejs\node.exe" scripts\operations-worker.mjs --loop >> $logFile 2>&1
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
Add-Content -LiteralPath $logFile -Value ("[{0}] worker wrapper stopped exit={1}" -f (Get-Date -Format o), $exitCode)
exit $exitCode
