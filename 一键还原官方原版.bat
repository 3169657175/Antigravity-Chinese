@echo off
CHCP 65001 > nul
echo ==========================================================
echo         Antigravity 2.0 Chinese Patch Restorer (v2)
echo ==========================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore.ps1"
echo.
echo Press any key to exit...
pause > nul