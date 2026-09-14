# Rapidread

An offline RSVP (Rapid Serial Visual Presentation) speed reader for TXT and EPUB books. Everything runs in the browser and stays on the device — no accounts, no backend, no analytics.

The Reader is the default screen: it reopens the last book being read. The shelf, import, and settings are a tap away.

## Run it locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

## GitHub Pages

The site is built from **`main` only** — there is no separate Pages branch. Every push to `main` runs the deploy workflow, which builds `dist/` and publishes it through GitHub Actions.

One-time Pages setting:

1. Open **Settings → Pages**
2. Under **Build and deployment → Source**, choose **GitHub Actions** (not “Deploy from a branch”)
3. Save — you can remove the old `gh-pages` branch afterward if it still exists

The live site is:

**https://devarshbagla.github.io/Rapidread/**

To build the same bundle locally:

```bash
npm run build:pages
npm run preview
```

`dist/` is the entire site. There is no server-side code.

## How to read

- **Lower half of the screen** — click to start or stop.
- **Hold and drag sideways** — change speed. The word freezes; a WPM number follows the pointer and fades after you let go.
- **Upper half** — pause and open a scrollable preview of the surrounding lines. Click a line to jump there (playback stays paused).
- **Keyboard** — Space play/pause, ↑/↓ speed, ←/→ one word, Esc back to the shelf.

Settings (gear icon) covers accent colour, the focus-letter highlight, 1/2/3-word chunks, default WPM, punctuation pause weighting, and adaptive pacing.

## Adding a format later

Parsers live in `src/parsers/`. Each one implements `parse(file: File): Promise<NormalizedBook>` and is registered in `src/parsers/index.ts`. The reader engine, the store, and the UI never see format-specific data — a future PDF or DOCX parser is a new file plus one registry entry.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production bundle |
| `npm test` | Unit tests (parsers, ORP, pacing, chunking) |
| `npm run lint` | oxlint |

## Storage

Books, reading positions, and settings are stored in IndexedDB via `idb-keyval`. If the browser blocks persistent storage, the session still works and a note appears on the shelf.
