@echo off
title Record ALL RotVault Promo Videos
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing tools...
  call npm install
)

echo.
echo Recording SHORT, LONG, and TIKTOK versions...
echo This takes a few minutes.
echo.
call npm run record:all
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Done!
echo   RotVault-Preview.mp4       - short  16:9
echo   RotVault-Preview-Long.mp4  - long   16:9
echo   RotVault-TikTok.mp4        - vertical 9:16
echo.
echo Voiceover script: voiceover-script.md
explorer .
pause
