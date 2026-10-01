!include "LogicLib.nsh"
!include "getProcessInfo.nsh"

Var pid

# The setup executable is named agy-hub-setup-<version>.exe, while
# APP_EXECUTABLE_FILENAME is the exact installed desktop application name.
# Never use a product-name wildcard here: it can terminate the installer itself.
!macro customCheckAppRunning
  # KILL_PROCESS's non-PowerShell fallback must exclude the current NSIS PID.
  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  # electron-builder 26.15.3+ resolves processes by executable path under
  # $INSTDIR through PowerShell/CIM. Its anchored tasklist fallback is used only
  # when PowerShell is unavailable. This avoids Unicode and substring matches.
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${If} $R0 == 0
    DetailPrint `Requesting running "${PRODUCT_NAME}" to stop for update...`

    # A second Electron instance forwards this dedicated argument to the current
    # primary instance through requestSingleInstanceLock/second-instance.
    IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 agy_verify_graceful_exit
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quit-for-update'

    # Do not poll CIM in a tight loop. Starting PowerShell and enumerating
    # Win32_Process is much slower than the sleep itself on some machines.
    Sleep 4000
    agy_verify_graceful_exit:
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 != 0
      Goto agy_app_stopped
    ${EndIf}

    # Migration fallback for versions released before --quit-for-update existed.
    # KILL_PROCESS uses the upstream path-scoped implementation and therefore
    # cannot select agy-hub-setup-<version>.exe outside $INSTDIR.
    DetailPrint `The installed legacy version did not stop; closing processes loaded from the exact install directory...`
    !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 0
    Sleep 750
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 == 0
      !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 1
      Sleep 750
      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${If} $R0 == 0
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "无法关闭安装目录中的 ${PRODUCT_NAME}。请手动退出后点击重试。" /SD IDCANCEL IDRETRY agy_retry_shutdown
        Quit
        agy_retry_shutdown:
          Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quit-for-update'
          Sleep 4000
          Goto agy_verify_graceful_exit
      ${EndIf}
    ${EndIf}

    agy_app_stopped:
      DetailPrint `"${PRODUCT_NAME}" has stopped. Continuing installation.`
  ${EndIf}
!macroend
