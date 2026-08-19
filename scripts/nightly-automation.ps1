<#
.SYNOPSIS
  Nightly Predictive Play pipeline: refresh odds, then generate tomorrow's props, team picks and insights.

.DESCRIPTION
  Runs the full nightly sequence in order:
    1. npm run odds:v2          (apps/backend)
    2. props_intelligent_v3.py  (repo root)
    3. teams_enhanced.py        (repo root)
    4. enhanced_insights.py     (repo root)

  The Python steps require the local StatMuse API server on port 5001, so this script
  starts it if it isn't already healthy and shuts it back down afterwards.

.EXAMPLE
  .\scripts\nightly-automation.ps1
  .\scripts\nightly-automation.ps1 -DryRun
  .\scripts\nightly-automation.ps1 -SkipOdds -Date 2026-08-15
#>
[CmdletBinding()]
param(
  # Generate for a specific date (YYYY-MM-DD) instead of tomorrow.
  [string]$Date,

  # Skip the odds refresh and go straight to the AI generation steps.
  [switch]$SkipOdds,

  # Print the plan and validate prerequisites without running anything.
  [switch]$DryRun,

  # Leave the StatMuse server running after the pipeline finishes.
  [switch]$KeepStatmuseRunning,

  # Explicit python.exe to use. Auto-detected when omitted.
  [string]$PythonPath,

  [int]$StatmusePort = 5001,
  [int]$OddsRetries = 1,
  [int]$LogRetentionDays = 30
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ScriptDir  = $PSScriptRoot
$RepoRoot   = Split-Path $ScriptDir -Parent
$BackendDir = Join-Path $RepoRoot 'apps\backend'
$LogDir     = Join-Path $RepoRoot 'logs'
$StatmuseUrl = "http://127.0.0.1:$StatmusePort"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$RunStamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$LogFile  = Join-Path $LogDir "nightly_$RunStamp.log"

# The Python scripts log heavy emoji output; without UTF-8 they crash when stdout is a file.
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

# ---------------------------------------------------------------- logging ---

function Write-Log {
  param(
    [string]$Message,
    [ValidateSet('INFO', 'WARN', 'ERROR', 'STEP')]
    [string]$Level = 'INFO'
  )
  $line = "[{0}][{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  switch ($Level) {
    'ERROR' { Write-Host $line -ForegroundColor Red }
    'WARN'  { Write-Host $line -ForegroundColor Yellow }
    'STEP'  { Write-Host $line -ForegroundColor Cyan }
    default { Write-Host $line }
  }
}

function Write-RawLog {
  param([string]$Text)
  Add-Content -Path $LogFile -Value $Text -Encoding UTF8
  Write-Host $Text
}

# ------------------------------------------------------------ tool lookup ---

function Resolve-PythonExe {
  if ($PythonPath) {
    if (Test-Path $PythonPath) { return (Resolve-Path $PythonPath).Path }
    throw "PythonPath not found: $PythonPath"
  }
  # Prefer the real interpreter over a pyenv/Store shim so Task Scheduler behaves.
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) {
    try {
      $real = & $cmd.Source -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $real -and (Test-Path $real.Trim())) { return $real.Trim() }
    } catch { }
    if ($cmd.Source -like '*.exe') { return $cmd.Source }
  }
  foreach ($candidate in @(
      "$env:USERPROFILE\.pyenv\pyenv-win\versions\3.12.0\python.exe",
      "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
    )) {
    if (Test-Path $candidate) { return $candidate }
  }
  throw "Could not locate python.exe. Pass -PythonPath explicitly."
}

function Resolve-NpmCmd {
  foreach ($name in @('npm.cmd', 'npm')) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -like '*.cmd') { return $cmd.Source }
  }
  foreach ($candidate in @(
      "$env:APPDATA\npm\npm.cmd",
      "C:\nvm4w\nodejs\npm.cmd",
      "$env:ProgramFiles\nodejs\npm.cmd"
    )) {
    if (Test-Path $candidate) { return $candidate }
  }
  throw "Could not locate npm.cmd."
}

function Add-NodeToPath {
  if (Get-Command node -ErrorAction SilentlyContinue) { return }
  foreach ($dir in @('C:\nvm4w\nodejs', "$env:ProgramFiles\nodejs")) {
    if (Test-Path (Join-Path $dir 'node.exe')) {
      $env:PATH = "$dir;$env:PATH"
      Write-Log "Added $dir to PATH for this run."
      return
    }
  }
  Write-Log "node.exe not found on PATH; the odds step may fail." 'WARN'
}

