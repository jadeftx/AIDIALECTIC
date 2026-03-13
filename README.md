# AIDIALECTIC

**Produce rigorously vetted, exportable reasoning sessions using Claude and Gemini. No copy-paste needed.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<video src="AIDIALECTIC_zombie_demo.mp4" width="100%" controls></video>

---

## What is AIDIALECTIC?

AIDIALECTIC replaces the manual copy-paste loop between Claude and Gemini with a structured side-panel workspace. Instead of switching tabs and moving text by hand, you run multi-round reasoning sessions where each AI critiques, refines, and builds on the other's thinking. The result: rigorously vetted outputs with a complete reasoning chain you can export and keep.

Works with your existing Claude and Gemini subscriptions. No API keys, no external servers, no accounts to create.

## Quick Start

1. Install from the [Chrome Web Store](LINK_HERE) (or [load unpacked](#development) for development)
2. Open [claude.ai](https://claude.ai) and [gemini.google.com](https://gemini.google.com) in a split-tab view
3. Open the AIDIALECTIC side panel (click the extension icon or press `Alt+Shift+D`)
4. Enter your topic or question and start a session
5. Use the floating arrow button on each AI tab to push prompts and capture responses

**Tip:** Split your Claude and Gemini tabs side by side with the AIDIALECTIC panel open for a clean three-column layout.

## Features

### You Stay in Control

This is not a set-and-forget automation. You actively steer the reasoning throughout the session:

- **Interject** at any point to redirect the discussion, add context, or challenge either model's reasoning
- **Insert messages** anywhere in the thread to fill gaps or correct course
- **Hand off** to the next model when you're ready to advance the exchange
- **Mark consensus** when the reasoning reaches a satisfactory conclusion, or reopen to continue
- **Delete or collapse** individual messages to keep the thread focused

### Customize the Reasoning

- **System context** to frame the discussion (e.g., "Analyze this from a legal compliance perspective")
- **Length modifier:** Normal, Short, or Deep Dive
- **Tone modifier:** Default, Clinical, Socratic, or Sassy
- Light/dark theme toggle and zoom controls

### Session Management

Every session is saved automatically. Browse your history, load any past session, and pick up exactly where you left off. Rebuild old reasoning chains or continue sessions days later with full context intact. Bulk export or import your entire session library.

### Export

Export the full reasoning chain when a session reaches consensus or you have what you need:

- **Markdown** for clean, readable documents
- **JSON** for structured data or archival
- **GitHub** push directly to a repository (configure repo, path, and token in settings)

Every export preserves the complete thread: who said what, in what order, with round structure intact.

## Privacy

All session data stays in your browser using local storage. AIDIALECTIC does not send data to external servers, does not collect analytics, and does not track usage. There is no account to create and no backend.

The extension requires host access to claude.ai and gemini.google.com to paste your prompts into the input field and capture AI responses back into the side panel. An optional experimental auto-capture setting can poll for completed responses automatically. No other sites are accessed or modified.

## Development

### Load Unpacked

1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the repository folder
5. Open Claude and Gemini tabs, then open the AIDIALECTIC side panel

### Project Structure

```
├── manifest.json              # Extension manifest (MV3)
├── background.js              # Service worker, persistence, GitHub API
├── content/
│   ├── shared.js              # Push/pull arrow button, capture logic
│   ├── provider-base.js       # Auto-capture polling, DOM extraction
│   ├── claude.js              # Claude-specific selectors and paste logic
│   ├── gemini.js              # Gemini-specific selectors and paste logic
│   └── capture-button.css     # Floating arrow button styles
├── sidepanel/
│   ├── sidepanel.html         # Side panel UI
│   ├── sidepanel.js           # Session management, rendering, export
│   ├── sidepanel.css          # Light + dark themes
│   ├── prompts.js             # Prompt generation (initial, handoff, modifiers)
│   └── collapse.js            # Message collapse/expand behavior
├── settings/
│   ├── settings.html          # Standalone settings page
│   └── settings.js            # Settings page logic
└── utils/
    └── helpers.js             # Shared utility functions
```

### Keyboard Shortcut

`Alt+Shift+D` opens the AIDIALECTIC side panel from any tab.

## Contributing

Issues and pull requests are welcome. This project is maintained on a limited time budget, so response times may vary.

## License

[MIT](LICENSE)

---

Built by [DeftX](https://deftx.com)
