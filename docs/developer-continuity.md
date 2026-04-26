# Developer Continuity

## Session Bootstrap

* Read `README.md` and continuity docs first.
* Inspect current architecture before proposing changes.
* Identify current feature state from code and git status.
* Summarize current state before coding.
* Preserve existing patterns unless a change is clearly justified.
* Check alignment with the product purpose and 10-member league audience.
* Update continuity docs after meaningful progress.

## Workflow Rules

* Treat the repo as the source of truth for code and continuity.
* The lightweight repo-specific skill system is exactly these official artifacts: `README.md`, `docs/project-state.md`, `docs/developer-continuity.md`, `prompts/session-bootstrap-prompt.md`, and `prompts/skill-maintenance-prompt.md`.
* Do not create a packaged Codex `SKILL.md` or extra continuity tree unless explicitly requested; this project currently needs compact repo-local operating docs, not another abstraction.
* Keep GitHub Pages frontend work in `docs/` unless deliberately changing hosting strategy.
* Keep Apps Script/spreadsheet automation in root Apps Script files.
* Prefer small, reviewable changes over broad rewrites.
* Preserve the Google Sheets database workflow.
* Document any new sheet tab, column, env/config, deployment, or API route assumption.
* Update `docs/project-state.md` first when a meaningful section is completed.
* Keep `README.md` concise; put operational detail here and in `docs/project-state.md`.

## Definition Of Done

* Feature works for the intended league-member workflow.
* Edge cases around missing sheet data, empty API payloads, and stale cache are considered.
* Files remain consistent with current vanilla JS / Apps Script patterns.
* Setup/config/deployment implications are documented.
* Google Sheets schema dependencies are documented.
* Product-purpose alignment is considered.
* `docs/project-state.md` is updated.
* This operating manual is updated when new guardrails or fragile areas are discovered.
* Prompt files are refined if recurring startup or maintenance rules change.
* The next recommended task is recorded in `docs/project-state.md`.

## Known Fragile Areas

* `docs/app.js` hardcodes the Apps Script deployment URL. Changing the deployment requires updating `API_BASE_URL`.
* JSONP depends on `Code.js#createApiOutput_` and callback validation; replacing it with normal fetch requires confirming Apps Script CORS/public access behavior.
* `.claspignore` excludes `docs/**`; pushing Apps Script with clasp will not deploy the GitHub Pages frontend.
* `Settings` tab must provide values in `B2:B5` for season, week, league ID, and app icon URL, with fallbacks in `Code.js`.
* `Rosters & Records` must include `Team Name`, `W-L Record`, and `Fpts (Total)` headers for the frontend payload.
* `Rosters & Records` `Streak` falls back to column G if the header is missing.
* `Rosters & Records` display/real name resolution prefers headers like `Display Name`, then falls back to column J.
* `Teams` supplemental data expects headers on row 2 and data from row 3.
* `Teams` supplemental columns are fixed for mulligan, manager photo, trophies, Sleeper team image, team MVP name, beer trophies, and team MVP image.
* `Teams` team-name matching is normalized lower-case string matching against `Rosters & Records` team names.
* Google Drive image links are rewritten to `https://lh3.googleusercontent.com/d/...=w1920`; Drive sharing/permissions can still break images.
* `fetchMatchupData` depends on `API Data!A19` and writes matchup data starting at row `278`.
* `fetchAndPopulateRosters` depends on `Sleeper Players` having `Player ID` and `Full Name` headers.
* `fetchDraftPicksData` hardcodes Sleeper draft IDs for 2023, 2024, and 2025.
* `docs/service-worker.js` caches app shell files; update `CACHE_NAME` when changing cached assets in a way that must invalidate old clients.
* Root `index.html` and `docs/index.html` are separate frontends and can drift.

## Don't Do This

* Do not rewrite stable architecture without clear reason.
* Do not rename Google Sheets tabs or columns in code assumptions without documenting impact.
* Do not change env/config names or deployment URLs casually.
* Do not introduce a new framework/build step when the established static pattern is enough.
* Do not leave completed work undocumented.
* Do not make speculative schema changes without clearly flagging them.
* Do not break continuity by ignoring existing docs and repo conventions.
* Do not make product-shaping decisions that conflict with the 10-member league audience or supplemental-app purpose.
* Do not treat Sleeper lineup/team management as in scope.

## Handoff Notes

* The continuity system is now bootstrapped; future skill maintenance should tighten existing artifacts rather than expanding volume by default.
* The newest visible work appears to be standings card accordion behavior.
* The next product-shaping feature is likely weekly matchups and betting.
* When adding a new frontend feature, first decide whether its data should be part of `league-data` or exposed by a new Apps Script `api` route.
* For betting, prefer a Google Sheets-backed schema that can be audited and edited by the league manager.
* Use defensive UI for missing/empty sheet values because league spreadsheets will be manually maintained.
* If changing Apps Script deployment, update `docs/app.js`, docs, and any GitHub Pages assumptions together.

## Important Architecture/Implementation Decisions

* GitHub Pages is the current primary frontend host because it supports static PWA assets more naturally than Apps Script HTML service.
* Apps Script remains the backend because it is already bound to the Google Sheets database and can call Sleeper.
* Frontend uses JSONP instead of normal `fetch` to avoid cross-origin issues with Apps Script.
* Local caching in `localStorage` is intentional so league members see recent data even if Apps Script is temporarily unavailable.
* The app uses vanilla JS and Tailwind CDN; no build system is currently required.
* Sheet-derived supplemental data should be matched by stable league/team identifiers where possible, but current team-card enrichment matches by team name.

## Product Alignment Notes

* Optimize UX for quick phone usage by known league members.
* League-specific language and visuals are acceptable and useful.
* Prefer clarity over generic configurability.
* Weekly betting should be easy to understand, hard to accidentally misuse, and auditable in Google Sheets.
* Standings, matchup, and betting views should make Sleeper data and supplemental league rules feel like one coherent league hub.
