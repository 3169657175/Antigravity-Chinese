@echo off
title Antigravity Chinese Patch Installer

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [i] Requesting administrator privileges...
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /b
)

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %errorLevel% neq 0 (
    echo.
    echo [!] Installation failed.
)
pause
