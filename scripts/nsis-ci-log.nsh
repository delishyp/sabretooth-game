; CI-only installer trace. electron-builder inserts these macros into the real installer.
; They stay macros, not functions: the uninstaller pass never calls them, and an
; unreferenced function is warning 6010, which electron-builder treats as an error.
; Stock makensis is not built with NSIS_CONFIG_LOG, so LogSet is not used here.
; $CMDLINE is the installer's own command line, including /S and --updated.

!macro SabretoothCiAppend LINE
  Push $0
  Push $1
  StrCpy $1 "${LINE}"
  FileOpen $0 "$TEMP\sabretooth-nsis.log" a
  FileSeek $0 0 END
  FileWrite $0 $1
  FileWrite $0 "$\r$\n"
  FileClose $0
  Pop $1
  Pop $0
!macroend

!macro customInit
  !insertmacro SabretoothCiAppend "customInit exepath=$EXEPATH cmdline=$CMDLINE"
!macroend

!macro customInstall
  !insertmacro SabretoothCiAppend "customInstall instdir=$INSTDIR exepath=$EXEPATH cmdline=$CMDLINE"
!macroend
