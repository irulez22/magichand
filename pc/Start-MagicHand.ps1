# Magic Hand Play - self-updating launcher
#
# Checks the git repo, updates the local copy when possible, then starts the
# kiosk. Offline (or if anything goes wrong) it launches the local copy.
# Holds a lock while the kiosk is open so an update can never run mid-game.
#
#   powershell -ExecutionPolicy Bypass -File Start-MagicHand.ps1
#   ... -DryRun        check/update only, do not launch
#   ... -NoUpdate      launch the local copy as-is
#   ... -NoSplash      no loading window
#   ... -NoLaunch      update only, do not start the kiosk
#   ... -Windowed      normal browser window instead of kiosk

param(
    [string]$AppDir,
    [string]$Branch,
    [switch]$NoUpdate,
    [switch]$DryRun,
    [switch]$NoSplash,
    [switch]$NoLaunch,
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

# --------------------------------------------------------------------- splash
# A small, calm window while the launcher checks GitHub. It is intentionally
# indeterminate: git does not provide a reliable byte/percent signal for a
# shallow fetch, and the check is usually short.
$script:splashForm = $null
$script:splashStatus = $null
$script:splashBar = $null
$script:splashShownAt = $null

function Show-Splash {
    if ($NoSplash -or $DryRun) { return }
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $form = New-Object System.Windows.Forms.Form
        $form.Text = 'Magic Hand Play'
        $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
        $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
        $form.ClientSize = New-Object System.Drawing.Size(420, 150)
        $form.BackColor = [System.Drawing.Color]::FromArgb(18, 12, 26)
        $form.TopMost = $true
        $form.ShowInTaskbar = $false
        $form.ControlBox = $false

        $title = New-Object System.Windows.Forms.Label
        $title.Text = 'Magic Hand Play'
        $title.Font = New-Object System.Drawing.Font('Georgia', 15, [System.Drawing.FontStyle]::Bold)
        $title.ForeColor = [System.Drawing.Color]::FromArgb(232, 198, 128)
        $title.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
        $title.SetBounds(16, 18, 388, 30)
        $form.Controls.Add($title)

        $status = New-Object System.Windows.Forms.Label
        $status.Text = 'Checking for updates...'
        $status.Font = New-Object System.Drawing.Font('Segoe UI', 9)
        $status.ForeColor = [System.Drawing.Color]::FromArgb(190, 186, 200)
        $status.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
        $status.SetBounds(16, 58, 388, 22)
        $form.Controls.Add($status)

        $bar = New-Object System.Windows.Forms.ProgressBar
        $bar.Style = [System.Windows.Forms.ProgressBarStyle]::Marquee
        $bar.MarqueeAnimationSpeed = 26
        $bar.SetBounds(30, 94, 360, 12)
        $form.Controls.Add($bar)

        $form.Show()
        [System.Windows.Forms.Application]::DoEvents()
        $script:splashForm = $form
        $script:splashStatus = $status
        $script:splashBar = $bar
        $script:splashShownAt = Get-Date
    } catch {
        $script:splashForm = $null
    }
}

function Set-Splash([string]$Text) {
    if (-not $script:splashForm) { return }
    try {
        $script:splashStatus.Text = $Text
        [System.Windows.Forms.Application]::DoEvents()
    } catch { }
}

function Wait-Splash([int]$Milliseconds) {
    if (-not $script:splashForm) { Start-Sleep -Milliseconds $Milliseconds; return }
    $until = (Get-Date).AddMilliseconds($Milliseconds)
    while ((Get-Date) -lt $until) {
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 40
    }
}

