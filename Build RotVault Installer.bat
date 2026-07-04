@echo off
title Build RotVault Installer
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to build the installer.
  echo Download it from https://nodejs.org then run this file again.
  echo.
  echo For now, use "Open RotVault (Simple).bat" to run the app without building.
  pause
  exit /b 1
)

echo Installing dependencies...
call npm install
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Building RotVault installer (includes calculator and latest app files)...
call npm run build
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Done! Your installer is in the dist folder.
explorer dist
pause
