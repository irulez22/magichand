# Magic Hand Play - touchscreen PC setup
#
# One-time setup. Clones the public repo over HTTPS (no key needed), installs
# the self-updating launcher and creates a desktop shortcut.
#
#   powershell -ExecutionPolicy Bypass -File Setup-TouchscreenPc.ps1
#
# Options:
#   -InstallDir C:\MagicHand     where the app is installed
#   -Repo <git url>              override the remote (HTTPS by default)
#   -Branch main                 branch to follow
#   -SshKey                      use a deploy key and an SSH remote (private repo)
#   -NonInteractive              do not pause for the key
#   -CreateTask                  also start the launcher at logon
#   -Launch                      start it now
#   -DryRun                      check prerequisites only, change nothing

param(
    [string]$InstallDir = 'C:\MagicHand',
    [string]$Repo = 'https://github.com/irulez22/magichand.git',
    [string]$Branch = 'main',
    [switch]$SshKey,
    [string]$KeyPath = "$env:USERPROFILE\.ssh\magichand_deploy",
    [switch]$NonInteractive,
    [switch]$CreateTask,
    [switch]$Launch,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Say([string]$Message) { Write-Host "[magichand] $Message" }
function Fail([string]$Message) { Write-Host "[magichand] ERROR: $Message" -ForegroundColor Red; exit 1 }

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

# ---------------------------------------------------------------- prerequisites
if ($DryRun) { Say 'DRY RUN - nothing will be changed.' }

$git = Find-Git
if (-not $git) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget -and -not $DryRun) {
        Say 'Git not found. Installing Git for Windows with winget...'
        & $winget.Source install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements
        $git = Find-Git
    }
}
if (-not $git) {
    Fail 'Git for Windows is required. Install it from https://git-scm.com/download/win and run this script again.'
}
Say "Git: $git"

$edge = Find-Edge
if ($edge) { Say "Edge: $edge" } else { Say 'Edge not found; the default browser will be used (no kiosk mode).' }

