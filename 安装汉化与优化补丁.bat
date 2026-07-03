@echo off
title Antigravity 2.0 汉化与优化补丁安装工具
cd /d "%~dp0"

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] 已取得管理员权限运行.
) else (
    echo [!] 警告: 本脚本需要管理员权限来写入 AppData 目录和操作进程.
    echo [!] 正在尝试请求管理员权限...
    powershell -Command "Start-Process '%~dp0%~nx0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %errorLevel% neq 0 (
    echo [!] 安装脚本执行出错.
)
pause
