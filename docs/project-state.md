# Project State

## Current Status

* Last completed section: Upcoming rookie draft board v1; Home now renders a mobile-first offseason draft board below standings using Sleeper draft metadata, traded picks, optional selected picks, and roster/team names from `Rosters & Records`.
* Current section in progress: Apps Script/GitHub Pages deployment verification for the 2026 league ID and upcoming rookie draft board.
* Next recommended task: Deploy Apps Script so `api=draft-board` is live, then publish GitHub Pages and verify the Home-page draft board on mobile.
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
* `docs/service-worker.js` caches the static app shell and uses network-first behavior for the GitHub Pages route, `index.html`, `app.js`, and manifest.
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
* `api=draft-board` / `draft-board`: upcoming rookie draft board payload compiled from Sleeper draft metadata, traded picks, optional selected picks, and `Rosters & Records` roster ID mappings.
* `api=matchups-data` / `matchups-data`: matchup tile payload grouped from the `All Matchups` sheet by `Matchup ID`; incomplete groups are excluded.
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
* `All Matchups`: compiled matchup display source for the Matchups tab; rows are grouped by `Matchup ID`.
* `API Data`: current matchup import uses week number from `A19` and writes to a fixed starting row.
* `Sleeper Players`: player lookup data for roster population.
* `Team Rosters`: generated roster output.
* `Draft Results`: generated draft pick output.
* `Upcoming Draft Board`: generated offseason rookie draft board snapshot written by the Apps Script menu action `Build Upcoming Draft Board`.
* `App Data Collection`: weekly betting prompts, member picks, results, input mappings, option banks, and helper-cleared submission range.

`Settings` cells:

* `B2`: season, rendered in the home `Season` pill.
* `B3`: week, rendered in the home `Week` pill.
* `B4`: Sleeper league ID.
* `B5`: app icon URL.
* `B6`: upcoming Sleeper draft ID for the offseason rookie draft board.

Current 2026 Sleeper league ID:

* `1344465518089748480`

Upcoming rookie draft board config:

* Read the Sleeper draft ID from `Settings!B6`.
* Draft metadata should come from Sleeper `/v1/draft/{draft_id}`.
* Pre-draft boards may have an empty `/v1/draft/{draft_id}/picks` response; treat picks as optional player-selection enrichment, not as the board source.
* Current pick ownership should be compiled from `/v1/draft/{draft_id}/traded_picks`, matching each trade by `round` plus original `roster_id`; `owner_id` is the current roster owner for that pick and `previous_owner_id` is the prior owner.
* For a linear draft, build each round from `slot_to_roster_id` in the draft metadata, then apply traded-pick ownership overrides.
* If `draft_order` contains fewer teams than `slot_to_roster_id`, treat the missing draft slots as intentionally unresolved. Display those picks as TBD and show the unresolved candidate teams from the missing slots.
* Resolve all Sleeper roster IDs from `slot_to_roster_id`, `owner_id`, and `previous_owner_id` through the `Rosters & Records` tab `Roster ID` column to display league team/manager names.

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

Draft-board roster ID resolution:

* Use `Roster ID` to map Sleeper draft ownership IDs back to the `Rosters & Records` row, then display `Team Name` and `Display Name` as available.

`Upcoming Draft Board` generated columns:

