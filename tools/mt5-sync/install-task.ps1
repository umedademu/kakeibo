param(
  [string]$TerminalPath = "C:\Program Files\MetaTrader 5 EXNESS\terminal64.exe",
  [string]$TaskName = "kakeibo MT5 balance sync"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$pythonwPath = Join-Path $repositoryRoot ".venv-mt5\Scripts\pythonw.exe"
$scriptPath = Join-Path $PSScriptRoot "sync_mt5.py"
$environmentPath = Join-Path $repositoryRoot ".env.local"

foreach ($requiredPath in @($pythonwPath, $scriptPath, $environmentPath, $TerminalPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Required file was not found: $requiredPath"
  }
}

$arguments = "`"$scriptPath`" --terminal `"$TerminalPath`" --env-file `"$environmentPath`""
$action = New-ScheduledTaskAction `
  -Execute $pythonwPath `
  -Argument $arguments `
  -WorkingDirectory $repositoryRoot
$triggers = @("01:00", "03:59", "09:00", "13:00", "17:00", "21:00") |
  ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Description "Sends the MT5 USD equity to kakeibo six times per day." `
  -Force | Out-Null

Write-Output "Registered: $TaskName"
