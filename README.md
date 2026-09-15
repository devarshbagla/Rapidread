# Rapidread

An offline RSVP (Rapid Serial Visual Presentation) speed reader for TXT, EPUB, PDF, DOCX, Markdown, HTML, and images (via OCR). Reading works with no account: books stay in this browser.

Optional sign-in syncs **reading place and settings** across devices. Book files are not uploaded. On a new phone or laptop, Rapidread asks you to pick the same file and resumes playback.

Usernames and password hashes live in a **private Cloudflare D1 database**, never in this public repo. Do not add a users file, spreadsheet, gist, or “passwords doc.”

The Reader is the default screen: it reopens the last book being read. The shelf, import, and settings are a tap away.

## Run it locally

```bash
npm install
cp .env.example .env
cp .dev.vars.example .dev.vars
```

Put a long random string in `.dev.vars` as `JWT_SECRET`. Then in two terminals:

```bash
npm run worker:dev
npm run dev
```

The UI is usually `http://localhost:5173`. The API is `http://127.0.0.1:8787` (already set in `.env.example`).

Cloudflare Workers Builds (the **rapidread** Worker in your dashboard) uses **build command** `npm run build`. This repo’s `wrangler.jsonc` is named `rapidread` so that Git-connected deploy serves `dist/` and the `/auth` + `/sync` API from the same host.

First-time D1 (on your machine, after `npx wrangler login`), if the dashboard did not provision it:

```bash
npm run worker:d1:create
npm run worker:d1:migrate
npm run worker:d1:migrate:remote
npx wrangler secret put JWT_SECRET
```

`worker:d1:create` writes the database id into `wrangler.jsonc`. Commit that id (it is not a password). Never commit `.dev.vars`.

Forgot-password email needs a [Resend](https://resend.com) API key and a verified from-address:

```bash
npx wrangler secret put RESEND_API_KEY
```

Until that exists, accounts still work; reset links cannot be sent.

GitHub Pages still needs the Actions variable `VITE_API_URL` set to the Worker origin (for example `https://rapidread.<subdomain>.workers.dev`) so that copy can sign in. On the Worker host itself, the UI and API share the origin — no extra URL is required.

## GitHub Pages

Every push to `main` builds `dist/` and deploys it. The live URL is:

**https://devarshbagla.github.io/Rapidread/**

**Pages must not publish the `main` branch root.** That serves the Vite source (`/src/main.tsx`) and the app stays blank in the browser.

Fix it in [Settings → Pages](https://github.com/devarshbagla/Rapidread/settings/pages) with either option:

1. **Preferred:** Build and deployment → Source → **GitHub Actions**
2. **Alternative:** Source → **Deploy from a branch**, Branch → **`gh-pages`**, Folder → `/` (the workflow keeps that branch updated)

Do not leave Source on `main` / `/`.

To build the same bundle locally:

```bash
npm run build:pages
npm run preview
```

`dist/` is the static site. Accounts talk to the Worker at `VITE_API_URL`.

## How to read

- **Lower half of the screen** — click to start or stop.
- **Hold and drag sideways** — change speed. The word freezes; a WPM number follows the pointer and fades after you let go.
- **Upper half** — pause and open a scrollable preview of the surrounding lines. Click a line to jump there (playback stays paused).
- **Keyboard** — Space play/pause, ↑/↓ speed, ←/→ one word, Esc back to the shelf.

Settings (gear icon) covers optional account, accent colour, the focus-letter highlight, 1/2/3-word chunks, default WPM, punctuation pause weighting, and adaptive pacing.

## Adding a format later

Parsers live in `src/parsers/`. Each one implements `parse(file: File): Promise<NormalizedBook>` and is registered in `src/parsers/index.ts`. The reader engine, the store, and the UI never see format-specific data — another format is a new file plus one registry entry. Scanned PDFs and images use in-browser OCR (Tesseract).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run worker:dev` | Local Worker + D1 |
| `npm run build` | Typecheck + production bundle |
| `npm test` | Unit tests (parsers, ORP, pacing, chunking, auth) |
| `npm run lint` | oxlint |
| `npm run worker:deploy` | Publish the API Worker |

## Storage

Books stay in IndexedDB via `idb-keyval` on each device. If the browser blocks persistent storage, the session still works and a note appears on the shelf. Signed-in progress and settings also sync to Cloudflare D1 (hashes and metadata only, not the book files).
