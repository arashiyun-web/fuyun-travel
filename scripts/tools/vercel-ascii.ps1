# Runs the Vercel CLI with the non-ASCII hostname preload (see vercel-ascii-hostname.cjs).
#   powershell -NoProfile -File scripts\tools\vercel-ascii.ps1 whoami
#   powershell -NoProfile -File scripts\tools\vercel-ascii.ps1 env ls production --scope arashiyun-s-projects --project fuyun-travel
#   powershell -NoProfile -File scripts\tools\vercel-ascii.ps1 --exec node scripts\operations-preview-e2e.mjs run <url>
# --exec runs another command whose child processes call `vercel` (the preload stays inert outside the CLI).
# NODE_OPTIONS is extended for this process and its children only, keeps any existing value, and is
# restored afterwards; nothing global is changed. The exit code of the CLI/command is returned.
# Arguments with spaces pass through intact; Windows PowerShell 5.1 does not preserve embedded double
# quotes in native-command arguments, so pass values through stdin (as `vercel env add` does) instead.
$ErrorActionPreference = "Stop"
$preload = Join-Path $PSScriptRoot "vercel-ascii-hostname.cjs"
if (-not (Test-Path -LiteralPath $preload)) { [Console]::Error.WriteLine("preload not found: $preload"); exit 2 }
# NODE_OPTIONS treats backslash inside quotes as an escape; forward slashes are valid Windows paths.
$requireOpt = '--require "' + ($preload -replace '\\', '/') + '"'

$saved = $env:NODE_OPTIONS
$hadSaved = Test-Path Env:NODE_OPTIONS
$code = 1
try {
  if ($saved -and $saved.Contains($requireOpt)) { $env:NODE_OPTIONS = $saved }
  elseif ($saved) { $env:NODE_OPTIONS = "$saved $requireOpt" }
  else { $env:NODE_OPTIONS = $requireOpt }

  $rest = @($args)
  if ($rest.Count -ge 1 -and $rest[0] -eq "--exec") {
    if ($rest.Count -lt 2) { [Console]::Error.WriteLine("usage: vercel-ascii.ps1 --exec <command> [args...]"); exit 2 }
    # Native executables only: $LASTEXITCODE is not set by cmdlets/functions, so their result would be stale.
    $native = Get-Command $rest[1] -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $native) { [Console]::Error.WriteLine("--exec needs a native executable (node, powershell, ...): $($rest[1])"); exit 2 }
    $cmd = $native.Source
    $cmdArgs = if ($rest.Count -gt 2) { $rest[2..($rest.Count - 1)] } else { @() }
    & $cmd @cmdArgs
  } else {
    $cli = $env:VERCEL_CLI_JS
    if (-not $cli) {
      $shim = Get-Command vercel -CommandType ExternalScript, Application -ErrorAction Stop | Select-Object -First 1
      $cli = Join-Path (Split-Path $shim.Source) "node_modules\vercel\dist\vc.js"
    }
    if (-not (Test-Path -LiteralPath $cli)) { [Console]::Error.WriteLine("Vercel CLI entry not found: $cli"); exit 2 }
    $node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    & $node $cli @rest
  }
  $code = $LASTEXITCODE
} finally {
  if ($hadSaved) { $env:NODE_OPTIONS = $saved } else { Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue }
}
exit $code
