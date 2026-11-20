@echo off
rem Magic Hand Play - normal window launcher (handy while testing with a mouse).
setlocal
set "HTML=%~dp0index.html"
if not exist "%HTML%" (
  echo Could not find index.html next to this launcher.
  pause
  exit /b 1
)
set "URL=file:///%HTML:\=/%"
start "" "%URL%"
endlocal
