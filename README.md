# ⚡ F.R.I.D.A.Y. — System Monitor

> A clean, modern desktop system monitor built with **Tauri 2 + React + TypeScript + Rust**

---

> **📢 Honest Note**
>
> I'm not very experienced with Rust, so I heavily relied on AI assistance (Claude) throughout
> this project — especially for the Rust backend, platform-specific API calls, and Tauri configuration.
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
- Spotify integration — detects currently playing track
  - **Windows**: window title enumeration via WinAPI
  - **macOS**: AppleScript (built-in, no setup needed)
  - **Linux**: `playerctl` (recommended) or D-Bus fallback
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
- Countdown triggers a system notification + alert when finished

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

### ⚙️ Settings
- **Light / Dark theme** toggle
- **Language** — English, Turkish, Spanish (persisted)
- **Always on top** toggle
- **Start with system** toggle
- **Performance mode** — Eco / Normal / Turbo
- **Artist Theme** — manual override independent of Spotify playback
- **Photo Rotation** — enable / disable 60-second photo cycling
- Re-launch the feature tour at any time

### ⚡ Quick Actions
- Restart / Shutdown / Sleep with confirmation dialog (all platforms)
- Open system task manager / activity monitor

### 🪟 Window
- Custom frameless window with soft rounded corners
- Minimize, maximize, close controls
- Freely resizable

---

## 🖥️ Supported Platforms

