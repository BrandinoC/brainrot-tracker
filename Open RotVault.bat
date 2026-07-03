@echo off
title RotVault
cd /d "%~dp0"

if not exist "node_modules\electron\cli.js" (
  echo Installing RotVault desktop dependencies...
  echo This only happens once and needs internet.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo Could not install. Make sure Node.js is installed from https://nodejs.org
    pause
    exit /b 1
  )
)

call npm start