function Close-Splash {
    if (-not $script:splashForm) { return }
    try {
        $script:splashForm.Close()
        $script:splashForm.Dispose()
        [System.Windows.Forms.Application]::DoEvents()
    } catch { }
    $script:splashForm = $null
    $script:splashStatus = $null
    $script:splashBar = $null
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

$git = Find-Git
$updated = $false
$hasCheckout = Test-Path -LiteralPath (Join-Path $AppDir '.git')

if (-not $NoUpdate -and -not $git) {
    Write-Log 'git not found; launching the local copy.'
} elseif (-not $NoUpdate -and -not $hasCheckout) {
    Write-Log 'No git checkout; launching the local copy.'
} elseif (-not $NoUpdate) {
    Show-Splash
    Set-Splash 'Checking for updates...'

    $updateScript = @'
param($AppDir, $Branch, $GitPath)
$env:GIT_TERMINAL_PROMPT = '0'
$env:GIT_ASKPASS = 'echo'
function Result($status, $message, $before, $remote, $updated) {
    return @{
        status = $status
        message = $message
        before = $before
        remote = $remote
        updated = $updated
    }
}
try {
    if (-not (Test-Path -LiteralPath (Join-Path $AppDir '.git'))) {
        return Result 'nogit' 'No git checkout; launching the local copy.' '' '' $false
    }
    if (-not $GitPath) {
        return Result 'nogit' 'git not found; launching the local copy.' '' '' $false
    }
    $dirty = (& $GitPath -C $AppDir status --porcelain 2>$null) -join ''
    if ($dirty.Trim().Length -gt 0) {
        return Result 'dirty' 'Local files were edited; skipping update to avoid overwriting them.' '' '' $false
    }
    $before = ((& $GitPath -C $AppDir rev-parse HEAD 2>$null) -join '').Trim()
    & $GitPath -c credential.helper= -C $AppDir fetch --depth 1 origin $Branch 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        return Result 'offline' 'Offline or fetch failed; launching the local copy.' $before '' $false
    }
    $remote = ((& $GitPath -C $AppDir rev-parse "origin/$Branch" 2>$null) -join '').Trim()
    if (-not $remote -or $remote -eq $before) {
        return Result 'uptodate' "Already up to date ($before)." $before $remote $false
    }
    & $GitPath -C $AppDir reset --hard $remote 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        return Result 'resetfail' "git reset failed; keeping $before." $before $remote $false
    }
    if (-not ((Test-Path -LiteralPath (Join-Path $AppDir 'index.html')) -and (Test-Path -LiteralPath (Join-Path $AppDir 'js\app.js')))) {
        & $GitPath -C $AppDir reset --hard $before 2>&1 | Out-Null
        return Result 'rollback' "New commit $remote failed the file check; rolled back to $before." $before $remote $false
    }
    return Result 'updated' "Updated $before -> $remote" $before $remote $true
} catch {
    return Result 'error' ("Update error: " + $_.Exception.Message + "; launching the local copy.") '' '' $false
}
'@

    $ps = $null
    try {
        $ps = [powershell]::Create()
        $cmd = $ps.AddScript($updateScript)
        $null = $cmd.AddParameter('AppDir', $AppDir)
        $null = $cmd.AddParameter('Branch', $Branch)
        $null = $cmd.AddParameter('GitPath', $git)
        $handle = $ps.BeginInvoke()
        while (-not $handle.IsCompleted) {
            if ($script:splashForm) { [System.Windows.Forms.Application]::DoEvents() }
            Start-Sleep -Milliseconds 70
        }
        $result = $ps.EndInvoke($handle) | Select-Object -Last 1
        if ($result) {
            $updated = [bool]$result.updated
            Write-Log ([string]$result.message)
        } else {
            Write-Log 'Update returned no result; launching the local copy.'
        }
        if ($updated) { Set-Splash 'New version ready - starting...' }
        else { Set-Splash 'Starting Magic Hand Play...' }
        Wait-Splash 500
    } catch {
        Write-Log "Update error: $($_.Exception.Message); launching the local copy."
    } finally {
        if ($ps) { $ps.Dispose() }
    }

    # Refresh the installed launcher for the NEXT start; the running script
    # cannot replace itself mid-run, but it can stage the newer copy.
    if ($updated) {
        try {
            $installedLauncher = Join-Path $env:LOCALAPPDATA 'MagicHand\launcher'
            if ($PSScriptRoot -ieq $installedLauncher) {
                $repoLauncher = Join-Path $AppDir 'pc\Start-MagicHand.ps1'
                $selfLauncher = Join-Path $PSScriptRoot 'Start-MagicHand.ps1'
                if ((Test-Path -LiteralPath $repoLauncher) -and (Test-Path -LiteralPath $selfLauncher)) {
                    $repoHash = (Get-FileHash -LiteralPath $repoLauncher -Algorithm SHA256).Hash
                    $selfHash = (Get-FileHash -LiteralPath $selfLauncher -Algorithm SHA256).Hash
                    if ($repoHash -ne $selfHash) {
                        Copy-Item -LiteralPath $repoLauncher -Destination $selfLauncher -Force
                        $repoCmd = Join-Path $AppDir 'pc\Start-MagicHand.cmd'
                        if (Test-Path -LiteralPath $repoCmd) {
                            Copy-Item -LiteralPath $repoCmd -Destination (Join-Path $PSScriptRoot 'Start-MagicHand.cmd') -Force
                        }
                        Write-Log 'Launcher refreshed for the next start.'
                    }
                }
            }
        } catch {
            Write-Log "Launcher refresh failed: $($_.Exception.Message)"
        }
    }
}

# ---------------------------------------------------------------------- launch
$indexPath = Join-Path $AppDir 'index.html'
if (-not (Test-Path -LiteralPath $indexPath)) {
    Close-Splash
    Show-Error "Magic Hand Play is not installed at $AppDir.`n`nRun pc\Setup-TouchscreenPc.ps1 on this PC."
    exit 1
}

$url = 'file:///' + ($indexPath -replace '\\', '/')
Close-Splash

if ($DryRun) {
    Write-Log "Dry run complete (updated=$updated). Would launch $url"
    exit 0
}

if ($NoLaunch) {
    Write-Log "NoLaunch complete (updated=$updated)."
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
