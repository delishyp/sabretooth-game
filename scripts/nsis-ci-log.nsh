; CI-only installer trace. electron-builder inserts these macros into the real installer.
; Stock makensis is not built with NSIS_CONFIG_LOG, so LogSet is not used here.
; $CMDLINE is the installer's own command line, including /S and --updated.

Function SabretoothCiAppend
  ; line in $1. Restores $0.
  Push $0
  FileOpen $0 "$TEMP\sabretooth-nsis.log" a
  FileSeek $0 0 END
  FileWrite $0 $1
  FileWrite $0 "$\r$\n"
  FileClose $0
  Pop $0
FunctionEnd

!macro customInit
  Push $1
  StrCpy $1 "customInit exepath=$EXEPATH cmdline=$CMDLINE"
  Call SabretoothCiAppend
  Pop $1
!macroend

!macro customInstall
  Push $1
  StrCpy $1 "customInstall instdir=$INSTDIR exepath=$EXEPATH cmdline=$CMDLINE"
  Call SabretoothCiAppend
  Pop $1
!macroend
