@echo off
title RotVault
cd /d "%~dp0"

set "APP_URL=file:///%CD:\=/%/index.html"

where msedge >nul 2>&1
if %errorlevel%==0 (
  start "" msedge --app="%APP_URL%"
  exit /b 0
)

where chrome >nul 2>&1
if %errorlevel%==0 (
  start "" chrome --app="%APP_URL%"
  exit /b 0
)

echo Could not find Microsoft Edge or Google Chrome.
echo Open index.html in your browser instead.
pause