# ------------------------------------------------------------------ deploy key
# Only for a private repo. The default public HTTPS path needs no key, and
# works even when the network blocks SSH port 22.
$sshCommand = $null
if ($SshKey) {
    $gitRoot = Split-Path (Split-Path $git -Parent) -Parent
    $sshKeygen = Join-Path $gitRoot 'usr\bin\ssh-keygen.exe'
    if (-not (Test-Path -LiteralPath $sshKeygen)) { $sshKeygen = 'ssh-keygen.exe' }

    $keyDir = Split-Path -Parent $KeyPath
    if (-not (Test-Path -LiteralPath $keyDir) -and -not $DryRun) {
        New-Item -ItemType Directory -Force -Path $keyDir | Out-Null
    }

    if (-not (Test-Path -LiteralPath $KeyPath)) {
        if ($DryRun) {
            Say "Would create SSH key: $KeyPath"
        } else {
            Say "Creating read-only SSH key: $KeyPath"
            & $sshKeygen -t ed25519 -f $KeyPath -N '""' -C 'magichand touchscreen pc' | Out-Null
            if ($LASTEXITCODE -ne 0) { Fail 'ssh-keygen failed.' }
        }
    } else {
        Say "Using existing key: $KeyPath"
    }

    $hasPublicKey = Test-Path -LiteralPath "$KeyPath.pub"
    if ($hasPublicKey) {
        $publicKey = (Get-Content -LiteralPath "$KeyPath.pub" -Raw).Trim()
        $webRepo = $Repo -replace '^git@github\.com:', 'https://github.com/' -replace '\.git$', ''
        Write-Host ''
        Write-Host 'Add this key as a READ-ONLY Deploy key:' -ForegroundColor Cyan
        Write-Host "  $webRepo/settings/keys" -ForegroundColor Cyan
        Write-Host ''
        Write-Host $publicKey -ForegroundColor Yellow
        Write-Host ''
    } elseif ($DryRun) {
        Say "Would print the new public key from $KeyPath.pub"
    } else {
        Fail "Public key not found at $KeyPath.pub"
    }

    if ($hasPublicKey -and -not $NonInteractive -and -not $DryRun) {
        Read-Host 'Press Enter once the deploy key is added (or Ctrl+C to stop)' | Out-Null
    }

    # ssh receives the path through a POSIX shell, so forward slashes are required
    $keyForSsh = $KeyPath -replace '\\', '/'
    $sshCommand = "ssh -i `"$keyForSsh`" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8"
} else {
    Say "Using HTTPS (no key): $Repo"
}

# ------------------------------------------------------------- repo reachable
$env:GIT_TERMINAL_PROMPT = '0'
$probe = & $git ls-remote --heads $Repo $Branch 2>&1
if ($LASTEXITCODE -ne 0) {
    if ($SshKey) {
        Fail "Cannot reach $Repo over SSH. This network may block port 22; use the HTTPS URL instead (public repo), or a network that allows SSH."
    }
    Fail "Cannot reach $Repo. Check the internet connection or proxy, and that the repo is public."
}
Say 'Repo is reachable.'

# ------------------------------------------------------- clone / adopt / update
$gitDirPresent = Test-Path -LiteralPath (Join-Path $InstallDir '.git')
$appPresent = Test-Path -LiteralPath (Join-Path $InstallDir 'index.html')

if (-not $gitDirPresent -and -not $appPresent -and (Test-Path -LiteralPath $InstallDir)) {
    $children = @(Get-ChildItem -LiteralPath $InstallDir -Force -ErrorAction SilentlyContinue)
    if ($children.Count -gt 0) {
        Fail "$InstallDir exists but does not contain the app. Move or delete it, then run setup again."
    }
}

if ($gitDirPresent) {
    Say "Repo already present at $InstallDir; updating."
} elseif ($appPresent) {
    if ($DryRun) {
        Say "Would adopt the existing app folder at $InstallDir as a git checkout"
    } else {
        Say "Adopting the existing app folder at $InstallDir as a git checkout."
        & $git -C $InstallDir init -b $Branch | Out-Null
        & $git -C $InstallDir remote remove origin 2>$null | Out-Null
        & $git -C $InstallDir remote add origin $Repo
        if ($LASTEXITCODE -ne 0) { Fail "Could not add the remote to $InstallDir." }
    }
} else {
    if ($DryRun) {
        Say "Would clone $Repo ($Branch) into $InstallDir"
    } else {
        Say "Cloning $Repo into $InstallDir"
        $parent = Split-Path -Parent $InstallDir
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
        if ($SshKey) {
            & $git -c "core.sshCommand=$sshCommand" clone --branch $Branch $Repo $InstallDir
        } else {
            & $git clone --branch $Branch $Repo $InstallDir
        }
        if ($LASTEXITCODE -ne 0) { Fail 'Clone failed. Check the network and that the repo is public (or use -SshKey for a private repo).' }
    }
}

if (-not $DryRun) {
    & $git -C $InstallDir config core.autocrlf false
    & $git -C $InstallDir config pull.ff only
    & $git -C $InstallDir config core.pager cat
    if ($SshKey) { & $git -C $InstallDir config core.sshCommand $sshCommand }

    & $git -C $InstallDir fetch --depth 1 origin $Branch
    if ($LASTEXITCODE -eq 0) {
        & $git -C $InstallDir reset --hard "origin/$Branch" | Out-Null
    } else {
        Say 'Could not fetch the latest commit; keeping the local copy.'
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $InstallDir 'index.html')) -and -not $DryRun) {
    Fail "index.html is missing in $InstallDir."
}

$installed = ''
if (-not $DryRun) {
    $installed = ((& $git -C $InstallDir rev-parse --short HEAD 2>$null) -join '').Trim()
    if ($installed) { Say "Installed commit: $installed" }
}

# ------------------------------------------------------------------- launcher
$launcherDir = Join-Path $env:LOCALAPPDATA 'MagicHand\launcher'
if ($DryRun) {
    Say "Would install the launcher into $launcherDir"
} else {
    New-Item -ItemType Directory -Force -Path $launcherDir | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Start-MagicHand.ps1') -Destination $launcherDir -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Start-MagicHand.cmd') -Destination $launcherDir -Force

    $config = [ordered]@{ appDir = $InstallDir; branch = $Branch }
    $config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $launcherDir 'launcher.json') -Encoding UTF8
    Say "Launcher installed: $launcherDir"
}

# ------------------------------------------------------------------- shortcut
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Magic Hand Play.lnk'
if ($DryRun) {
    Say "Would create shortcut: $shortcutPath"
} else {
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
        $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherDir\Start-MagicHand.ps1`""
        $shortcut.WorkingDirectory = $launcherDir
        $shortcut.Description = 'Magic Hand Play (full screen)'
        $shortcut.Save()
        Say "Desktop shortcut: $shortcutPath"
    } catch {
        Say "Could not create the desktop shortcut: $($_.Exception.Message)"
    }
}

# --------------------------------------------------------------- logon task
if ($CreateTask) {
    if ($DryRun) {
        Say 'Would register a logon scheduled task.'
    } else {
        try {
            $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
                -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherDir\Start-MagicHand.ps1`""
            $trigger = New-ScheduledTaskTrigger -AtLogOn
            $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
            Register-ScheduledTask -TaskName 'MagicHandPlay' -Action $action -Trigger $trigger -Principal $principal `
                -Description 'Start Magic Hand Play at logon' -Force | Out-Null
            Say 'Scheduled task registered: MagicHandPlay'
        } catch {
            Say "Could not register the scheduled task: $($_.Exception.Message)"
        }
    }
}

Say 'Setup complete.'

if ($Launch -and -not $DryRun) {
    Start-Process -FilePath (Join-Path $launcherDir 'Start-MagicHand.cmd')
}