# ------------------------------------------------------- statmuse server ----

function Test-StatmuseHealthy {
  try {
    $r = Invoke-RestMethod -Uri "$StatmuseUrl/health" -TimeoutSec 5 -ErrorAction Stop
    return ($r.status -eq 'healthy')
  } catch {
    return $false
  }
}

function Start-StatmuseServer {
  $outLog = Join-Path $LogDir "statmuse_$RunStamp.log"
  $errLog = Join-Path $LogDir "statmuse_$RunStamp.err.log"
  Write-Log "Starting StatMuse API server (logs: $outLog)"
  $proc = Start-Process -FilePath $script:PythonExe `
    -ArgumentList 'statmuse_api_server.py' `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog

  for ($i = 1; $i -le 40; $i++) {
    Start-Sleep -Seconds 3
    if ($proc.HasExited) { throw "StatMuse server exited immediately (code $($proc.ExitCode)). See $errLog" }
    if (Test-StatmuseHealthy) {
      Write-Log "StatMuse server healthy after $($i * 3)s (pid $($proc.Id))."
      return $proc
    }
  }
  try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch { }
  throw "StatMuse server did not become healthy within 120s. See $errLog"
}

function Stop-StatmuseServer {
  param($Process)
  if (-not $Process) { return }
  Write-Log "Stopping StatMuse API server (pid $($Process.Id))."
  try { Stop-Process -Id $Process.Id -Force -ErrorAction Stop } catch {
    Write-Log "Could not stop StatMuse server: $($_.Exception.Message)" 'WARN'
  }
}

# -------------------------------------------------------------- step run ----

$script:Results = @()

function Invoke-Step {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Command,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory)][string]$WorkingDirectory,
    [switch]$Critical,
    [int]$Retries = 0
  )

  $display = "$Command $($Arguments -join ' ')"
  Write-Log "===== $Name =====" 'STEP'
  Write-Log "Command: $display" 'STEP'
  Write-Log "Cwd: $WorkingDirectory" 'STEP'

  if ($DryRun) {
    Write-Log "[DryRun] skipped." 'WARN'
    $script:Results += [pscustomobject]@{ Step = $Name; Status = 'SKIPPED (dry run)'; Duration = '-' }
    return $true
  }

  $started = Get-Date
  $attempt = 0
  $exitCode = -1

  while ($attempt -le $Retries) {
    $attempt++
    if ($attempt -gt 1) { Write-Log "Retry $($attempt - 1)/$Retries for $Name" 'WARN' }

    Push-Location $WorkingDirectory
    # Python logging writes to stderr; with EAP=Stop those lines would surface as
    # terminating NativeCommandErrors and kill the step on its first log message.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      & $Command @Arguments 2>&1 | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) { $line = $_.ToString() }
        else { $line = [string]$_ }
        Write-RawLog $line
      }
      $exitCode = $LASTEXITCODE
    } catch {
      Write-Log "Exception running $Name : $($_.Exception.Message)" 'ERROR'
      $exitCode = 1
    } finally {
      $ErrorActionPreference = $prevEap
      Pop-Location
    }

    if ($exitCode -eq 0) { break }
  }

  $elapsed = '{0:hh\:mm\:ss}' -f ((Get-Date) - $started)

  if ($exitCode -eq 0) {
    Write-Log "$Name completed in $elapsed."
    $script:Results += [pscustomobject]@{ Step = $Name; Status = 'OK'; Duration = $elapsed }
    return $true
  }

  Write-Log "$Name FAILED with exit code $exitCode after $elapsed." 'ERROR'
  $script:Results += [pscustomobject]@{ Step = $Name; Status = "FAILED (exit $exitCode)"; Duration = $elapsed }
  if ($Critical) { throw "Critical step '$Name' failed. Aborting run." }
  return $false
}

# ------------------------------------------------------------------ main ----

$RunStart = Get-Date
$StatmuseProc = $null
$Aborted = $false

# --tomorrow at 10 PM targets the next slate; --date overrides it.
if ($Date) { $DateArgs = @('--date', $Date) } else { $DateArgs = @('--tomorrow') }