| Platform              | Status         | Notes                                                                 |
|-----------------------|----------------|-----------------------------------------------------------------------|
| Windows 10/11 (x64)  | ✅ Full         |                                                                       |
| macOS (Intel x64)    | ✅ Full         | First launch: right-click → Open to bypass Gatekeeper                |
| macOS (Apple Silicon) | ✅ Full        | Native arm64 build, M1/M2/M3/M4 supported                            |
| Linux (x64)          | ✅ Full         | AppImage or .deb; see [Linux notes](#-linux-notes) below             |

### Feature availability by platform

| Feature                     | Windows | macOS | Linux |
|-----------------------------|:-------:|:-----:|:-----:|
| CPU / RAM / Disk monitoring | ✅       | ✅     | ✅     |
| GPU temperature             | ✅       | ⚠️¹   | ⚠️¹   |
| Network stats               | ✅       | ✅     | ✅     |
| Spotify detection           | ✅       | ✅     | ✅²    |
| System actions (power)      | ✅       | ✅     | ✅³    |
| Task manager shortcut       | ✅       | ✅     | ✅⁴   |
| Folder picker dialog        | ✅       | ✅     | ✅⁵   |
| Image Tools CLI             | ✅       | ✅     | ✅     |
| F.R.I.D.A.Y. AI             | ✅       | ✅     | ✅     |

¹ GPU temp depends on driver/hardware exposing sensors via `sysinfo`  
² Linux Spotify requires `playerctl` (`sudo apt install playerctl`)  
³ Linux power actions use `systemctl`; requires appropriate sudo/polkit rules  
⁴ Linux opens the first available task manager: gnome-system-monitor, xfce4-taskmanager, ksysguard, or htop  
⁵ Linux folder picker uses `zenity` (GNOME) or `kdialog` (KDE)  

---

## 🚀 Getting Started

### Prerequisites

```bash
# 1. Install Rust
# https://rustup.rs

# 2. Verify
rustc --version
cargo --version

# 3. Node.js 18+ required
node --version
```

#### Linux extra dependencies

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libgtk-3-dev \
  libssl-dev \
  pkg-config \
  zenity          # folder picker
  
# Optional but recommended:
sudo apt install playerctl   # Spotify detection
```

#### macOS extra dependencies

Xcode Command Line Tools are required:
```bash
xcode-select --install
```

### Run locally

```bash
git clone https://github.com/Raldexx/FRIDAY.git
cd FRIDAY

npm install
npm run tauri dev
```

### Build

**Windows**
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/nsis/FRIDAY_4.0.0_x64-setup.exe
```

**macOS (native arch)**
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/dmg/FRIDAY_4.0.0_*.dmg
```

**macOS Universal (Intel + Apple Silicon)**
```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

**Linux**
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/appimage/FRIDAY_4.0.0_amd64.AppImage
#         src-tauri/target/release/bundle/deb/FRIDAY_4.0.0_amd64.deb
```

Or push to `main` — GitHub Actions builds automatically for **Windows, macOS (Intel + Apple Silicon), and Linux** and publishes all artifacts to Releases.

---

## 🐧 Linux Notes

- **Spotify**: Install `playerctl` for the best experience. Without it, F.R.I.D.A.Y. falls back to D-Bus directly, which may vary by distro.
- **AppImage**: `chmod +x FRIDAY_*.AppImage && ./FRIDAY_*.AppImage`
- **Power actions**: Sleep/Restart/Shutdown call `systemctl`. On desktops with polkit configured (most modern distros), this works without sudo.
- **Folder picker**: Uses `zenity` on GNOME or `kdialog` on KDE. Install one if neither is present.
- **Task manager shortcut**: Tries `gnome-system-monitor`, `xfce4-taskmanager`, `ksysguard`, then `htop` in order.

## 🍎 macOS Notes

- **Gatekeeper**: Since the app is unsigned, right-click → Open on first launch.
- **Spotify**: Detection uses AppleScript — no extra install needed. Spotify must be running.
- **Sleep**: Uses `pmset sleepnow` — works without sudo.
- **Power actions**: Restart/Shutdown use AppleScript `System Events` — may prompt for accessibility permissions on first use.

---

## 🗂️ Project Structure

```
FRIDAY/
├── src-tauri/                  ← Backend (Rust)
│   ├── src/
│   │   ├── main.rs             ← Entry point
│   │   ├── lib.rs              ← Tauri setup + system tray
│   │   └── commands.rs         ← All Tauri commands (cross-platform)
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
│   └── build.yml               ← Auto-build on push to main (Windows + macOS + Linux)
├── package.json
└── vite.config.ts
```

---

## 📝 Notes

- **Spotify detection** works on all platforms — see platform notes above
- **GPU temperature** depends on hardware and driver support via `sysinfo`
- **Session history** in the Music panel resets when F.R.I.D.A.Y. is closed
- **F.R.I.D.A.Y. AI** requires an OpenAI API key with Realtime API access
- Build may take 5–15 minutes on first run as Rust compiles all dependencies

---

## 📦 Dependencies

### Rust
- `tauri` v2 — Desktop app framework (cross-platform)
- `sysinfo` v0.33 — Cross-platform system info
- `reqwest` — Async HTTP (weather)
- `winapi` v0.3 — Windows-only Spotify detection (conditionally compiled)
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

### v4.1.0 — Beta — Cross-Platform
- 🐧 Full Linux support: Spotify via `playerctl`/D-Bus, power actions via `systemctl`, folder picker via `zenity`/`kdialog`
- 🍎 Full macOS support: Spotify via AppleScript, power actions via `System Events`, folder picker via `osascript`
- 🔨 GitHub Actions now builds Windows + macOS (Intel & Apple Silicon) + Linux in parallel
- 🐛 Image Tools CLI terminal launcher fixed for macOS (Terminal.app) and Linux (auto-detects terminal emulator)
- 🐛 Process list filter updated for Unix process names
- 🐛 "Start with Windows" renamed to "Start with system" (cross-platform)

### v4.0.0 — Alpha — F.R.I.D.A.Y. (Previous)
- 🤖 Renamed: JARVIS → F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth)
- 🎙 Real-time voice assistant via OpenAI Realtime API (WebRTC, `gpt-4o-realtime-preview`)
- 🌀 Animated 72-bar audio ring visualizer reacting to mic volume
- 🚀 Protocol commands: start / work / gaming / night
- 🧠 Semantic memory — automatic learning from conversations
- 📝 Google Meet integration + Obsidian `.md` note template + AI meeting summary
- 🔄 AI Translator card (replaces System Info card) — 8 languages, auto-debounce
- ⏱ Timer split into its own standalone card
- 💤 Idle mode — 15 min inactivity triggers large clock + mini metrics overlay

### v3.2.0 — Last JARVIS release
- Language support: English, Turkish, Spanish
- World Clock, Image Tools, Notes + Timer, Artist themes (Madison / İcardi)
- OpenAI Realtime API first integration

### v3.0.0 — Initial release
- Full rewrite from Python/PyQt6 to Tauri + React + Rust
- Spotify integration
- GitHub Actions CI/CD
