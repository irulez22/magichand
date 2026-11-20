# Magic Hand Play - self-updating launcher
#
# Checks the git repo, updates the local copy when possible, then starts the
# kiosk. Offline (or if anything goes wrong) it launches the local copy.
# Holds a lock while the kiosk is open so an update can never run mid-game.
#
#   powershell -ExecutionPolicy Bypass -File Start-MagicHand.ps1
#   ... -DryRun        check/update only, do not launch
#   ... -NoUpdate      launch the local copy as-is
#   ... -Windowed      normal browser window instead of kiosk

param(
    [string]$AppDir,
    [string]$Branch,
    [switch]$NoUpdate,
    [switch]$DryRun,
    [switch]$Windowed
)

$ErrorActionPreference = 'Continue'

# ------------------------------------------------------------------- config
$launcherDir = $PSScriptRoot
$configPath = Join-Path $launcherDir 'launcher.json'
if (Test-Path -LiteralPath $configPath) {
    try {
        $cfg = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        if (-not $AppDir -and $cfg.appDir) { $AppDir = [string]$cfg.appDir }
        if (-not $Branch -and $cfg.branch) { $Branch = [string]$cfg.branch }
    } catch { }
}
if (-not $AppDir) { $AppDir = 'C:\MagicHand' }
if (-not $Branch) { $Branch = 'main' }

# --------------------------------------------------------------------- logging
$stateDir = Join-Path $env:LOCALAPPDATA 'MagicHand'
$logDir = Join-Path $stateDir 'logs'
try { New-Item -ItemType Directory -Force -Path $logDir | Out-Null } catch { }
$logPath = Join-Path $logDir 'launcher.log'

function Write-Log([string]$Message) {
    $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $Message
    try { Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8 } catch { }
    if ($DryRun) { Write-Host $line }
}

try {
    if ((Test-Path -LiteralPath $logPath) -and ((Get-Item -LiteralPath $logPath).Length -gt 200KB)) {
        Remove-Item -LiteralPath $logPath -Force
    }
} catch { }

function Show-Error([string]$Message) {
    Write-Log "ERROR: $Message"
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($Message, 'Magic Hand Play', 'OK', 'Error') | Out-Null
    } catch { }
}

# ------------------------------------------------------------------------ lock
# Held for the lifetime of this script, so a second launch cannot update while
# the kiosk is running.
$lockStream = $null
try {
    $lockPath = Join-Path $stateDir 'launcher.lock'
    $lockStream = [System.IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None')
} catch {
    Write-Log 'Another launcher instance is running; exiting.'
    exit 0
}

Write-Log "Launcher start (appDir=$AppDir, branch=$Branch, noUpdate=$NoUpdate, dryRun=$DryRun)"

# ------------------------------------------------------------------- git update
function Find-Git {
    $cmd = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "$env:ProgramFiles\Git\cmd\git.exe",
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function Test-AppPayload {
    return (Test-Path -LiteralPath (Join-Path $AppDir 'index.html')) -and
           (Test-Path -LiteralPath (Join-Path $AppDir 'js\app.js'))
}

$git = Find-Git
$updated = $false

if (-not $NoUpdate -and -not (Test-Path -LiteralPath (Join-Path $AppDir '.git'))) {
    Write-Log 'No git checkout; launching the local copy.'
} elseif (-not $NoUpdate -and $git) {
    $env:GIT_TERMINAL_PROMPT = '0'
    $env:GIT_ASKPASS = 'echo'

    try {
        $dirty = (& $git -C $AppDir status --porcelain 2>$null) -join ''
        if ($dirty.Trim().Length -gt 0) {
            Write-Log 'Local files were edited; skipping update to avoid overwriting them.'
        } else {
            $before = ((& $git -C $AppDir rev-parse HEAD 2>$null) -join '').Trim()
            & $git -C $AppDir fetch --depth 1 origin $Branch 2>&1 | Out-Null
            $fetchCode = $LASTEXITCODE

            if ($fetchCode -ne 0) {
                Write-Log 'Offline or fetch failed; launching the local copy.'
            } else {
                $remote = ((& $git -C $AppDir rev-parse "origin/$Branch" 2>$null) -join '').Trim()
                if ($remote -and $remote -ne $before) {
                    & $git -C $AppDir reset --hard $remote 2>&1 | Out-Null
                    if ($LASTEXITCODE -eq 0) {
                        if (Test-AppPayload) {
                            $updated = $true
                            Write-Log "Updated $before -> $remote"
                        } else {
                            & $git -C $AppDir reset --hard $before 2>&1 | Out-Null
                            Write-Log "New commit $remote failed the file check; rolled back to $before."
                        }
                    } else {
                        Write-Log "git reset failed; keeping $before."
                    }
                } else {
                    Write-Log "Already up to date ($before)."
                }
            }
        }
    } catch {
        Write-Log "Update error: $($_.Exception.Message); launching the local copy."
    }
} elseif (-not $NoUpdate) {
    Write-Log 'git not found; launching the local copy.'
}

# ---------------------------------------------------------------------- launch
$indexPath = Join-Path $AppDir 'index.html'
if (-not (Test-Path -LiteralPath $indexPath)) {
    Show-Error "Magic Hand Play is not installed at $AppDir.`n`nRun pc\Setup-TouchscreenPc.ps1 on this PC."
    exit 1
}

$url = 'file:///' + ($indexPath -replace '\\', '/')

if ($DryRun) {
    Write-Log "Dry run complete (updated=$updated). Would launch $url"
    exit 0
}

function Find-Edge {
    $candidates = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

$edge = Find-Edge
if ($Windowed -or -not $edge) {
    Write-Log 'Opening in the default browser.'
    Start-Process -FilePath $url
    exit 0
}

$profileDir = Join-Path $stateDir 'kiosk-profile'
try { New-Item -ItemType Directory -Force -Path $profileDir | Out-Null } catch { }

$arguments = @(
    '--kiosk', $url,
    '--edge-kiosk-type=fullscreen',
    "--user-data-dir=$profileDir",
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-pinch',
    '--overscroll-history-navigation=0',
    '--autoplay-policy=no-user-gesture-required'
)

Write-Log 'Starting kiosk.'
try {
    $proc = Start-Process -FilePath $edge -ArgumentList $arguments -PassThru
    if ($proc) { $proc.WaitForExit() }
    Write-Log 'Kiosk exited.'
} catch {
    Show-Error "Could not start Microsoft Edge: $($_.Exception.Message)"
    exit 1
}

if ($lockStream) { $lockStream.Dispose() }
exit 0
