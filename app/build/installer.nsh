!include "LogicLib.nsh"

!ifdef BUILD_UNINSTALLER
  !define AGY_PROCESS_FUNCTION "un.AgyMainProcesses"
!else
  !define AGY_PROCESS_FUNCTION "AgyMainProcesses"
!endif

# Enumerate processes natively, including 64-bit Electron from 32-bit NSIS.
# QueryFullProcessImageNameW checks the executable's complete path. Installer
# helpers and another installation with the same filename must be left alone.
# No PowerShell policy, shell quoting, or taskkill process-tree dependency.
# Input: "find" or "close". Output: 0 if a matching process exists, else 1.
!macro customHeader
Function ${AGY_PROCESS_FUNCTION}
  Exch $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  Push $7
  Push $8
  Push $9
  StrCpy $9 1
  GetFullPathName $8 "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  System::Call 'kernel32::CreateToolhelp32Snapshot(i 2, i 0) p.r1'
  ${If} $1 == -1
    Goto agy_process_return
  ${EndIf}
  # PROCESSENTRY32W is 556 bytes in the x86 NSIS process (9 DWORDs + WCHAR[260]).
  System::Alloc 556
  Pop $2
  System::Call '*$2(i 556)'
  IntOp $7 ${NSIS_MAX_STRLEN} * 2
  System::Alloc $7
  Pop $3
  System::Call 'kernel32::Process32FirstW(p r1, p r2) i.r7'

  agy_process_loop:
    ${If} $7 == 0
      Goto agy_process_cleanup
    ${EndIf}
    System::Call '*$2(i, i, i .r6, i, i, i, i, i, i, &w260 .r4)'
    ${If} $4 == "${APP_EXECUTABLE_FILENAME}"
      StrCpy $7 0x1000 ; PROCESS_QUERY_LIMITED_INFORMATION
      ${If} $0 == "close"
        IntOp $7 $7 | 0x100001 ; SYNCHRONIZE | PROCESS_TERMINATE
      ${EndIf}
      System::Call 'kernel32::OpenProcess(i r7, i 0, i r6) p.r5'
      ${If} $5 != 0
        System::Call 'kernel32::QueryFullProcessImageNameW(p r5, i 0, p r3, *i ${NSIS_MAX_STRLEN}) i.r7'
        ${If} $7 != 0
          System::Call '*$3(&w${NSIS_MAX_STRLEN} .r4)'
          ${If} $4 == $8
            StrCpy $9 0
            ${If} $0 == "close"
              System::Call 'kernel32::TerminateProcess(p r5, i 0)'
              System::Call 'kernel32::WaitForSingleObject(p r5, i 5000)'
            ${EndIf}
          ${EndIf}
        ${EndIf}
        System::Call 'kernel32::CloseHandle(p r5)'
      ${EndIf}
    ${EndIf}
    System::Call 'kernel32::Process32NextW(p r1, p r2) i.r7'
    Goto agy_process_loop

  agy_process_cleanup:
    System::Free $3
    System::Free $2
    System::Call 'kernel32::CloseHandle(p r1)'
  agy_process_return:
    StrCpy $0 $9
    Pop $9
    Pop $8
    Pop $7
    Pop $6
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Exch $0
FunctionEnd
!macroend

!macro AGY_FIND_MAIN_PROCESS _RETURN
  Push "find"
  Call ${AGY_PROCESS_FUNCTION}
  Pop ${_RETURN}
!macroend

!macro AGY_BYPASS_BROKEN_LEGACY_UNINSTALLER ROOT_KEY
  # In-place upgrades and repairs replace the application files directly.
  # Never tie this to a list of versions: forgetting the next version makes
  # electron-builder run the old uninstaller and report appCannotBeClosed
  # after five unsuccessful attempts, even when the app has already exited.
  # Only migrate this app's registration for the selected installation path.
  # A different installation directory still uses the normal uninstall flow.
  ReadRegStr $R8 ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${If} $R8 != ""
    GetFullPathName $R8 "$R8\."
    GetFullPathName $R9 "$INSTDIR\."
    ${If} $R8 == $R9
      DetailPrint "Updating AGY Hub in place without running the old uninstaller."
      DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}"
      !ifdef UNINSTALL_REGISTRY_KEY_2
        DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY_2}"
      !endif
    ${EndIf}
  ${EndIf}
  ClearErrors
!macroend
!macro AGY_FORCE_CLOSE_MAIN_PROCESS
  Push "close"
  Call ${AGY_PROCESS_FUNCTION}
  Pop $R0
!macroend

# Standard installer behaviour:
# - app not running: install immediately
# - app running: close it automatically and continue the requested install
!macro customCheckAppRunning
  !insertmacro AGY_FIND_MAIN_PROCESS $R0

  ${If} $R0 != 0
    Goto agy_migrate_legacy_uninstaller
  ${EndIf}

    DetailPrint "${PRODUCT_NAME} 正在运行，正在自动关闭程序以继续安装。"
    IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 agy_force_close_if_needed
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quit-for-update'
    Sleep 2500

  agy_force_close_if_needed:
    !insertmacro AGY_FIND_MAIN_PROCESS $R0
    ${If} $R0 == 0
      !insertmacro AGY_FORCE_CLOSE_MAIN_PROCESS
      Sleep 750
    ${EndIf}
    !insertmacro AGY_FIND_MAIN_PROCESS $R0
    ${If} $R0 == 0
      MessageBox MB_OK|MB_ICONSTOP "${PRODUCT_NAME} 仍在运行，自动关闭失败，安装已停止。"
      SetErrorLevel 2
      Quit
    ${EndIf}

  agy_migrate_legacy_uninstaller:
    !ifndef BUILD_UNINSTALLER
      !insertmacro AGY_BYPASS_BROKEN_LEGACY_UNINSTALLER SHELL_CONTEXT
    !endif

!macroend
