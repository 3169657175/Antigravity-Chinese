@echo off
title Antigravity Chinese Patch Installer
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %errorLevel% neq 0 (
    echo.
    echo [!] Installation failed.
)
pause
