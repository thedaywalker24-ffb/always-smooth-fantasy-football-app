# Project State

## Current Status

* Last completed section: Google Sheets-backed Betting tab v1 added with member selection, six weekly picks, option-bank inputs, public overwrite confirmation, and finalized-results lockout.
* Current section in progress: Betting workflow verification against the live `App Data Collection` sheet and Apps Script deployment.
* Next recommended task: Deploy Apps Script and GitHub Pages, then verify `api=betting-data` and one test submission against the live sheet.
* Open risks: Hardcoded Apps Script deployment URL, simple JSONP/GET admin and betting write flows, public trust-based bet submission, fragile Google Sheets tab/column dependencies, fixed matchup sheet row offsets, no automated tests, and duplicated/legacy Apps Script paths.
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
* Deployment sequencing is documented in `README.md` and detailed in `docs/developer-continuity.md`: validate, commit locally, `clasp push`, update the Apps Script Web App deployment, then `git push origin master` for GitHub Pages.

## Frontend / Backend Interaction Model

The hosted frontend in `docs/` calls a hardcoded Apps Script deployment URL:

```js
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwtM_NX16wFOHssvhvP2Iw7FI_7YcVgJ9-5DNbvNOblMxifawE4R-F_eiOLU1NsEggF/exec';
```

Because cross-origin Apps Script requests are constrained, `docs/app.js` uses JSONP. It adds `api=config`, `api=league-data`, betting route names, or admin write route names plus a generated `callback` parameter. `Code.js` validates the callback name and returns JavaScript when JSONP is requested.

Current routes handled by `Code.js#doGet`:

* `api=config` / `config`: frontend branding, season, week, header image, icon URL.
* `api=league-data` / `league-data`: standings/team cards payload.
* `api=betting-data` / `betting-data`: weekly betting prompts, members, current picks, results, and input option metadata from `App Data Collection`.
* `api=submit-bets` / `submit-bets`: public league-member betting write route limited to `App Data Collection!B2:G11`.
* `api=update-team-field` / `update-team-field`: admin-code-protected write route for whitelisted Teams-sheet fields.
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
* `App Data Collection`: weekly betting prompts, member picks, results, input mappings, option banks, and helper-cleared submission range.

`Settings` cells:

* `B2`: season, rendered in the home `Season` pill.
* `B3`: week, rendered in the home `Week` pill.
* `B4`: Sleeper league ID.
* `B5`: app icon URL.

Apps Script Script Properties:

* `ALWAYS_SMOOTH_ADMIN_CODE`: admin code required for app-originated write routes.

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
* Column I: turkey watch.
* Column L: trophies.
* Column M: Sleeper team image.
* Column Q: team MVP name.
* Column S: beer trophies.
* Column V: team MVP image.

`App Data Collection` betting contract:

* `A1`: member/team header.
* `B1:G1`: six weekly bet prompts.
* `A2:A11`: 10 member/team rows.
* `B2:G11`: member submissions; these are the only betting cells written by the app.
* `A12:G12`: weekly results row; any value in `B12:G12` locks submissions.
* `B13:G13`: input mapping for each prompt. Blank or `text` renders a text input; otherwise values match normalized option-bank headers.
* `H1:K1`: option-bank headers.
* `H2:K6`: option values. Two-option banks render as pill buttons; larger banks render as dropdowns.

## Completed Sections / Implemented Features

* Repo continuity/skill system v1: root `SKILL.md` and official artifacts exist and define the entrypoint, operating manual, current state, startup prompt, and skill-maintenance prompt.
* GitHub Pages static frontend for the app shell.
* PWA metadata, app icons, install prompt handling, and service worker caching.
* Light/dark/system theme toggle with local preference.
* Splash screen and mobile-friendly banner.
* Live config load from Apps Script with fallback defaults.
* Live standings load from Apps Script with local cached fallback.
* Home standings header season/week pills are populated from the `Settings` tab via `api=config`; missing Settings values render as `--` instead of hardcoded season/week numbers.
* Team cards sorted by wins and points for.
* Expandable standings cards with supplemental stats: team MVP, mulligan, turkey watch, beer trophies, background team image, and manager photo; trophies display inline with the manager name.
* Expanded team-card detail panels use a light glass overlay in light mode and a darker cinematic overlay in dark mode.
* Press-and-hold admin edit for `Beer Trophies`, writing to `Teams` column S after Apps Script admin-code validation.
* Fixed bottom tab overlay for `Home` and `Betting`; Home wraps the current standings dashboard and Betting renders the weekly betting workflow.
* Betting tab reads `App Data Collection`, lets a league member select their team, renders six weekly prompts from `B1:G1`, maps input types through `B13:G13` and `H1:K6`, confirms overwrites, and submits picks to that member's row in `B2:G11`.
* Apps Script spreadsheet menu for league data operations.
* Sleeper sync functions for members, records, rosters, players, matchups, and draft picks.
* Defensive helpers for Google Drive image URLs and missing settings.
* Documented deployment runbook for changes spanning Apps Script, GitHub Pages, and git.

## In-Progress Work

* Recent work is focused on the standings team-card accordion, including mode-aware expanded-panel styling.
* Weekly matchups are represented in spreadsheet import logic but not yet surfaced as a real frontend feature.
* Weekly betting v1 is implemented but still needs live Apps Script deployment and sheet verification.
* Draft capital/draft results are imported in Apps Script but only represented by placeholder/static UI in the frontend.

## Known Issues

* No automated test suite or lint/build script exists.
* Frontend deploy URL for Apps Script is hardcoded in `docs/app.js`.
* Admin writes use a simple JSONP/GET route protected by `ALWAYS_SMOOTH_ADMIN_CODE`; keep editable fields low-risk and whitelisted.
* Betting submissions use a public JSONP/GET route and trust known league members not to submit for each other; server validation limits writes to the configured member rows and bet columns.
* `fetchMatchupData` writes to hardcoded row `278` and reads week number from `API Data!A19`.
* Expanded team-card styling is split between `docs/index.html` CSS overlays/row glass and `docs/app.js` rendered Tailwind text classes; keep both light/dark paths aligned.
* Root `index.html` and `docs/index.html` can drift because one is Apps Script templated and one is GitHub Pages static.
* `Code2.gs.js` appears to duplicate/precede the more complete `fetchSleeperPlayers` implementation in `Code.js`.
* Apps Script functions use a mix of modern JS, legacy comments, and some stale placeholders.

## Likely Current Priorities

* Keep polishing the standings/team-card experience because that is the visible foundation.
* Build weekly matchups in the GitHub Pages frontend from existing Apps Script/spreadsheet data.
* Add the weekly betting workflow in a way that fits the existing Google Sheets database rather than adding a separate backend.
* Reduce fragile sheet assumptions where practical and document the rest.

## Recommended Next 3 Steps

1. Deploy Apps Script, update the Web App version, and verify `?api=betting-data` returns the expected sheet payload.
2. Publish GitHub Pages and test selecting a member, submitting picks, overwrite confirmation, and results-row lockout.
3. Clean up legacy/duplicated Apps Script paths only after current deployed behavior is confirmed.

## Notes For Future Sessions

Start every session by reading `SKILL.md`, this file, `docs/developer-continuity.md`, and the prompt files. Then inspect `git status`, `docs/app.js`, and relevant `Code.js` sections before making changes. Do not create duplicate continuity docs; improve the official artifacts when new reusable project knowledge is learned.
