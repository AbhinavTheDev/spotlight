# Spotlight — AI Agent & Developer Guide

> **Project Reference**: macOS-inspired Spotlight Search & Quick Action Launcher for Windows (built with **tinyjs**).  
> **Target Audience**: AI Agents, LLM Pair Programmers, and Core Contributors.

---

## 1. Project Overview & Vision

**Spotlight** is an ultra-lightweight, blazing-fast desktop launcher for Windows (with macOS/Linux compatibility) modeled after the macOS Spotlight search bar. It is built using **[tinyjs](https://tinyjs.app)**, pairing a minimal **txiki.js** JavaScript backend with a native system webview (**WebView2** on Windows, **WKWebView** on macOS).

### Core Goals
- **Instant Response**: Real-time keystroke searching with zero lag. No heavy frameworks (no Electron, no Chromium overhead). The app binary footprint is only ~6 MB.
- **Native Windows Program Discovery**: Indexes Windows Start Menu items and UWP apps via `Get-StartApps` and shortcut directories, complete with native icons extracted directly from `.exe` and `.lnk` files.
- **In-Memory Querying**: Applications are indexed once at boot and cached persistently. Searches run 100% in-memory with zero process spawning per keystroke.
- **Integrated Utilities**: Instant math evaluation, unit/currency conversions, system quick actions (Lock, Sleep, Task Manager, Settings, Terminal, etc.), and web search fallback.
- **Frameless Frosted Acrylic UI**: Clean macOS/Fluent design language with vibrancy blur, keyboard-first navigation, and system theme adaptation (Dark/Light).

---

## 2. Technical Stack & Dependencies

| Layer | Technology | Details |
|---|---|---|
| **Runtime / Backend** | [txiki.js](https://github.com/saghul/txiki.js) via `tinyjs` | Lightweight ES2023 JS engine (`QuickJS` + `libuv`). Full system access (files, processes, FFI). |
| **Frontend Webview** | Windows WebView2 / macOS WKWebView | Native system browser engine communicating over a private internal IPC socket. |
| **Framework / Tooling** | `tinyjs` CLI (`v0.50.1+`) | Zero-bundler setup. Instant dev server (`tinyjs dev`) and native binary compiler (`tinyjs build`). |
| **Language & Standards**| Modern Vanilla JavaScript (ESM), HTML5, CSS3 | No heavy UI libraries (React/Vue/Svelte) — pure DOM operations for sub-millisecond rendering. |
| **Package Manager** | `npm` / `pnpm` | Defined in `package.json` (`tinyjs` in `devDependencies`). |

---

## 3. Directory & File Structure

```
spotlight/
├── .agents/
│   ├── AGENT.md                 # Agent instructions (this file)
│   └── skills/tinyjs/           # TinyJS skill guidelines and API references
├── .claude/
│   ├── CLAUDE.md                # Claude-specific project guide (mirrors AGENT.md)
│   └── skills/tinyjs/           # TinyJS skill copy for Claude
├── src/
│   ├── main.js                  # Backend entry point (App indexing, Quick Actions, Hotkey, IPC API)
│   └── frontend/
│       ├── index.html           # Floating Spotlight bar markup
│       ├── app.js               # UI logic: search debouncing, keyboard navigation, theme listener
│       └── style.css            # Acrylic frosted glass styling, Fluent icons, dark/light themes
├── types/
│   ├── tiny.d.ts                # TypeScript declarations for frontend `tiny` global
│   └── tjs.d.ts                 # TypeScript declarations for backend `tjs` runtime
├── vibe/
│   └── session.md               # Architecture decision records & session notes
├── icon.png                     # App icon (1024x1024)
├── jsconfig.json                # VS Code / IDE configuration referencing type definitions
├── package.json                 # Project scripts and package configuration
├── tinyjs.json                  # Application metadata, window size, chrome & permissions
└── README.md                    # User-facing documentation and feature list
```

---

## 4. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Native OS Window                              │
│  (Frameless, Vibrancy "under-window", Accessory Activation)            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
┌───────────────────────────────┐         ┌───────────────────────────────┐
│     Frontend (WebView2)       │         │    Backend (txiki.js / tjs)   │
│  src/frontend/                │  IPC    │  src/main.js                  │
│  - app.js                     │<=======>│  - AppScanner                 │
│  - index.html                 │ (JSON)  │  - QuickActionEngine          │
│  - style.css                  │         │  - Window Management & Hotkey │
└───────────────────────────────┘         └───────────────┬───────────────┘
                                                          │
                                     ┌────────────────────┴───────────────┐
                                     ▼                                    ▼
                          ┌──────────────────────┐             ┌─────────────────────┐
                          │ Disk Cache (JSON)    │             │ PowerShell (Boot)   │
                          │ %LOCALAPPDATA%/      │             │ - Get-StartApps     │
                          │ spotlight-apps-cache │             │ - Icon Extraction   │
                          └──────────────────────┘             └─────────────────────┘
```

### 4.1 Backend Engine (`src/main.js`)

1. **`AppScanner`**:
   - **Boot Scan**: Runs a single self-contained PowerShell script encoded in Base64 UTF-16LE via `-EncodedCommand`. It queries `Get-StartApps`, maps shortcuts (`.lnk`) from `ProgramData` and `AppData`, and extracts icons as Base64-encoded PNG strings using `System.Drawing.Icon::ExtractAssociatedIcon`.
   - **Persistent Caching**: Saves scanned results to `${LOCALAPPDATA}/spotlight-apps-cache.json`. On future launches, apps are loaded instantly from disk cache before the background scan refreshes them.
   - **Search (`search(query)`)**: Pure in-memory filtering. Prioritizes prefix matches over substring matches. Never executes child processes during queries.
   - **Launch (`launch(appId, path)`)**: Executes `.lnk`, `.exe`, or `.msc` directly via `cmd.exe /c start "" <path>`, or launches UWP apps via `explorer.exe shell:AppsFolder\<AppID>`.

2. **`QuickActionEngine`**:
   - **Math Calculator**: Validates input against safe mathematical characters regex `^[\d\s+\-*/().^%]+$`, sanitizes operators (`^` to `**`, `×` to `*`, `÷` to `/`), and evaluates via `Function()`.
   - **Unit & Currency Conversions**: Regex parsing (`<value> <fromUnit> to <toUnit>`) supporting length (`m`, `km`, `ft`, `in`, `mi`), weight (`kg`, `g`, `lb`, `oz`), and temperature (`c`, `f`, `k`).
   - **System Shortcuts**: Built-in commands for `Lock Computer`, `Sleep`, `Task Manager`, `Windows Settings`, `Command Prompt`, `Calculator`, `Notepad`.
   - **Web Search**: Fallback to Google search (`https://www.google.com/search?q=...`) opened via `app.shell.open()`.

3. **IPC API (`export const api`)**:
   - `search({ query })`: Returns categorized lists: `Top Applications`, `System Shortcuts`, `Calculator`, `Conversion`, `Applications`, and `Quick Actions`.
   - `executeItem({ item })`: Executes the selected item (app launch, system command, copy to clipboard, or web search) and closes/hides the window.
   - `toggleWindow()`: Shows or hides the floating Spotlight window.
   - `hideWindow()`: Hides the window upon `Escape` or focus loss.
   - `centerWindow()`: Centers the window on the active monitor.

4. **Global Hotkey Registration**:
   - Registered via `app.hotkey.register('toggleSpotlight', hotkey)`.
   - Defaults to `Ctrl+Shift+Space` on Windows, `Cmd+Space` on macOS, and `Ctrl+Space` on Linux.

### 4.2 Frontend (`src/frontend/`)

1. **`app.js`**:
   - Debounces user input (`50ms`) before sending `tiny.api.call('search', { query })`.
   - Flattens categorized results into `flatResults` for smooth keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`).
   - Escapes all interpolated item titles and subtitles using `escapeHtml()` to protect against XSS.
   - Dynamically renders Base64 app icons or fallback Fluent SVGs.
   - Adapts to system theme using `tiny.theme.get()` and `tiny.theme.on()`.
   - Configures the shortcut hint badge based on `tiny.system.isMacOS()` vs `tiny.system.isWindows()`.

2. **`index.html`**:
   - Minimal layout with drag regions marked with `data-tiny-drag` and interactive elements marked with `data-tiny-nodrag`.
   - Contains header search input, result body, empty state placeholder, and keyboard shortcut legend in the footer.

3. **`style.css`**:
   - Frosted acrylic dark/light aesthetics using `backdrop-filter: blur(30px)`.
   - Strict sizing (`720px` width) with rounded corners (`14px`), subtle border glow, and macOS-style typography (`Segoe UI Variable`, `-apple-system`, `Inter`).

---

## 5. Development & Build Commands

All development commands rely on the `tinyjs` CLI.

```bash
# Start development mode with hot-reloading (frontend swaps live; backend restarts on change)
npm run dev
# Or directly:
tinyjs dev

# Build production binary for current host platform (outputs to dist/)
npm run build
# Or directly:
tinyjs build

# Build production binary for Windows x64
npm run build:win
# Or directly:
tinyjs build --arch x64

# Build production binary for macOS ARM64
npm run build:mac

# Clean build artifacts
npm run clean
```

---

## 6. Critical Rules & Guidelines for AI Agents

When modifying or expanding this codebase, strictly follow these principles:

### 1. Performance & Zero-Lag Search
- **NEVER spawn external processes (PowerShell, CMD, Bash) inside the keystroke search path.**
- All searches must be performed against in-memory structures or fast caches.
- App scanning must only run asynchronously at boot or via a dedicated user-triggered re-index command.

### 2. IPC & Input Sanitization
- All communication across the frontend/backend bridge passes through `tiny.api`.
- Any data rendered into the DOM must be escaped with `escapeHtml()` or created using `document.createElement()` and `textContent`.
- Mathematical expression evaluation must validate character allowlists to prevent arbitrary code execution.

### 3. Window & Drag Behavior
- `tinyjs` uses `data-tiny-drag` to enable native window dragging on frameless windows.
- Always include `data-tiny-nodrag` on `<input>`, `<button>`, scroll containers, or interactive elements. Failing to do so will swallow mouse clicks and prevent text selection or focus.

### 4. System Compatibility
- When adding system commands, ensure Windows path handling escapes backslashes properly.
- Use `tjs.spawn()` for background execution without freezing the event loop.
- Use `app.shell.open(url)` for browser URLs rather than spawning browser executables directly.

### 5. UI & Ergonomics
- The app must remain 100% usable via keyboard alone (`↑`, `↓`, `Enter`, `Esc`, `Tab`).
- Keep UI clutter minimal: no superfluous panels, heavy borders, or distracting banners.
- When an action executes, the window must close/hide immediately so the user can continue their work.

---

## 7. Configuration Reference (`tinyjs.json`)

```json
{
  "name": "spotlight",
  "title": "Spotlight",
  "id": "com.spotlight.app",
  "version": "2.0.0",
  "minTinyjsVersion": "0.50.1",
  "icon": "icon.png",
  "size": "720x460",
  "activation": "accessory",
  "readAccess": true,
  "chrome": {
    "frame": false,
    "transparent": true,
    "vibrancy": "under-window",
    "windowControls": false,
    "squareCorners": false,
    "acceptsFirstMouse": true,
    "menu": false
  },
  "windowPlacement": true,
  "contextMenu": false,
  "backend": "src/main.js",
  "frontend": {
    "dir": "src/frontend"
  }
}
```

- `"activation": "accessory"`: Keeps the app window as an accessory panel that does not create a standard dock icon or steal focus abruptly.
- `"chrome"`: Frameless, transparent, and vibrant for a native frosted acrylic experience.
- `"readAccess": true`: Grants the backend permission to read file paths needed for scanning and icon caching.
