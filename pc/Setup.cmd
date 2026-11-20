@echo off
rem Double-click to set up this PC. Keeps the window open so errors stay visible.
setlocal
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-TouchscreenPc.ps1" %*
echo.
pause
endlocal
