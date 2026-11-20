@echo off
rem Magic Hand Play - full-screen kiosk launcher for Windows.
rem Alt+F4 closes the kiosk and returns to the desktop.
setlocal
set "HTML=%~dp0index.html"
if not exist "%HTML%" (
  echo Could not find index.html next to this launcher.
  pause
  exit /b 1
)
set "URL=file:///%HTML:\=/%"
set "PROFILE=%LOCALAPPDATA%\MagicHand\kiosk-profile"
if not exist "%PROFILE%" mkdir "%PROFILE%" >nul 2>&1

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --kiosk "%URL%" --edge-kiosk-type=fullscreen ^
    --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check ^
    --disable-pinch --overscroll-history-navigation=0 ^
    --autoplay-policy=no-user-gesture-required
) else (
  echo Microsoft Edge was not found. Opening in the default browser instead.
  start "" "%URL%"
)
endlocal
