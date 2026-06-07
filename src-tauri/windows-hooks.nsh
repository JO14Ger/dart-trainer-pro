; DartTrainer Pro - NSIS Installer Hooks
; Stellt sicher, dass ein Desktop-Shortcut UND ein Startmenue-Eintrag
; erstellt werden -- unabhaengig davon ob die UI-Checkbox geklickt wurde
; oder ein Silent-Install laeuft.

!macro NSIS_HOOK_POSTINSTALL
  ; Desktop-Shortcut (immer)
  CreateShortCut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
  ; Startmenue (immer)
  CreateDirectory "$SMPROGRAMS\${PRODUCTNAME}"
  CreateShortCut  "$SMPROGRAMS\${PRODUCTNAME}\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
  CreateShortCut  "$SMPROGRAMS\${PRODUCTNAME}\Deinstallieren.lnk" "$INSTDIR\uninstall.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Beim Deinstallieren Shortcuts wieder entfernen
  Delete   "$DESKTOP\${PRODUCTNAME}.lnk"
  Delete   "$SMPROGRAMS\${PRODUCTNAME}\${PRODUCTNAME}.lnk"
  Delete   "$SMPROGRAMS\${PRODUCTNAME}\Deinstallieren.lnk"
  RMDir    "$SMPROGRAMS\${PRODUCTNAME}"
!macroend
