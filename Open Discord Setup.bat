@echo off
title RotVault Discord Setup
cd /d "%~dp0"

echo.
echo  RotVault Discord Setup
echo  ======================
echo  Opening the guide, Discord, and copy-paste files...
echo.

start "" "%~dp0discord\setup-guide.html"
start "" "https://discord.com/channels/@me"
explorer "%~dp0discord"

echo Done! Follow the guide in your browser.
echo.
pause
