# 🔦 Spotlight - Quick Actions & Clipboard Manager

A **macOS-inspired Spotlight** search app for **Windows**, built with **[tinyjs](https://tinyjs.app)**. Focused on **quick actions** and **clipboard management** - without the complexity of file search.

![Spotlight App Preview](https://img.shields.io/badge/Spotlight-Windows-blue?style=flat-square)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![tinyjs: 0.50.1](https://img.shields.io/badge/tinyjs-0.50.1-007AFF.svg)](https://tinyjs.app)

---

## ✨ Features

### 📋 Clipboard History
- **View** your clipboard history with timestamps
- **Search** through past clipboard items
- **Pin** frequently used items to the top
- **Copy** items back to clipboard with one click
- **Delete** individual items or clear all history
- **Persistent** storage between app sessions

### ⚡ Quick Actions
| Action | Example | Result |
|--------|---------|--------|
| 🧮 **Calculator** | `25 * 4 + 10` | `110` |
| 📏 **Unit Conversion** | `10 ft to m` | `3.048 m` |
| 💰 **Currency** | `100 USD to EUR` | `€92.00` |
| 🕐 **Time Conversion** | `3pm EST to PST` | `12pm PST` |
| 🔐 **Base64** | `base64 encode hello` | `aGVsbG8=` |
| 🔗 **URL Shortener** | `https://long-url.com` | Shortened URL |
| 🔒 **Hash** | `md5 hello` | `5d41402abc4b2a76b9719d911017c592` |
| 🔤 **Text Case** | `case upper hello` | `HELLO` |
| 📋 **Sort Lines** | Multi-line text | Sorted alphabetically |
| ✂️ **Trim** | Text with spaces | Trimmed text |

### 🎯 Search & Navigation
- **Instant Search**: Results update as you type
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Smart Detection**: Auto-detects calculators, conversions, etc.
- **Section Navigation**: Tab through different result categories

### 🎨 User Interface
- **macOS Spotlight-inspired** design
- **Dark theme** with transparency and blur effects
- **Responsive** layout that adapts to your screen
- **Smooth animations** and transitions
- **Accessible** with full keyboard support

---

## 🚀 Installation & Usage

### Prerequisites
- Windows 10 or 11
- [Node.js](https://nodejs.org/) (for development)
- [tinyjs](https://tinyjs.app) CLI

### Quick Start

```bash
# Clone or download the project
cd spotlight

# Install tinyjs globally (if not already installed)
npm install -g tinyjs

# Start development mode with hot reload
tinyjs dev

# Build for production
tinyjs build

# Build for Windows (x64)
tinyjs build --arch x64
```

### Global Hotkey
- **Windows**: `Ctrl + Shift + Space` (configurable)
- Press the hotkey to show/hide Spotlight

### Basic Usage
1. Press the hotkey to open Spotlight
2. Start typing to search
3. Use **Arrow keys** to navigate results
4. Press **Enter** to execute the selected action
5. Press **Escape** to close

---

## 📸 Screenshots

### Main Interface
```
┌─────────────────────────────────────┐
│  🔍 Type to search...             Ctrl+Shift+Space │
├─────────────────────────────────────┤
│  QUICK ACTIONS                       │
│  ┌─────────┐ ┌─────────┐          │
│  │ 🧮 Calc │ │ 📏 Units │          │
│  │ 💰 Curr │ │ 🔗 URL  │          │
│  └─────────┘ └─────────┘          │
├─────────────────────────────────────┤
│  CLIPBOARD HISTORY                   🗑️│
│  ┌─────────────────────────────────┐│
│  │ 📋 Lorem ipsum dolor sit...    Pin ││
│  │ 📋 Hello world from clipboard   Pin ││
│  │ 📋 https://example.com          Pin ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Calculator
```
┌─────────────────────────────────────┐
│  🔍 25 * 4 + 10                      ✕ │
├─────────────────────────────────────┤
│  QUICK ACTIONS                       │
│  ┌─────────────────────────────────┐│
│  │ 🧮 Calculator                    = 110 ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Unit Conversion
```
┌─────────────────────────────────────┐
│  🔍 10 ft to m                       ✕ │
├─────────────────────────────────────┤
│  QUICK ACTIONS                       │
│  ┌─────────────────────────────────┐│
│  │ 📏 Unit Conversion      3.048 m  ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## 🛠️ Configuration

Edit `tinyjs.json` to customize the app:

```json
{
  "size": "800x500",
  "chrome": {
    "frame": false,
    "transparent": true,
    "vibrancy": "under-window"
  },
  "permissions": {
    "clipboard": "Required for clipboard access"
  }
}
```

### Customizing the Hotkey

Edit `src/main.js`:

```javascript
// For Windows
app.onHotkey('ctrl+shift+space', toggleWindow);

// For macOS
app.onHotkey('cmd+space', toggleWindow);
```

---

## 📦 Project Structure

```
spotlight/
├── tinyjs.json          # App configuration
├── package.json         # Project metadata
├── README.md            # This file
├── icon.png             # App icon (1024x1024)
├── vibe/
│   └── session.md       # Development documentation
├── src/
│   ├── main.js          # Backend entry point
│   ├── clipboard.js      # Clipboard manager
│   ├── quickActions.js   # Quick actions engine
│   └── frontend/
│       ├── index.html   # Main HTML
│       ├── app.js       # Frontend logic
│       └── style.css    # Styles
└── types/
    ├── tiny.d.ts         # tinyjs types
    └── tjs.d.ts          # txiki.js types
```

---

## 🎯 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Arrow Down` | Move selection down |
| `Arrow Up` | Move selection up |
| `Enter` | Execute selected item / search |
| `Escape` | Clear search / close modal / quit app |
| `Tab` | Cycle through sections |
| `Ctrl+Shift+Space` | Toggle app (Windows) |

---

## 🔧 Development

### Architecture
- **Backend**: txiki.js with full system access
- **Frontend**: WebView2 with HTML/CSS/JavaScript
- **Communication**: Socket-based IPC between backend and frontend

### Key Technologies
- **[tinyjs](https://tinyjs.app)** - Native desktop app framework
- **[txiki.js](https://github.com/tarwin/txiki.js)** - JavaScript runtime
- **[WebView2](https://docs.microsoft.com/en-us/microsoft-edge/webview2/)** - Windows webview
- **Vanilla JavaScript** - No framework dependencies

### Adding New Quick Actions

1. Add to `src/quickActions.js`:

```javascript
// In the constructor
this.actions.push(this.createAction('newAction', 'New Action', 'Description', this.newHandler, 'category'));

// Add handler method
async newHandler(query) {
  return { result: 'processed result', formatted: 'Formatted Result' };
}

// Add detection method (optional)
isNewAction(query) {
  return /pattern/.test(query);
}
```

2. Test with development mode:

```bash
tinyjs dev
```

---

## 🐛 Troubleshooting

### Common Issues

**App doesn't launch:**
```bash
# Verify tinyjs installation
tinyjs --version

# Check app configuration
tinyjs dev --debug
```

**Clipboard monitoring doesn't work:**
- Ensure clipboard permission is granted in `tinyjs.json`
- Check console logs for errors
- Verify the app has proper permissions

**Hotkey doesn't work:**
- Check if another app is using the same hotkey
- Try a different hotkey combination
- Verify hotkey registration in `src/main.js`

**UI looks wrong:**
- Check for WebView2-specific CSS issues
- Test with `TINYJS_DEBUG=1 tinyjs dev`
- Ensure proper backdrop-filter support

### Debug Mode

```bash
# Enable debug logging
TINYJS_DEBUG=1 tinyjs dev

# Check console output for errors
```

---

## 📚 Documentation

- **[Full Development Documentation](vibe/session.md)** - Complete implementation details
- **[tinyjs API Reference](https://github.com/tarwin/tinyjsapp/blob/main/docs/api.md)**
- **[Platform Support](https://github.com/tarwin/tinyjsapp/blob/main/docs/platforms.md)**

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### How to Contribute

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style

- Use ES6+ JavaScript
- Follow existing patterns
- Add comments for complex logic
- Keep functions small and focused
- Use descriptive variable names

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[tinyjs Team](https://github.com/tarwin)** - For creating an amazing framework
- **[Apple](https://apple.com)** - For the Spotlight inspiration
- **Open Source Community** - For the tools and libraries used

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/spotlight/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/spotlight/discussions)
- **tinyjs Community**: [GitHub Discussions](https://github.com/tarwin/tinyjsapp/discussions)

---

*Built with ❤️ using [tinyjs](https://tinyjs.app)*
