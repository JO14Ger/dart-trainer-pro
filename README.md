# 🎯 DartTrainer Pro v3.0

Personalisierte Dart-Training-App mit **Multi-Spieler-Profilen**, Wochenplanung, Countdown-Timer, interaktivem Treffer-Tracker für Singles/Doubles/Triples, Performance-Dashboard und Sync zur Handy-App.

**Plattformen:** Windows · macOS · Linux · Android

---

## Features

### Neu in v3
- **Multi-Player** – beliebig viele Spielerprofile, jeder mit eigenem Plan + Statistik
- **Spielervergleich** – Dashboard zeigt Sessions, Average und Doppel-Quote aller Spieler
- **Interaktiver Target-Trainer** – 1-5 Felder wählen (Single / Doppel / Triple), Wurfanzahl definieren, Treffer per Tap eintragen, automatische Auswertung pro Feld
- **Sync zur Handy-App** – konfigurierbare HTTPS-URL + optionaler API-Key, Push/Pull als JSON-Bundle
- **Tagesplan-Splash** – beim App-Start erscheint sofort der Trainingsplan des Tages
- **Auto-Timer** – optional startet der Timer beim nächsten Drill automatisch
- **Test-Sound** – Alarm-Ton aus den Einstellungen probieren

### Aus v2 übernommen
- Tages-Training mit 2-4 Drills (je nach Session-Dauer), sequentiell durcharbeiten
- Countdown-Timer mit Farbwarnung (grün → gelb → rot) und 3-Ton-Alarm bei 0:00
- Timer läuft im Hintergrund (Tab-Wechsel-sicher)
- Verschiebelogik – verpasste Trainings landen automatisch auf Folgetagen
- Drag & Drop zum Umsortieren der Tages-Drills
- KW-Vergleich (diese vs. letzte Woche)
- 17 Default-Drills + 3 Community-Pakete + JSON/URL-Import
- Backup-System (Tauri) und JSON-Export/Import

---

## Schnellstart (Entwicklung)

### Voraussetzungen

