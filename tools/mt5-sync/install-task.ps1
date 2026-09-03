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
$frequentTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 5) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At "03:59"
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger @($frequentTrigger, $dailyTrigger) `
  -Settings $settings `
  -Description "Sends the current MT5 USD balance to kakeibo in Japanese yen." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Output "Registered: $TaskName"
