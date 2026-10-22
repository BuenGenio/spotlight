<h1 align="center">Spotlight</h1>

<p align="center">
  <strong>A compact, keyboard-driven launcher for GNOME Shell 45 through 51.</strong>
</p>

<p align="center">
  <a href="https://github.com/BuenGenio/spotlight">Repository</a>
  •
  <a href="https://extensions.gnome.org/extension/10666/spotlight/">GNOME Extensions</a>
</p>

<p align="center">
  <strong>Version:</strong> 2026.16
  &nbsp;•&nbsp;
  <strong>Shortcut:</strong> <code>Ctrl + Space</code>
</p>

<img width="1366" height="768" alt="Screenshot" src="https://github.com/user-attachments/assets/7d3d6cfb-86eb-44a7-83a0-f9810ded63f8" />


## Fork installation

This fork adds appearance controls and scoped, explained file searches. Clone this repository and run `./scripts/install-local.sh` to install these changes. The GNOME Extensions listing and release installer below install the upstream version.

## Installation

### [GNOME Extensions](https://extensions.gnome.org/extension/10666/spotlight/) (recommended)

### curl

```bash
curl -sL https://raw.githubusercontent.com/itsnin/spotlight/main/scripts/install.sh | sh
# Log out and back in on Wayland before enabling.
gnome-extensions enable spotlight@nin
```

## Preferences

```bash
gnome-extensions prefs spotlight@nin
```

- Toggle keyboard shortcut (default `Ctrl+Space`)
- Visual theme: Default (follows system), Dark, or Light
- Dialog width: 400–2400 pixels (default 900), capped at 85% of the monitor width
- Corner radius: 0–48 pixels (default 24); changes apply while the popup is open


## Features

- Reuses GNOME's built-in search infrastructure
- Results from apps, calculator, files, system actions, settings, web search
- Positioned 25% from top, grows downward, never drifts. Subtle ease on open and close matching GNOME conventions.
- Translucent glass appearance, dark and light modes
- Live system theme following when set to Default

## Usage

| Action | Input |
|---|---|
| Open Spotlight | `Ctrl + Space` |
| Launch app | Type name, `Enter` |
| Evaluate expression | Type math, `Enter` |
| Lock screen | Type `lock`, `Enter` |
| Open Wi-Fi settings | Type `wifi`, `Enter` |
| Search the web | Type query, `Enter` |
| Traverse results | `↑` / `↓` |
| Dismiss | `Esc`, `Ctrl + Space`, or click outside |

## Search filters

Plain text keeps the normal GNOME search providers. Use **Search tips** below the entry, or press **F1**, for clickable examples and a plain-language explanation of your active filter.

| Query | Search |
|---|---|
| `files:invoice` | File names containing “invoice”, excluding folders |
| `folders:photos` | Folder names containing “photos” |
| `content:"annual report"` | Extracted file text containing this phrase |
| `type:pdf invoice` | PDF file names containing “invoice” |
| `type:image` | Images identified by their MIME type |
| `type:image/png` | A specific MIME type |
| `files:report type:pdf,docx` | File names with either extension |

`file:`, `folder:`, and `contents:` are aliases; `ext:` works like `type:`. Choose one scope per query, optionally with a type filter. Multiple words are treated as one phrase. Use ↑/↓ and Enter to open a scoped result.

Scoped queries use the [LocalSearch ontology](https://gnome.pages.gitlab.gnome.org/localsearch/endpoint.html) through the `tinysparql` command and its local D-Bus endpoint. They need LocalSearch and TinySPARQL installed. Only indexed files are searched; contents also need a successful text extraction. No filesystem crawl is started and scoped queries are not sent to the other search providers.

Run `./scripts/install-local.sh` to build and install this checkout, saving a backup of any existing installation. The fork retains the upstream UUID, so it replaces the original extension. On Wayland, log out and back in to load changed JavaScript and settings schemas.

For focused checks, run `node --test tests/query.test.mjs`, `glib-compile-schemas --strict schemas/`, and `GSETTINGS_BACKEND=memory gjs -m prefs/tests/preferences.js`. `gjs -m tests/indexedSearch.js` checks queries and cancellation against an available local index. `python3 tests/headless-smoke.py` checks popup routing and lifecycle in a separate headless GNOME session, with memory-backed settings.

## Architecture

Spotlight permanently takes over GNOME Overview's search infrastructure. On enable, it steals the Overview's search entry and search controller widgets and hides them. When the popup opens, these already-stolen widgets are reparented into the popup. When the popup closes, they're removed from the popup but kept stolen and hidden. They're only returned to the Overview on disable.

This approach means Spotlight automatically benefits from every search provider registered with GNOME Shell, with zero custom provider code.

## Contributing

Contributions of all types are welcome — bug fixes, new features, documentation improvements, design proposals. Before starting, please read the [contributor guide](./CONTRIBUTING.md) and the [agent standards](./AGENTS.md) which describe the project's design philosophy, architecture, code style, and verification discipline.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Security

For security vulnerabilities, please do not open a public issue. See the [security policy](./SECURITY.md) for the private reporting process.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