| Tool | Version | Installation |
|------|---------|-------------|
| Node.js | ≥18 | [nodejs.org](https://nodejs.org) |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Tauri CLI | v2 | Kommt mit `npm ci` |

### Windows zusätzlich
```
Visual Studio Build Tools (C++ Desktop-Workload)
WebView2 (Windows 11+ vorinstalliert)
```

### Linux zusätzlich
```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

### Starten
```bash
git clone https://github.com/DEIN-USER/dart-trainer-pro.git
cd dart-trainer-pro
npm ci
npx tauri icon src-tauri/icons/icon.svg   # einmalig
npx tauri dev                              # Dev-Modus
```

---

## Desktop-Build (Installer)

### Einfacher Weg (Windows)

Doppelklick auf **`INSTALL.bat`** – das Skript prüft Voraussetzungen, baut den Installer
und zeigt am Ende den Pfad zur fertigen `.exe`.

### Manuell

```bash
npx tauri build
```

Erzeugt (Pfad relativ zum Projekt, durch Cargo-Workspace landet das `target/` im Root):
- **Windows:** `target/release/bundle/nsis/DartTrainer Pro_3.0.0_x64-setup.exe`
- **Linux:** `target/release/bundle/appimage/dart-trainer-pro_3.0.0_amd64.AppImage`
- **macOS:** `target/release/bundle/macos/DartTrainer Pro.app`

### Was der Installer macht

Der NSIS-Installer:
1. Fragt den Modus ab (**Aktueller Benutzer** ohne Admin oder **Alle Benutzer** mit Admin).
2. Installiert die App nach `%LOCALAPPDATA%\Programs\DartTrainer Pro\` bzw. `C:\Program Files\DartTrainer Pro\`.
3. Erstellt **automatisch**:
   - Desktop-Shortcut (`DartTrainer Pro.lnk`)
   - Startmenü-Ordner `DartTrainer Pro` mit App + Deinstallation
4. Eintrag in **Apps & Features** zum Deinstallieren.

Die Logik für die Shortcuts steht in `src-tauri/windows-hooks.nsh` und wird über
`tauri.conf.json > bundle.windows.nsis.installerHooks` eingebunden.

---

## Android-Build (APK)

### Voraussetzungen

| Tool | Version |
|------|---------|
| Android Studio | 2024+ |
| Android SDK | API 24+ |
| Android NDK | 27.x |
| Java JDK | 17 |

### Setup (einmalig)
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/27.0.12077973"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
npx tauri android init
```

### Build
```bash
npx tauri android build --apk            # Debug
npx tauri android build --apk --release  # Release
```

APK liegt unter `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`.

---

## Sync (Desktop ↔ Handy)

Die App sendet/empfängt ein vollständiges JSON-Bundle (alle Spieler, Sessions, Plan, Library) gegen eine einzige HTTP-Endpoint.

Du brauchst nur einen Ort, der `GET` und `PUT` für einen JSON-Blob hinter einem Bearer-Token annimmt. Empfohlene Setups:

- [jsonsilo.com](https://jsonsilo.com) – kostenlos, ein Bin pro Account, Token im Dashboard
- [npoint.io](https://npoint.io) – ebenfalls kostenlos
- Eigener Cloudflare-Worker mit KV (siehe Repo-Discussions für Snippet)
- Eigener Mini-Express-Server (`PUT /save`, `GET /load`)

In den Einstellungen → Sync:

1. Sync aktivieren
2. URL eintragen (z. B. `https://api.jsonsilo.com/public/<id>`)
3. API-Key eintragen (Bearer Header)
4. **Push** auf dem Desktop → **Pull** auf dem Handy

Push lädt alle Daten hoch, Pull holt sie und merged sie lokal (Sessions per ID, Spieler per ID, Library/Packs als Union).

---

## GitHub-Push (Builds in der Cloud)

### Einfacher Weg (Windows)

Doppelklick auf **`PUSH_TO_GITHUB.bat`**. Das Skript:

- erkennt automatisch ob die **GitHub CLI** (`gh`) installiert ist und nutzt sie wenn ja,
- legt das Repo an, pusht den Code,
- setzt den Tag `v3.0.0` (triggert Workflows),
- öffnet auf Wunsch die Actions-Seite im Browser.

**Variante mit GitHub CLI** (empfohlen, kein Passwort-Fummeln):
1. CLI installieren: <https://cli.github.com>
2. `PUSH_TO_GITHUB.bat` ausführen → `j` für gh CLI → einmalig `gh auth login` → fertig.

**Variante ohne CLI** (manuell):
1. Leeres Repo auf GitHub anlegen (`https://github.com/new`, OHNE README).
2. Personal Access Token holen (`https://github.com/settings/tokens` → Scope `repo`).
3. `PUSH_TO_GITHUB.bat` ausführen → Username + Token eingeben wenn `git push` danach fragt.

### Manuell

```bash
git init -b main
git add .
git commit -m "DartTrainer Pro v3.0.0"
git remote add origin https://github.com/USER/dart-trainer-pro.git
git push -u origin main
git tag v3.0.0
git push origin v3.0.0
```

### Workflows

- `.github/workflows/build-desktop.yml` – baut Windows / macOS / Linux
- `.github/workflows/build-android.yml` – baut die APK und hängt sie ans Release

Beide laufen automatisch bei Push eines `v*`-Tags. Sie sind auch **manuell startbar**
via *Actions → Workflow → Run workflow* (für Tests ohne Tag).

Ergebnis: Draft-Release unter *Releases* mit allen Builds als Anhang.

---

## Projektstruktur

```
dart-trainer-pro/
├── src/
│   ├── main.jsx               # React Entry Point
│   ├── DartTrainerPro.jsx     # Haupt-App (alle Features)
│   ├── storage-adapter.js     # Auto-Detect Tauri/Web Storage
│   └── sync.js                # Cloud Sync Helper
├── src-tauri/
│   ├── src/main.rs
│   ├── src/lib.rs             # Rust Backend (FS + Backups)
│   ├── capabilities/default.json
│   ├── icons/icon.svg
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .github/workflows/
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## Datenspeicherung

| Plattform | Speicherort |
|-----------|------------|
| Windows | `%APPDATA%\DartTrainerPro\training_data.json` |
| macOS | `~/Library/Application Support/DartTrainerPro/` |
| Linux | `~/.local/share/DartTrainerPro/` |
| Android | App-interner Speicher |
| Web | Browser-Storage / localStorage |

Automatische Backups (Tauri-Desktop) im `backups/`-Unterordner.

---

## Daten-Migration v2 → v3

Bestehende v2-Daten (Single-Profile) werden beim ersten Start automatisch migriert:
- `profile` → erster Spieler in `players`
- `sessions` bekommen `playerId` des Spielers
- `weekPlan` wird zu `weekPlanByPlayer[playerId]`

Es gehen keine Daten verloren – sicherheitshalber vorher einmal Export ziehen.

---

## Troubleshooting

### `tauri dev` startet nicht
```bash
rustc --version
cargo --version
node --version
```

### Android: NDK nicht gefunden
```bash
echo $NDK_HOME
ls $NDK_HOME
```

### Windows: WebView2 fehlt
[WebView2 Runtime herunterladen](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Icons fehlen
```bash
npx tauri icon src-tauri/icons/icon.svg
```

---

## Lizenz

MIT

---

*Built with [Tauri v2](https://v2.tauri.app) + [React](https://react.dev) + [Vite](https://vitejs.dev)*
