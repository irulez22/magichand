@echo off
rem Double-click entry point. Runs the self-updating launcher without a console.
setlocal
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"
start "" "%PS%" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Start-MagicHand.ps1" %*
endlocal
