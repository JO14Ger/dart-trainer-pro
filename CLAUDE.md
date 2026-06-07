# DartTrainer Pro – Projekt-Kontext für Claude Code

## Überblick
DartTrainer Pro ist eine personalisierte Dart-Training-App. React-Frontend (Single-File JSX), Tauri v2 Backend (Rust) für Windows Desktop + Android.

## Aktueller Stand (v3.0.0)
- App-Code: `src/DartTrainerPro.jsx` (~1200 Zeilen, komplette App)
- Storage: `src/storage-adapter.js` (auto-detect Tauri/Web, v2-Detection für Tauri 2)
- Sync: `src/sync.js` (Push/Pull JSON-Bundle gegen konfigurierbare HTTPS-URL)
- Backend: `src-tauri/src/lib.rs` (Rust, native Dateispeicherung + Backups)
- Config: `src-tauri/tauri.conf.json` (Tauri v2 Format)
- CI/CD: `.github/workflows/` (Desktop + Android Builds)

## Features (implementiert)
### v3 Neu
1. **Multi-Player** – `players[]`, `activePlayerId`, Sessions tragen `playerId`, weekPlan ist nested in `weekPlanByPlayer`
2. **PlayerPickerScreen** beim Start wenn mehrere Profile, **PlayerSwitcherModal** im Header (User-Chip)
3. **Spielervergleich** im Dashboard (Sessions, Avg, Doppel-Quote pro Spieler)
4. **Target Trainer** interaktiv: Drill-IDs `d_target_singles`, `d_target_doubles`, `d_target_triples`. Setup → Wahl 1-5 Felder + Würfe; Run → große Treffer/Daneben-Buttons + Live-Quote pro Feld; Auswertung speichert `targetResults`, `targetType`, `targetPercent`
5. **DailyPlanSplash** beim App-Start (zeigt Drills des Tages, "Starten/Fortsetzen")
6. **Sync** – `sync.js` Push/Pull mit Bearer-Token; URL + Key im Settings-Tab
7. **AutoStartTimer** Setting – Timer startet automatisch für nächsten (non-target) Drill
8. **Test-Sound** Button neben Sound-Toggle
9. **Mobile-Header** mit Truncation für lange Namen + flexWrap

### Aus v2.x
- Countdown-Timer (App-Level, Tab-Wechsel-sicher) mit 3-Ton-Alarm + Tick bei letzten 10s
- Tages-Training 2-4 Drills, sequentiell, mit Verschiebelogik
- Drag & Drop zum Umsortieren
- KW-Vergleich
- 17 Default-Drills + 3 Community-Pakete, JSON/URL-Import
- Deterministische Drill-Zuweisung (hashDate)

## Tech-Stack
- **Frontend**: React 18, Vite 5, Recharts, Lucide Icons
- **Backend**: Tauri v2, Rust (serde, chrono, dirs crate)
- **Fonts**: DM Sans (UI) + JetBrains Mono (Zahlen/Timer)
- **Theme**: Dark (#0a0e1a), Green accents (#22c55e)
- **Persistence**: Tauri Native FS (Desktop/Android) / window.storage / localStorage (Web)

## Architektur-Entscheidungen
- **Single-File JSX**: Gesamte App in `src/DartTrainerPro.jsx` (Portabilität)
- **Storage-Key**: `dart-trainer-state-v2` bleibt der localStorage-Key (legacy stable), Migration intern via `migrateState()`
- **State-Schema v3**:
  ```js
  {
    version, players[], activePlayerId,
    sessions[],              // global flat, gefiltert per playerId
    weekPlanByPlayer{},      // {[playerId]: {[date]: [drillId,...]}}
    library[], installedPacks[],
    settings { ..., syncEnabled, syncUrl, syncKey, lastSyncAt, autoStartTimer }
  }
  ```
- **Migration v2→v3**: `migrateState()` erkennt fehlendes `players[]`, baut Player aus `profile`, hängt `playerId` an alle Sessions, verschiebt `weekPlan` → `weekPlanByPlayer[id]`
- **Timer im Main-App**: bleibt wie in v2 (timerRemaining/Active/Finished State + useRef Interval)
- **Target-Drill-Rendering**: `cur.targetConfig` schaltet Timer/Score-Karten weg und rendert `TargetTrainerSetup` → `TargetTrainerRun`
- **Sync-Bundle**: ganzer State minus `settings.syncKey` (Secret bleibt lokal). Merge: Sessions per ID, Players per ID, Library Union.

## Ordnerstruktur
```
dart-trainer-pro/
├── src/
│   ├── main.jsx
│   ├── DartTrainerPro.jsx
│   ├── storage-adapter.js
│   └── sync.js
├── src-tauri/
│   ├── src/lib.rs
│   ├── src/main.rs
│   ├── build.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/default.json
├── .github/workflows/
│   ├── build-desktop.yml
│   └── build-android.yml
├── index.html
├── package.json
└── vite.config.js
```

## Bekannte TODOs
- Android-Build noch nicht final getestet (`npx tauri android init` → `--apk --release`)
- GitHub Actions noch nicht gepusht – warten auf Repo
- Sync gegen einen echten kostenlosen JSON-Host noch nicht end-to-end probiert

## Build-Befehle
```bash
npm ci
npx tauri dev
npx tauri build
npx tauri android init
npx tauri android build --apk
```

## Konventionen
- Sprache der App: Deutsch
- Sprache des Codes: Englisch (Variablen, Funktionen)
- Sprache der Kommentare: Englisch
- Kommunikation mit dem Auftraggeber: Deutsch
- Der Auftraggeber ist Designer, kein Programmierer – Erklärungen einfach halten
