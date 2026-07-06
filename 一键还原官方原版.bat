@echo off
title Antigravity Chinese Patch Restorer
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

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restore.ps1"
if %errorLevel% neq 0 (
    echo [!] Restorer script executed with errors.
)
pause
