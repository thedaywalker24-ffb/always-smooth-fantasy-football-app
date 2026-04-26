# Project State

## Current Status

* Last completed section: Root `SKILL.md` canonical entrypoint added to the lightweight continuity system on 2026-04-26.
* Current section in progress: Selecting the next app feature after the standings/team-card foundation.
* Next recommended task: Define the weekly matchups/betting sheet and Apps Script route contract before building UI.
* Open risks: Hardcoded Apps Script deployment URL, fragile Google Sheets tab/column dependencies, fixed matchup sheet row offsets, no automated tests, and duplicated/legacy Apps Script paths.
* Most relevant files: `SKILL.md`, `docs/index.html`, `docs/app.js`, `docs/service-worker.js`, `docs/manifest.webmanifest`, `Code.js`, `index.html`, `.clasp.json`, `.claspignore`.

## App Overview

Always Smooth Fantasy Football App is a supplemental dashboard for the Always Smooth Dynasty League. It is meant for 10 dynasty league members to quickly view shared league information from Sleeper alongside league-specific data maintained in Google Sheets.

The app should complement Sleeper, not replace it. Sleeper remains the place for lineup and team management. This app should prioritize league-wide views, supplemental records, weekly matchup context, and weekly league betting.

## Product Context

* Audience: 10 known league members, so UX can be opinionated and league-specific rather than generic SaaS-style.
* Primary workflow: open the app, check league information, and eventually place weekly fantasy football bets.
* Core data model: Sleeper provides fantasy league data; Google Sheets stores supplemental data outside Sleeper.
* Product bias: prefer visible, mobile-friendly league context over admin-heavy tooling.

## Current Architecture Summary

* The repo-specific skill system is intentionally lightweight. `SKILL.md` is the canonical entrypoint and points into `README.md`, this file, `docs/developer-continuity.md`, and the two prompt files in `prompts/`.
* `docs/` is the current GitHub Pages frontend.
* `docs/index.html` contains the app shell, Tailwind CDN setup, custom CSS, splash/install UI, standings container, and secondary informational cards.
* `docs/app.js` is vanilla JS that fetches Apps Script data via JSONP, caches config/data in `localStorage`, renders standings cards, and controls theming/install behavior.
* `docs/service-worker.js` caches the static app shell and uses network-first behavior for the GitHub Pages route and manifest.
* `Code.js` is the primary Apps Script backend and spreadsheet automation file.
* `index.html` at repo root is an Apps Script HTML template version of the dashboard that uses `google.script.run`; it appears older than the GitHub Pages frontend but remains part of the Apps Script deployment.
* `Code2.gs.js` contains an older/simple Sleeper players import function and may be legacy.
* `.clasp.json` points to the Apps Script project; `.claspignore` excludes `docs/**` from Apps Script pushes.

## Frontend / Backend Interaction Model

The hosted frontend in `docs/` calls a hardcoded Apps Script deployment URL:

```js
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwtM_NX16wFOHssvhvP2Iw7FI_7YcVgJ9-5DNbvNOblMxifawE4R-F_eiOLU1NsEggF/exec';
```

Because cross-origin Apps Script requests are constrained, `docs/app.js` uses JSONP. It adds `api=config` or `api=league-data` plus a generated `callback` parameter. `Code.js` validates the callback name and returns JavaScript when JSONP is requested.

Current routes handled by `Code.js#doGet`:

* `api=config` / `config`: frontend branding, season, week, header image, icon URL.
* `api=league-data` / `league-data`: standings/team cards payload.
* `manifest.json`: Apps Script-served manifest payload for the Apps Script-hosted version.
* default route: renders root `index.html` as an Apps Script template.

## Google Sheets Integration Summary

Apps Script is bound to a Google Sheet and uses it as the app database. The spreadsheet menu added by `onOpen` includes actions for settings, league members, records, rosters, matchups, draft data, player data, and clearing ranges.

Known tabs and dependencies:

