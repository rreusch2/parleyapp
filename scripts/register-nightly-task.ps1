<#
.SYNOPSIS
  Installs (or updates) the Windows Scheduled Task that runs the nightly automation at 10:00 PM.

.EXAMPLE
  .\scripts\register-nightly-task.ps1
  .\scripts\register-nightly-task.ps1 -At 21:30
  .\scripts\register-nightly-task.ps1 -Unregister
#>
[CmdletBinding()]
param(
  # Daily start time, 24h format.
  [string]$At = '22:00',

  [string]$TaskName = 'ParleyApp Nightly Automation',
  [string]$TaskPath = '\ParleyApp\',

  # Run even when no user is signed in. Requires the account password (session 0, fully hidden).
  [switch]$RunWhetherLoggedOn,

  # Remove the task instead of creating it.
  [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$RepoRoot  = Split-Path $ScriptDir -Parent
$Runner    = Join-Path $ScriptDir 'nightly-automation.ps1'

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
  Write-Host "Removed scheduled task '$TaskName'." -ForegroundColor Yellow
  return
}

if (-not (Test-Path $Runner)) { throw "Runner not found: $Runner" }

$startTime = [datetime]::ParseExact($At, 'HH:mm', $null)

# Windows PowerShell 5.1 is always present; prefer pwsh 7 when installed.
$psExe = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source
if (-not $psExe) { $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe' }

$action = New-ScheduledTaskAction -Execute $psExe `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Runner`"" `
  -WorkingDirectory $RepoRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $startTime

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -WakeToRun `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 6) `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 15)
$settings.Hidden = $true

$userId = "$env:USERDOMAIN\$env:USERNAME"
$register = @{
  TaskName    = $TaskName
  TaskPath    = $TaskPath
  Action      = $action
  Trigger     = $trigger
  Settings    = $settings
  Description = 'Refreshes odds then generates tomorrow player props, team picks and insights.'
  Force       = $true
}

if ($RunWhetherLoggedOn) {
  $cred = Get-Credential -UserName $userId -Message 'Password for the account that will run the nightly task'
  $register.User     = $cred.UserName
  $register.Password = $cred.GetNetworkCredential().Password
  $register.RunLevel = 'Limited'
} else {
  $register.Principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
}

Register-ScheduledTask @register | Out-Null

$task = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath
$info = $task | Get-ScheduledTaskInfo

Write-Host ""
Write-Host "Scheduled task installed." -ForegroundColor Green
Write-Host "  Name:      $TaskPath$TaskName"
Write-Host "  Runs:      daily at $At"
Write-Host "  Command:   $psExe -File `"$Runner`""
Write-Host "  Next run:  $($info.NextRunTime)"
Write-Host "  Logged on: $(if ($RunWhetherLoggedOn) { 'not required' } else { 'required' })"
Write-Host ""
Write-Host "Run it now:      Start-ScheduledTask -TaskName '$TaskName' -TaskPath '$TaskPath'"
Write-Host "Check status:    Get-ScheduledTaskInfo -TaskName '$TaskName' -TaskPath '$TaskPath'"
Write-Host "Latest result:   Get-Content '$RepoRoot\logs\nightly_last_run.json'"
Write-Host "Remove it:       .\scripts\register-nightly-task.ps1 -Unregister"
