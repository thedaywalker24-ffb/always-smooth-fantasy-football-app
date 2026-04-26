# Always Smooth Fantasy Football App

Supplemental app for the Always Smooth Dynasty League, a 10-team fantasy football dynasty league. The app gives league members a fast, mobile-friendly place to view common league information from Sleeper alongside supplemental league data tracked in Google Sheets.

## Product Context

- Primary audience: the 10 members of the Always Smooth Dynasty League.
- Core workflow: open the app to check league data and, as development continues, place weekly fantasy football bets.
- Source of truth: the repo for code and continuity, Google Sheets for league data, Sleeper for imported fantasy data.
- Out of scope: replacing Sleeper as the place where managers set lineups and manage teams.

## Stack Summary

- Frontend: static HTML/CSS/vanilla JS in `docs/`, hosted by GitHub Pages.
- Styling: Tailwind CDN plus custom CSS in `docs/index.html`.
- PWA shell: `docs/manifest.webmanifest`, `docs/service-worker.js`, and icon files in `docs/icons/`.
- Backend/database: Google Apps Script bound to the league Google Sheet.
- Backend source: `Code.js`, `Code2.gs.js`, `index.html`, `appsscript.json`.
- External data: Sleeper API plus supplemental Google Sheets tabs.

## Architecture

The GitHub Pages frontend calls the deployed Apps Script web app with JSONP. Apps Script reads from Google Sheets, enriches roster/standings data with supplemental team data, and returns payloads used by the frontend.

Important entry points:

- `docs/index.html`: current hosted app shell.
- `docs/app.js`: frontend data loading, caching, theming, install prompt, and standings rendering.
- `Code.js`: Apps Script web routes, spreadsheet menu actions, Sleeper sync functions, and Google Sheets mapping logic.
- `index.html`: Apps Script-served HTML template kept for web app hosting/fallback continuity.

## Setup Notes

There is currently no package manager or build step. The frontend is plain static assets.

For local frontend inspection, serve `docs/` with any static server, for example:

```bash
python3 -m http.server 8000 --directory docs
```

Apps Script deployment is managed with clasp config in `.clasp.json`. The `.claspignore` excludes `docs/**`, so GitHub Pages assets are not pushed to Apps Script.

## Continuity Docs

- [Canonical agent entrypoint](SKILL.md)
- [Current project state](docs/project-state.md)
- [Developer continuity manual](docs/developer-continuity.md)
- [Session bootstrap prompt](prompts/session-bootstrap-prompt.md)
- [Skill maintenance prompt](prompts/skill-maintenance-prompt.md)
