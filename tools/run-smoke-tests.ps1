# Magic Hand Play - optional headless smoke test (development only).
# Requires Microsoft Edge and Node.js 22+ (built-in fetch + WebSocket).
# Usage: powershell -ExecutionPolicy Bypass -File tools\run-smoke-tests.ps1
param(
    [int]$Port = 9223
)

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$index = Join-Path $project 'index.html'
if (-not (Test-Path -LiteralPath $index)) { throw "index.html not found at $index" }

$edge = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge was not found.' }

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js was not found on PATH.' }

$url = 'file:///' + ($index -replace '\\', '/')
$profile = Join-Path $env:TEMP "magichand-smoke-profile-$Port"

# Headless Edge spawns children; the parent PID can exit before they do, which
# used to leave the profile locked. Stop anything still using this profile.
function Stop-SmokeEdge {
    param([string]$ProfilePath)
    Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($ProfilePath) } |
        ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { } }
    Start-Sleep -Milliseconds 400
}

Stop-SmokeEdge $profile
if (Test-Path -LiteralPath $profile) {
    try { Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction Stop }
    catch { Write-Warning "Could not clear the previous test profile: $($_.Exception.Message)" }
}

Write-Host "Starting headless Edge on port $Port ..."
$proc = Start-Process -FilePath $edge -PassThru -ArgumentList @(
    '--headless=new',
    '--disable-gpu',
    '--mute-audio',
    "--remote-debugging-port=$Port",
    '--window-size=1440,900',
    '--autoplay-policy=no-user-gesture-required',
    "--user-data-dir=$profile",
    $url
)

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 300
    try {
        $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 2
        if ($targets | Where-Object { $_.url -like '*index.html*' }) { $ready = $true; break }
    } catch { }
}
if (-not $ready) {
    try { & taskkill /PID $proc.Id /T /F 2>$null | Out-Null } catch { }
    throw 'The test page did not start. Is another Edge instance already using that debugging port?'
}

$env:MG_CDP_PORT = "$Port"
$failures = 0
try {
    foreach ($script in @('smoke-1.mjs', 'smoke-2.mjs')) {
        Write-Host "`n=== $script ==="
        & $node.Source (Join-Path $PSScriptRoot $script)
        if ($LASTEXITCODE -ne 0) { $failures += 1 }
    }
} finally {
    try { & taskkill /PID $proc.Id /T /F 2>$null | Out-Null } catch { }
    Stop-SmokeEdge $profile
    Remove-Item Env:\MG_CDP_PORT -ErrorAction SilentlyContinue
}

if ($failures -eq 0) {
    Write-Host "`nAll smoke tests passed. Screenshots: $env:TEMP\magichand-smoke"
    exit 0
} else {
    Write-Host "`n$failures smoke test script(s) reported failures."
    exit 1
}