* `Settings`: app config.
* `Rosters & Records`: primary frontend standings source.
* `Teams`: supplemental team fields matched by team name.
* `API Data`: current matchup import uses week number from `A19` and writes to a fixed starting row.
* `Sleeper Players`: player lookup data for roster population.
* `Team Rosters`: generated roster output.
* `Draft Results`: generated draft pick output.
* `App Data Collection`: cleared by helper function.

`Settings` cells:

* `B2`: season.
* `B3`: week.
* `B4`: Sleeper league ID.
* `B5`: app icon URL.

`Rosters & Records` expected headers:

* `Row ID`
* `User ID`
* `User Avatar URL`
* `Team Name`
* `Team Avatar URL`
* `W-L Record`
* `Streak`
* `Roster ID`
* `Fpts (Total)`
* `Display Name`

`Teams` supplemental columns:

* Header row is row 2.
* Data starts on row 3.
* Team name column is detected by header, falling back to column D when needed.
* Column E: mulligan.
* Column H: manager photo.
* Column L: trophies.
* Column M: Sleeper team image.
* Column Q: team MVP name.
* Column S: beer trophies.
* Column V: team MVP image.

## Completed Sections / Implemented Features

* Repo continuity/skill system v1: root `SKILL.md` and official artifacts exist and define the entrypoint, operating manual, current state, startup prompt, and skill-maintenance prompt.
* GitHub Pages static frontend for the app shell.
* PWA metadata, app icons, install prompt handling, and service worker caching.
* Light/dark/system theme toggle with local preference.
* Splash screen and mobile-friendly banner.
* Live config load from Apps Script with fallback defaults.
* Live standings load from Apps Script with local cached fallback.
* Team cards sorted by wins and points for.
* Expandable standings cards with supplemental stats: team MVP, mulligan, trophies, beer trophies, background team image, and manager photo.
* Apps Script spreadsheet menu for league data operations.
* Sleeper sync functions for members, records, rosters, players, matchups, and draft picks.
* Defensive helpers for Google Drive image URLs and missing settings.

## In-Progress Work

* Recent git history is focused on "add accordion to team tiles", suggesting the standings card expansion interaction is the newest active work.
* Weekly matchups are represented in spreadsheet import logic but not yet surfaced as a real frontend feature.
* Weekly betting is part of the product workflow but does not appear implemented in the current frontend.
* Draft capital/draft results are imported in Apps Script but only represented by placeholder/static UI in the frontend.

## Known Issues

* No automated test suite or lint/build script exists.
* Frontend deploy URL for Apps Script is hardcoded in `docs/app.js`.
* `fetchMatchupData` writes to hardcoded row `278` and reads week number from `API Data!A19`.
* Root `index.html` and `docs/index.html` can drift because one is Apps Script templated and one is GitHub Pages static.
* `Code2.gs.js` appears to duplicate/precede the more complete `fetchSleeperPlayers` implementation in `Code.js`.
* Apps Script functions use a mix of modern JS, legacy comments, and some stale placeholders.

## Likely Current Priorities

* Keep polishing the standings/team-card experience because that is the visible foundation.
* Build weekly matchups in the GitHub Pages frontend from existing Apps Script/spreadsheet data.
* Add the weekly betting workflow in a way that fits the existing Google Sheets database rather than adding a separate backend.
* Reduce fragile sheet assumptions where practical and document the rest.

## Recommended Next 3 Steps

1. Define the weekly betting Google Sheets schema and Apps Script route contract before building UI.
2. Expose matchup data through a read-only `api/matchups` or expanded `api/league-data` payload, then render it in `docs/`.
3. Clean up legacy/duplicated Apps Script paths only after current deployed behavior is confirmed.

## Notes For Future Sessions

Start every session by reading `SKILL.md`, this file, `docs/developer-continuity.md`, and the prompt files. Then inspect `git status`, `docs/app.js`, and relevant `Code.js` sections before making changes. Do not create duplicate continuity docs; improve the official artifacts when new reusable project knowledge is learned.
