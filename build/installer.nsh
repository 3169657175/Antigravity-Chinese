!include "LogicLib.nsh"
!include "getProcessInfo.nsh"

Var pid

# Only the actual AGY Hub desktop executable counts as "the app is running".
# Installer helpers (elevate.exe, uninstaller, updater helpers) under $INSTDIR
# must never block an installation.
!macro AGY_FIND_MAIN_PROCESS _RETURN
  ${if} $IsPowerShellAvailable == 0
    nsExec::Exec `"$PowerShellPath" -NoProfile -C "$$target = [System.IO.Path]::GetFullPath('$INSTDIR\${APP_EXECUTABLE_FILENAME}'); $$found = Get-CimInstance -ClassName Win32_Process | ? {$$_.Name -eq '${APP_EXECUTABLE_FILENAME}' -and $$_.ExecutablePath -and [string]::Equals([System.IO.Path]::GetFullPath($$_.ExecutablePath), $$target, [System.StringComparison]::OrdinalIgnoreCase) }; if ($$found) { exit 0 } else { exit 1 }"`
    Pop ${_RETURN}
  ${else}
    !ifdef INSTALL_MODE_PER_ALL_USERS
      nsExec::Exec `"$CmdPath" /C tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
      Pop ${_RETURN}
    !else
      nsExec::Exec `"$CmdPath" /C tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
      Pop ${_RETURN}
    !endif
  ${endIf}
!macroend

!macro AGY_BYPASS_BROKEN_LEGACY_UNINSTALLER ROOT_KEY
  ReadRegStr $R9 ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  # Same-version repair installs must never invoke the already-installed
  # uninstaller. electron-builder retries a non-zero old uninstaller result
  # and eventually reports the misleading appCannotBeClosed message even
  # after the AGY Hub process has already exited.
  ${If} $R9 == "${VERSION}"
  ${OrIf} $R9 == "1.3.0"
  ${OrIf} $R9 == "1.3.1"
  ${OrIf} $R9 == "1.3.2"
  ${OrIf} $R9 == "1.3.3"
  ${OrIf} $R9 == "1.3.4"
  ${OrIf} $R9 == "1.3.5"
  ${OrIf} $R9 == "1.3.6"
  ${OrIf} $R9 == "1.3.7"
    DetailPrint "Migrating legacy AGY Hub $R9 without invoking its broken uninstaller."
    DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}"
    !ifdef UNINSTALL_REGISTRY_KEY_2
      DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY_2}"
    !endif
  ${EndIf}
!macroend
!macro AGY_FORCE_CLOSE_MAIN_PROCESS
  ${if} $IsPowerShellAvailable == 0
    nsExec::Exec `"$PowerShellPath" -NoProfile -C "$$target = [System.IO.Path]::GetFullPath('$INSTDIR\${APP_EXECUTABLE_FILENAME}'); Get-CimInstance -ClassName Win32_Process | ? {$$_.Name -eq '${APP_EXECUTABLE_FILENAME}' -and $$_.ExecutablePath -and [string]::Equals([System.IO.Path]::GetFullPath($$_.ExecutablePath), $$target, [System.StringComparison]::OrdinalIgnoreCase) } | % { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
  ${else}
    !ifdef INSTALL_MODE_PER_ALL_USERS
      nsExec::Exec `taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" /FI "PID ne $pid"`
    !else
      nsExec::Exec `"$CmdPath" /C taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" /FI "PID ne $pid" /FI "USERNAME eq %USERNAME%"`
    !endif
  ${endIf}
!macroend

# Standard installer behaviour:
# - app not running: install immediately
# - app running: one confirmation; OK closes it and continues, Cancel exits
!macro customCheckAppRunning
  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro AGY_FIND_MAIN_PROCESS $R0

  ${If} $R0 != 0
    Goto agy_migrate_legacy_uninstaller
  ${EndIf}

  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
    "${PRODUCT_NAME} 正在运行。继续安装将自动关闭程序。$\r$\n$\r$\n点击“确定”继续安装，点击“取消”退出安装。" \
    /SD IDOK IDOK agy_close_running_app
  Quit

  agy_close_running_app:
    IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 agy_force_close_if_needed
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quit-for-update'
    Sleep 2500

  agy_force_close_if_needed:
    !insertmacro AGY_FIND_MAIN_PROCESS $R0
    ${If} $R0 == 0
      !insertmacro AGY_FORCE_CLOSE_MAIN_PROCESS
      Sleep 750
    ${EndIf}

  agy_migrate_legacy_uninstaller:
    !insertmacro AGY_BYPASS_BROKEN_LEGACY_UNINSTALLER HKEY_CURRENT_USER
    !insertmacro AGY_BYPASS_BROKEN_LEGACY_UNINSTALLER HKEY_LOCAL_MACHINE

!macroend
