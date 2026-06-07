@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title DartTrainer Pro - Push auf GitHub
color 0B

echo.
echo  ========================================
echo   DartTrainer Pro - GitHub-Upload
echo  ========================================
echo.
echo  Dieses Skript pusht das Projekt auf GitHub und triggert
echo  damit die GitHub Actions ^(Desktop- + Android-Build^).
echo.

if not exist "package.json" (
    echo [X] Bitte im Projekt-Ordner ^(mit package.json^) starten.
    pause & exit /b 1
)
where git >nul 2>nul
if errorlevel 1 (
    echo [X] Git fehlt -- bitte installieren: https://git-scm.com
    pause & exit /b 1
)

:: --- gh CLI vorhanden? ---
set "GH_AVAILABLE=0"
where gh >nul 2>nul
if not errorlevel 1 set "GH_AVAILABLE=1"

if "!GH_AVAILABLE!"=="1" (
    echo  GitHub CLI ^(gh^) erkannt -- das macht den Push viel einfacher.
    echo.
    set /p USE_GH="GitHub CLI nutzen ^(empfohlen, j/n^)? "
    if /i "!USE_GH!"=="j" goto :USE_GHCLI
)

goto :MANUAL_PUSH

:: ===========================================================
:: VARIANT 1: gh CLI - voll automatisch
:: ===========================================================
:USE_GHCLI
echo.
echo  [gh] Pruefe Login...
gh auth status >nul 2>nul
if errorlevel 1 (
    echo  [gh] Du bist nicht eingeloggt. Starte gh-Login:
    gh auth login
    if errorlevel 1 (
        echo [X] gh auth login fehlgeschlagen.
        pause & exit /b 1
    )
)

echo.
set /p REPO_NAME="Repo-Name auf GitHub ^(Default: dart-trainer-pro^): "
if "!REPO_NAME!"=="" set "REPO_NAME=dart-trainer-pro"

set /p VISIBILITY="Sichtbarkeit ^(public/private, Default: private^): "
if "!VISIBILITY!"=="" set "VISIBILITY=private"

echo.
echo  Stelle lokales Git-Repo sicher...
call :ENSURE_REPO_READY
if errorlevel 1 ( pause & exit /b 1 )

echo.
echo  Erstelle Repo "!REPO_NAME!" ^(!VISIBILITY!^) und pushe...
:: Falls bereits ein Remote gesetzt ist, raus damit -- gh setzt es neu
git remote remove origin >nul 2>nul
gh repo create "!REPO_NAME!" --!VISIBILITY! --source=. --remote=origin --push
if errorlevel 1 (
    echo.
    echo [!] gh repo create ist fehlgeschlagen. Wahrscheinliche Ursachen:
    echo     - Repo "!REPO_NAME!" existiert schon auf GitHub.
    echo     - Du bist nicht eingeloggt ^(gh auth status^).
    echo.
    set /p RETRY_PUSH="Soll ich versuchen, einfach in das vorhandene Repo zu pushen? ^(j/n^): "
    if /i "!RETRY_PUSH!"=="j" (
        for /f "tokens=*" %%u in ('gh api user --jq .login 2^>nul') do set "GH_USER=%%u"
        if not defined GH_USER (
            echo [X] Konnte GH-User nicht ermitteln.
            pause & exit /b 1
        )
        git remote add origin "https://github.com/!GH_USER!/!REPO_NAME!.git"
        git push -u origin main
        if errorlevel 1 (
            echo [X] git push auf vorhandenes Repo fehlgeschlagen.
            pause & exit /b 1
        )
    ) else (
        pause & exit /b 1
    )
)

echo.
echo  Setze Tag v3.0.0 -- das triggert die GitHub Actions...
git tag -f v3.0.0
git push -f origin v3.0.0
if errorlevel 1 (
    echo [!] Push des Tags fehlgeschlagen -- vielleicht existiert er schon.
)

echo.
for /f "tokens=*" %%u in ('gh api user --jq .login 2^>nul') do set "GH_USER=%%u"
echo  ========================================
echo   ERFOLG
echo  ========================================
echo.
echo   Repo:     https://github.com/!GH_USER!/!REPO_NAME!
echo   Actions:  https://github.com/!GH_USER!/!REPO_NAME!/actions
echo   Releases: https://github.com/!GH_USER!/!REPO_NAME!/releases
echo.
echo  In 5-15 Minuten findest du dort:
echo   - Windows-Installer ^(.exe^)
echo   - macOS-App ^(.dmg^)
echo   - Linux AppImage ^(.AppImage^)
echo   - Android APK ^(.apk^)
echo.
set /p OPEN_BROWSER="Browser oeffnen mit Actions-Seite? ^(j/n^): "
if /i "!OPEN_BROWSER!"=="j" start "" "https://github.com/!GH_USER!/!REPO_NAME!/actions"
goto :END

