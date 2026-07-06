@echo off
title Antigravity Chinese Patch Installer
cd /d "%~dp0"

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running with Administrator privileges.
) else (
    echo [!] Requesting Administrator privileges...
    powershell -Command "Start-Process '%~dp0%~nx0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %errorLevel% neq 0 (
    echo [!] Installer script executed with errors.
)
pause
