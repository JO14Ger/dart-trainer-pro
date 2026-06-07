@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title DartTrainer Pro - Build Installer (Windows)
color 0A

echo.
echo  ========================================
echo   DartTrainer Pro v3.0 - Build Skript
echo  ========================================
echo.
echo  Dieses Skript baut den Windows-Installer.
echo  Den GitHub-Push macht das separate Skript PUSH_TO_GITHUB.bat.
echo.

:: --- Verzeichnis-Check ---
if not exist "package.json" (
    echo [X] Dieses Skript muss im "dart-trainer-pro" Ordner liegen!
    echo     Bitte INSTALL.bat dort hin verschieben wo package.json liegt.
    pause
    exit /b 1
)
if not exist "src-tauri\tauri.conf.json" (
    echo [X] src-tauri\tauri.conf.json nicht gefunden. Projekt unvollstaendig?
    pause
    exit /b 1
)

:: --- Schritt 1: Voraussetzungen ---
echo [1/5] Pruefe Voraussetzungen...
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js fehlt -- installieren: https://nodejs.org  ^(Version 18+^)
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo   Node.js : %%i  OK

where cargo >nul 2>nul
if errorlevel 1 (
    echo [X] Rust fehlt -- installieren: https://rustup.rs
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('rustc --version') do echo   Rust    : %%i  OK

where git >nul 2>nul
if errorlevel 1 (
    echo [!] Git fehlt -- nur fuer GitHub-Push noetig: https://git-scm.com
) else (
    for /f "tokens=*" %%i in ('git --version') do echo   Git     : %%i  OK
)

echo.

:: --- Schritt 2: npm Dependencies ---
echo [2/5] Installiere npm Dependencies...
echo   ^(Beim ersten Mal 1-2 Minuten^)
echo.
if exist "node_modules" (
    echo   node_modules vorhanden -- ueberspringe npm ci.
    echo   ^(Wenn du den frischen Stand willst, loesche zuerst node_modules.^)
) else (
    call npm ci
    if errorlevel 1 (
        echo [X] npm ci fehlgeschlagen.
        pause & exit /b 1
    )
)
echo.

:: --- Schritt 3: Icons ---
echo [3/5] Stelle App-Icons sicher...
echo.
if not exist "src-tauri\icons\icon.ico" (
    if exist "src-tauri\icons\icon.svg" (
        echo   Generiere Icons aus icon.svg...
        call npx tauri icon src-tauri\icons\icon.svg
    ) else (
        echo [!] Weder icon.ico noch icon.svg vorhanden -- Build koennte fehlschlagen.
    )
) else (
    echo   Icons vorhanden.
)
echo.

:: --- Schritt 4: Vite + Tauri Build ---
echo [4/5] Baue Windows-Installer ^(NSIS^)...
echo   ^(Beim ersten Mal 3-5 Minuten -- Rust kompiliert alle Dependencies^)
echo.
call npx tauri build
if errorlevel 1 (
    echo.
    echo [X] Tauri-Build fehlgeschlagen. Bitte Fehlermeldung oben pruefen.
    pause & exit /b 1
)
echo.

:: --- Schritt 5: Ergebnis anzeigen + Ordner oeffnen ---
echo [5/5] Fertig!
echo.

set "BUNDLE_DIR="
set "FOUND_EXE="
:: Cargo-Workspace legt target/ ins Root, ohne Workspace nach src-tauri/target -- beides probieren
call :find_installer "target\release\bundle\nsis"
if not defined FOUND_EXE call :find_installer "src-tauri\target\release\bundle\nsis"
goto :installer_check

:find_installer
if not exist "%~1" exit /b 0
for %%f in ("%~1\DartTrainer Pro_3.0.0_*-setup.exe") do (
    set "FOUND_EXE=%%f"
    set "BUNDLE_DIR=%~1"
)
if defined FOUND_EXE exit /b 0
for %%f in ("%~1\*-setup.exe") do (
    set "FOUND_EXE=%%f"
    set "BUNDLE_DIR=%~1"
)
exit /b 0

:installer_check

if defined FOUND_EXE (
    echo  ========================================
    echo   ERFOLG -- Installer gebaut:
    echo  ========================================
    echo.
    echo   !FOUND_EXE!
    echo.
    echo  Naechste Schritte:
    echo   1. Doppelklick auf die EXE oben startet die Installation.
    echo   2. Im Installer "Aktueller Benutzer" oder "Alle Benutzer" waehlen.
    echo   3. Danach: Desktop-Verknuepfung erscheint automatisch.
    echo   4. Startmenue: "DartTrainer Pro" -^> Programm starten.
    echo.
    set /p OPEN="Den Ordner mit dem Installer jetzt oeffnen? ^(j/n^): "
    if /i "!OPEN!"=="j" start "" "%BUNDLE_DIR%"
) else (
    echo [X] Installer wurde NICHT gefunden unter %BUNDLE_DIR%
    echo     Build ist vielleicht durchgelaufen, aber das Bundle fehlt.
    pause & exit /b 1
)

echo.
echo  Tipp: Fuer Upload auf GitHub jetzt PUSH_TO_GITHUB.bat starten.
echo.
pause
endlocal