:: ===========================================================
:: VARIANT 2: Manuell - per HTTPS-URL + Personal Access Token
:: ===========================================================
:MANUAL_PUSH
echo.
echo  Manueller Weg ^(ohne gh CLI^):
echo.
echo  1. Leeres Repository auf GitHub:
echo     https://github.com/new
echo     - Name: dart-trainer-pro
echo     - KEIN "Initialize with README" ankreuzen
echo.
echo  2. Personal Access Token als Passwort-Ersatz:
echo     https://github.com/settings/tokens
echo     - "Generate new token ^(classic^)"
echo     - Scope: "repo" anhaken
echo     - Token kopieren ^(zeigt sich nur einmal!^)
echo.
pause
echo.

set /p GHUSER="Dein GitHub-Username: "
if "!GHUSER!"=="" (
    echo [X] Kein Username angegeben.
    pause & exit /b 1
)
set /p REPO_NAME="Repo-Name ^(Default: dart-trainer-pro^): "
if "!REPO_NAME!"=="" set "REPO_NAME=dart-trainer-pro"

echo.
echo  Stelle lokales Git-Repo sicher...
call :ENSURE_REPO_READY
if errorlevel 1 ( pause & exit /b 1 )

echo.
echo  Verknuepfe mit GitHub-Repo...
git remote remove origin >nul 2>nul
git remote add origin "https://github.com/!GHUSER!/!REPO_NAME!.git"

echo.
echo  Pushe auf main ^(Username/Token wird abgefragt^)...
echo   - Username : !GHUSER!
echo   - Passwort : Dein Personal Access Token ^(NICHT dein normales Passwort!^)
echo.
git push -u origin main
if errorlevel 1 (
    echo.
    echo [X] git push fehlgeschlagen.
    echo     Moegliche Ursachen:
    echo       - Token ist falsch oder hat nicht den Scope "repo"
    echo       - Repo existiert noch nicht auf GitHub
    echo       - Repo ist nicht leer ^(README oder anderes drin^)
    echo.
    pause & exit /b 1
)

echo.
echo  Setze Tag v3.0.0 -- triggert GitHub Actions...
git tag -f v3.0.0
git push -f origin v3.0.0

echo.
echo  ========================================
echo   ERFOLG
echo  ========================================
echo.
echo   Repo:     https://github.com/!GHUSER!/!REPO_NAME!
echo   Actions:  https://github.com/!GHUSER!/!REPO_NAME!/actions
echo   Releases: https://github.com/!GHUSER!/!REPO_NAME!/releases
echo.
echo  Builds laufen jetzt automatisch ^(5-15 Min^).
echo.
set /p OPEN_BROWSER="Browser mit Actions-Seite oeffnen? ^(j/n^): "
if /i "!OPEN_BROWSER!"=="j" start "" "https://github.com/!GHUSER!/!REPO_NAME!/actions"
goto :END

:: ===========================================================
:: HILFS-ROUTINE: Stellt sicher dass es eine Commit auf main gibt
:: ===========================================================
:ENSURE_REPO_READY
:: 1) git init falls noetig
if not exist ".git" (
    echo   git init...
    git init >nul
    if errorlevel 1 ( echo [X] git init fehlgeschlagen & exit /b 1 )
)

:: 2) Pruefen ob es ueberhaupt einen Commit gibt
git rev-parse --verify HEAD >nul 2>nul
if errorlevel 1 (
    echo   Erstelle initialen Commit...
    git add -A
    if errorlevel 1 ( echo [X] git add fehlgeschlagen & exit /b 1 )
    :: User-Identitaet pruefen, sonst commit failed
    git config user.email >nul 2>nul
    if errorlevel 1 git config user.email "darttrainer@local"
    git config user.name >nul 2>nul
    if errorlevel 1 git config user.name "DartTrainer User"
    git commit -m "DartTrainer Pro v3.0.0 - Initial Release"
    if errorlevel 1 (
        echo [X] git commit fehlgeschlagen -- keine Dateien zum Committen?
        exit /b 1
    )
) else (
    echo   Repo hat bereits Commits -- adde Aenderungen falls vorhanden...
    git add -A >nul
    git diff --cached --quiet
    if errorlevel 1 (
        git commit -m "DartTrainer Pro v3.0.0 - Update" >nul
        echo   Neuer Commit erstellt.
    )
)

:: 3) Branch IMMER auf "main" benennen ^(deckt master- und alle anderen Faelle ab^)
git branch -M main
if errorlevel 1 ( echo [X] Branch-Rename auf main fehlgeschlagen & exit /b 1 )

exit /b 0

:END
echo.
pause
endlocal
