@echo off
title Record RotVault Promo Video
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing promo video tools...
  call npm install
)

echo Recording promo video...
call npm run record
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Done! Video: RotVault-Preview.mp4
explorer .
pause
