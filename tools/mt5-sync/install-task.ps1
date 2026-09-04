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
$regularTimes = 0..23 |
  Where-Object { $_ -ne 4 } |
  ForEach-Object { "{0:D2}:00" -f $_ }
$triggers = (@($regularTimes) + "03:59") |
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
  -Description "Sends the MT5 USD equity to kakeibo hourly, replacing 04:00 with 03:59." `
  -Force | Out-Null

Write-Output "Registered: $TaskName"