try {
  Write-Log "Predictive Play nightly automation starting"
  Write-Log "Repo root: $RepoRoot"
  Write-Log "Log file: $LogFile"
  Write-Log "Target: $($DateArgs -join ' ')"

  $script:PythonExe = Resolve-PythonExe
  Write-Log "Python: $script:PythonExe"
  Add-NodeToPath
  $NpmCmd = Resolve-NpmCmd
  Write-Log "npm: $NpmCmd"

  foreach ($f in @((Join-Path $RepoRoot '.env'), (Join-Path $BackendDir '.env'))) {
    if (-not (Test-Path $f)) { Write-Log "Missing env file: $f" 'WARN' }
  }

  # 1) Odds refresh must finish before any picks are generated.
  if ($SkipOdds) {
    Write-Log "Skipping odds refresh (-SkipOdds)." 'WARN'
    $script:Results += [pscustomobject]@{ Step = 'odds:v2'; Status = 'SKIPPED'; Duration = '-' }
  } else {
    Invoke-Step -Name 'odds:v2' -Command $NpmCmd -Arguments @('run', 'odds:v2') `
      -WorkingDirectory $BackendDir -Critical -Retries $OddsRetries | Out-Null
  }

  # 2) The AI scripts all query the local StatMuse service.
  if (Test-StatmuseHealthy) {
    Write-Log "StatMuse server already running; leaving it alone."
  } elseif ($DryRun) {
    Write-Log "[DryRun] would start StatMuse server." 'WARN'
  } else {
    $StatmuseProc = Start-StatmuseServer
  }

  # 3) Generation steps run from the repo root because they call load_dotenv('.env').
  #    A failure here is logged but does not block the remaining scripts.
  Invoke-Step -Name 'props_intelligent_v3' -Command $script:PythonExe `
    -Arguments (@('props_intelligent_v3.py') + $DateArgs) -WorkingDirectory $RepoRoot | Out-Null

  Invoke-Step -Name 'teams_enhanced' -Command $script:PythonExe `
    -Arguments (@('teams_enhanced.py') + $DateArgs) -WorkingDirectory $RepoRoot | Out-Null

  Invoke-Step -Name 'enhanced_insights' -Command $script:PythonExe `
    -Arguments (@('enhanced_insights.py') + $DateArgs) -WorkingDirectory $RepoRoot | Out-Null

} catch {
  $Aborted = $true
  Write-Log $_.Exception.Message 'ERROR'
} finally {
  if ($StatmuseProc -and -not $KeepStatmuseRunning) { Stop-StatmuseServer -Process $StatmuseProc }
  elseif ($StatmuseProc) { Write-Log "Leaving StatMuse server running (pid $($StatmuseProc.Id))." }

  $totalElapsed = '{0:hh\:mm\:ss}' -f ((Get-Date) - $RunStart)
  Write-Log "===== SUMMARY (total $totalElapsed) =====" 'STEP'
  foreach ($r in $script:Results) {
    $level = 'INFO'
    if ($r.Status -like 'FAILED*') { $level = 'ERROR' }
    elseif ($r.Status -like 'SKIPPED*') { $level = 'WARN' }
    Write-Log ("{0,-22} {1,-22} {2}" -f $r.Step, $r.Status, $r.Duration) $level
  }

  $failed = @($script:Results | Where-Object { $_.Status -like 'FAILED*' })
  $status = 'SUCCESS'
  if ($Aborted) { $status = 'ABORTED' } elseif ($failed.Count -gt 0) { $status = 'PARTIAL' }

  [pscustomobject]@{
    status    = $status
    startedAt = $RunStart.ToString('s')
    endedAt   = (Get-Date).ToString('s')
    duration  = $totalElapsed
    target    = ($DateArgs -join ' ')
    logFile   = $LogFile
    steps     = $script:Results
  } | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $LogDir 'nightly_last_run.json') -Encoding UTF8

  Get-ChildItem -Path $LogDir -Filter 'nightly_*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$LogRetentionDays) } |
    Remove-Item -Force -ErrorAction SilentlyContinue
  Get-ChildItem -Path $LogDir -Filter 'statmuse_*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$LogRetentionDays) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

  Write-Log "Nightly automation finished: $status"
}

if ($status -eq 'SUCCESS') { exit 0 } else { exit 1 }