* `Round`
* `Pick Label`
* `Pick No`
* `Pick In Round`
* `Draft Slot`
* `Original Roster ID`
* `Original Team`
* `Original Manager`
* `Current Roster ID`
* `Current Team`
* `Current Manager`
* `Previous Roster ID`
* `Previous Team`
* `Previous Manager`
* `Status`
* `Candidate Teams`
* `Candidate Roster IDs`
* `Selected Player`
* `Selected Player ID`
* `Updated At`

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
* `B13:G13`: input mapping for each prompt. Blank or `text` renders a text input; `team_choice` / `team_options` / manager-team aliases render an avatar dropdown from `A2:A11` plus `N2:N11`; otherwise values match normalized option-bank headers.
* `H1:K1`: option-bank headers.
* `H2:K6`: option values. Two-option banks render as pill buttons; larger banks render as dropdowns.
* `N2:N11`: league member profile photos for Betting member cards and selected-member form headers.

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
* Betting tab reads `App Data Collection`, lets a league member select their team, renders member profile photos from `N2:N11`, renders six weekly prompts from `B1:G1`, maps input types through `B13:G13`, `team_choice`, and `H1:K6`, confirms overwrites, and submits picks to that member's row in `B2:G11`.
* Betting member picker uses compact two-column mobile tiles so all 10 league profiles are faster to scan before entering the betting form; the grid uses a named CSS class instead of dynamic Tailwind-only column utilities, and member tiles reuse the home-page pink/rose/orange top accent.
* Betting team/manager avatar dropdowns use a fixed body-level menu portal so expanded lists can overlap lower bet cards on Android and other mobile browsers.
* Betting submissions use the submit response to refresh the selected member form instead of immediately making a second sheet read.
* Matchups tab v1 reads the `All Matchups` sheet, groups rows by `Matchup ID`, excludes incomplete groups, and renders each active matchup as a side-by-side photo-backed tile with `Photo`, `Record`, and `Week Points`.
* Upcoming rookie draft board v1 appears on Home below League Standings during the offseason; it reads `Settings!B6`, builds linear pre-draft pick slots from Sleeper `slot_to_roster_id`, applies `traded_picks`, highlights intentionally unresolved draft-order slots as TBD with candidate teams, maps roster IDs through `Rosters & Records`, caches the payload locally, and displays optional selected-player data when `/picks` is populated. The League Standings header includes a Draft Board shortcut. On mobile, Round 1 is expanded by default and later rounds are collapsed by default; tablet/desktop keeps all rounds visible.
* Removed the original GitHub Pages explainer tiles (`Install Friendly` and `Live Sheet Data`) from the bottom of Home so the page stays focused on league content.
* Apps Script menu action `Build Upcoming Draft Board` creates/refreshes a normalized `Upcoming Draft Board` sheet snapshot using the same compiled draft-board payload.
* Apps Script spreadsheet menu for league data operations.
* Sleeper sync functions for members, records, rosters, players, matchups, and draft picks.
* Defensive helpers for Google Drive image URLs and missing settings.
* Documented deployment runbook for changes spanning Apps Script, GitHub Pages, and git.

## In-Progress Work

* Recent work is focused on 2026 offseason setup and the Home-page upcoming rookie draft board.
* Weekly matchups are represented in spreadsheet import logic but not yet surfaced as a real frontend feature.
* Weekly betting v1 is implemented and has had live phone testing.
* Draft capital/draft results are imported in Apps Script; upcoming rookie draft board v1 is now surfaced on Home and needs live deployment verification.

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

* Finish verifying and publishing the current Betting tab polish on GitHub Pages/PWA.
* Build weekly matchups in the GitHub Pages frontend from existing Apps Script/spreadsheet data.
* Continue expanding the weekly betting workflow only within the existing Google Sheets-backed contract.
* Reduce fragile sheet assumptions where practical and document the rest.

## Recommended Next 3 Steps

1. Publish GitHub Pages and verify the Android PWA picks up the latest service worker/cache version.
2. Test the compact Betting member picker, tile accent, team-option avatar dropdown, and a normal submission flow on phone.
3. Build the next frontend section, likely weekly matchups, using existing Apps Script/spreadsheet data.

## Notes For Future Sessions

Start every session by reading `SKILL.md`, this file, `docs/developer-continuity.md`, and the prompt files. Then inspect `git status`, `docs/app.js`, and relevant `Code.js` sections before making changes. Do not create duplicate continuity docs; improve the official artifacts when new reusable project knowledge is learned.
