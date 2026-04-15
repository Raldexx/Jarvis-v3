# ⚡ F.R.I.D.A.Y. — System Monitor

> A clean, modern desktop system monitor built with **Tauri 2 + React + TypeScript + Rust**

---

> **📢 Honest Note**
>
> I'm not very experienced with Rust, so I heavily relied on AI assistance (Claude) throughout
> this project — especially for the Rust backend, Windows API calls, and Tauri configuration.
> The overall architecture, design decisions, and UI were driven by me, but the low-level
> systems code was largely AI-generated and iteratively debugged. No shame in that. 🤖
>
> Original concept and v1 ([JARVIS v1](https://github.com/Raldexx/jarvis-v1)) was written in Python/PyQt6.
> This is a full rewrite for a lighter, faster, native-feeling experience via Tauri.

---

## ✨ Features

### 📊 System Monitoring
- CPU, RAM, GPU usage with big-number display
- Clickable cards — tap any metric to open a 60-second history chart
- CPU & GPU temperature readings (hardware dependent)
- Disk usage with free space indicator
- System uptime
- **Top Processes** — Top 5 processes by CPU usage, live updated

### 🌐 Network
- Real-time download / upload speed
- Sparkline graph per metric card

### 🎵 Music
- Spotify integration — detects currently playing track via Windows window title
- Live animated visualizer bars
- Real session history — tracks accumulate as you listen
- Lyrics panel (Premium — requires Spotify API token)

### 🌍 Language Support
- English 🇬🇧, Turkish 🇹🇷, Spanish 🇪🇸
- Language preference saved to local storage
- All UI text, settings labels, and changelog entries change with the selected language

### 🤖 F.R.I.D.A.Y. AI
- Real-time voice assistant powered by **OpenAI Realtime API** (WebRTC, `gpt-4o-realtime-preview`)
- Animated 72-bar audio ring visualizer reacting to mic volume
- Protocol commands: start / work / gaming / night protocol
- Semantic memory — automatically learns facts and preferences from conversations
- Google Meet integration: generates Obsidian `.md` note template + AI meeting summary
- Google Drive / Calendar accessible directly via F.R.I.D.A.Y. AI
- Voice commands automatically disabled in Eco performance mode
- Whisper language follows the app's language setting (TR / EN / ES)

### 🔄 AI Translator Card
- Inline translation card replacing the old System Info card
- Supports 8 languages with automatic debounce (no button needed)

### 📝 Notes
- Quick notes with add / edit / delete
- Notes persist via local storage

### ⏱ Timer
- Standalone Timer card (split from Notes in v4.0)
- Count-up mode or countdown mode
- Countdown triggers a Windows notification + alert when finished

### 💤 Idle Mode
- After 15 minutes of inactivity, switches to a minimal overlay
- Shows a large clock + CPU / RAM / GPU mini metric display
- Click anywhere to resume

### 🕐 World Clock
- Click the header clock to open the world clock panel
- Search any of 20 major cities and see their local time live

### 🖼 Image Tools
- **Edit tab** — Grayscale, Invert, Sepia, Blur, Brightness, Contrast filters with live preview
- **Upscale tab** — Browser-side Lanczos-quality upscaling at ×2 / ×3 / ×4; advanced CLI launcher for Smart/Photo/Sharpen algorithms via `image_upscaler.py`
- **Sort tab** — Sorts files by type (Images, Videos, Music, Documents, Code, Archives, Apps) with Copy or Move mode

### 👑 Premium
- Premium section with Discord contact for access (`Raldexx`)
- Future: Spotify lyrics, cloud sync, custom themes

### 🎨 Artist Themes
- **Madison Beer** — play any Madison Beer song → purple night theme activates automatically
- **Simge / İcardi** — play *Aşkın Olayım* → warm Galatasaray/İcardi theme activates
- Theme reverts automatically when the song changes
- Manual theme override available in Settings (Off / İcardi / Madison)
- Photo rotation: cycles between two artist photos every 60 seconds (toggleable)

### ⚙️ Settings
- **Light / Dark theme** toggle
- **Language** — English, Turkish, Spanish (persisted)
- **Always on top** toggle
- **Start with Windows** toggle
- **Performance mode** — Eco / Normal / Turbo
- **Artist Theme** — manual override independent of Spotify playback
- **Photo Rotation** — enable / disable 60-second photo cycling
- Re-launch the feature tour at any time

### 🗺 Feature Tour
- Step-by-step guided tour on first launch
- Re-triggerable from Settings

### ⚡ Quick Actions
- Restart / Shutdown / Sleep with confirmation dialog

### 🪟 Window
- Custom frameless window with soft rounded corners
- Minimize, maximize, close controls
- Freely resizable

---

## 🖥️ Supported Platforms

| Platform      | Status                                                         |
|---------------|----------------------------------------------------------------|
| Windows 10/11 | ✅ Full support                                                 |
| macOS         | ⚠️ Limited (Spotify & some system features unavailable)        |
| Linux         | ⚠️ Limited                                                     |

---

## 🚀 Getting Started

### Prerequisites

```bash
# 1. Install Rust
# https://rustup.rs → download rustup-init.exe → select option 1

# 2. Verify
rustc --version
cargo --version

# 3. Node.js 18+ required
node --version
```

### Run locally

```bash
git clone https://github.com/Raldexx/FRIDAY.git
cd FRIDAY

npm install
npm run tauri dev
```

### Build .exe

```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/nsis/FRIDAY_4.0.0_x64-setup.exe
```

Or push to `main` — GitHub Actions builds automatically and publishes to Releases.

---

## 🗂️ Project Structure

```
FRIDAY/
├── src-tauri/                  ← Backend (Rust)
│   ├── src/
│   │   ├── main.rs             ← Entry point
│   │   ├── lib.rs              ← Tauri setup + system tray
│   │   └── commands.rs         ← All Tauri commands
│   ├── capabilities/
│   │   └── default.json        ← Window & API permissions
│   ├── icons/                  ← App icons
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
│
├── src/                        ← Frontend (React + TypeScript)
│   ├── App.tsx                 ← Main UI + all modals
│   ├── StatsApp.tsx            ← Stats window
│   ├── store/
│   │   └── system.ts           ← Data hook + i18n (EN/TR/ES) + settings
│   ├── components/
│   │   ├── JarvisAI.tsx        ← F.R.I.D.A.Y. AI voice assistant
│   │   ├── MetricCard.tsx
│   │   ├── ChartModal.tsx
│   │   ├── SpotifyPanel.tsx
│   │   ├── TranslatorCard.tsx
│   │   └── ui/
│   │       ├── Card.tsx
│   │       └── Modal.tsx
│   ├── assets/
│   │   ├── icardi.ts           ← İcardi theme photos (base64)
│   │   └── madison.ts          ← Madison Beer theme photos (base64)
│   └── index.css
│
├── image_upscaler.py           ← CLI tool for advanced image upscaling
├── .github/workflows/
│   └── build.yml               ← Auto-build on push to main
├── package.json
└── vite.config.ts
```

---

## 📝 Notes

- **Spotify detection** works on Windows only, using window title enumeration
- **GPU temperature** depends on hardware and driver support via `sysinfo`
- **Session history** in the Music panel resets when F.R.I.D.A.Y. is closed
- **Start with Windows** setting is saved but requires Tauri autostart plugin to be wired in `lib.rs` (planned)
- **F.R.I.D.A.Y. AI** requires an OpenAI API key with Realtime API access
- Build may take 5–15 minutes on first run as Rust compiles all dependencies

---

## 📦 Dependencies

### Rust
- `tauri` v2 — Desktop app framework
- `sysinfo` v0.33 — Cross-platform system info
- `reqwest` — Async HTTP (weather)
- `winapi` v0.3 — Windows-specific Spotify detection
- `tokio` — Async runtime

### Frontend
- `react` v18 + TypeScript
- `@tauri-apps/api` v2 — Frontend ↔ Rust bridge
- `framer-motion` — Animations
- `lucide-react` — Icons
- `tailwindcss` v3
- `vite` v5 — Build tool

---

## 👑 Premium

Want Premium features (lyrics, cloud sync, themes)?
Contact on Discord: **Raldexx**

---

## 📋 Changelog

### v4.0.0 — F.R.I.D.A.Y. (Current)
- 🤖 Renamed: JARVIS → F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth)
- 🎙 Real-time voice assistant via OpenAI Realtime API (WebRTC, `gpt-4o-realtime-preview`)
- 🌀 Animated 72-bar audio ring visualizer reacting to mic volume
- 🚀 Protocol commands: start / work / gaming / night
- 🧠 Semantic memory — automatic learning from conversations
- 📝 Google Meet integration + Obsidian `.md` note template + AI meeting summary
- 🔄 AI Translator card (replaces System Info card) — 8 languages, auto-debounce
- ⏱ Timer split into its own standalone card
- 💤 Idle mode — 15 min inactivity triggers large clock + mini metrics overlay
- 🐛 Voice commands disabled in Eco mode
- 🐛 Realtime API whisper language follows app language setting
- 🐛 System Info moved into CPU chart modal
- 🐛 Settings rows now use stable keys — language change no longer duplicates theme/rotation rows
- 🐛 Changelog now fully translates with the selected language

### v3.2.0 — Last JARVIS release
- Language support: English, Turkish, Spanish
- World Clock, Image Tools, Notes + Timer, Artist themes (Madison / İcardi)
- OpenAI Realtime API first integration

### v3.0.0 — Initial release
- Full rewrite from Python/PyQt6 to Tauri + React + Rust
- Spotify integration
- GitHub Actions CI/CD
