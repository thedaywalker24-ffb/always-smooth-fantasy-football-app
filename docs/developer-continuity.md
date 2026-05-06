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
* The lightweight repo-specific skill system is exactly these official artifacts: `SKILL.md`, `README.md`, `docs/project-state.md`, `docs/developer-continuity.md`, `prompts/session-bootstrap-prompt.md`, and `prompts/skill-maintenance-prompt.md`.
* `SKILL.md` is the canonical entrypoint only; do not create extra packaged skill files or a larger continuity tree unless explicitly requested.
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

## Deployment Runbook

Use this sequence when a change touches both root Apps Script files and the GitHub Pages frontend. The goal is to make the backend contract live before the published frontend depends on it.

1. Review the worktree with `git status --short --branch` and `git diff`.
2. Run local checks that match the touched files, usually `node --check Code.js`, `node --check docs/app.js`, `node --check docs/service-worker.js`, and `git diff --check`.
3. If frontend behavior changed, optionally run `python3 -m http.server 8000 --directory docs` and inspect the app locally.
4. If cached frontend assets changed, bump `CACHE_NAME` in `docs/service-worker.js`.
5. Commit locally with `git add ...` and `git commit -m "..."` so there is a rollback point before deployment.
6. If root Apps Script files changed, run `clasp status` to see what clasp will push.
7. Run `clasp push` to update the Apps Script project. Remember `.claspignore` excludes `docs/**`, so this does not publish the GitHub Pages frontend.
8. Open Apps Script, then use Deploy > Manage deployments > Edit on the existing Web App deployment.
9. Select or create a new version for the pushed code, keep Execute as and Who has access unchanged unless deliberately changing access, then deploy.
10. Confirm the Web App URL did not change. If it did change intentionally, update `API_BASE_URL` in `docs/app.js` and document the change.
11. Verify Apps Script directly with the deployed URL plus `?api=config` and `?api=league-data`; use `?api=league-data&debug=1` when sheet diagnostics are needed.
12. Push the repo with `git push origin master` so GitHub Pages publishes the `docs/` frontend.
13. After GitHub Pages finishes publishing, hard-refresh or reload the installed PWA and confirm the live app shows the new frontend behavior.
14. If the feature added or changed sheet columns, verify the Google Sheet has the expected tab/header/cell values before considering the deployment complete.

If a change is frontend-only, skip the `clasp push` and Apps Script deployment steps. If a change is backend-only, still commit and push git for source-of-truth continuity, but GitHub Pages may not need a visible check beyond confirming existing frontend calls still work.

## Admin Editing

Admin writes from the GitHub Pages app use a simple admin-code gate because the frontend is public and still talks to Apps Script through JSONP.

* The admin code must be stored as Apps Script Script Property `ALWAYS_SMOOTH_ADMIN_CODE`.
* Do not hardcode the admin code in repo files or frontend code.
* Do not reuse a sensitive password because the simple JSONP/GET write flow can expose the code in browser/network history.
* Only whitelisted fields should be writable; the first supported field is `beerTrophies`, which writes to `Teams` column S.
* The frontend activation gesture should remain press-and-hold, not a normal tap/click, to reduce accidental edits.
* Write routes should return structured `{ ok, error }` payloads and the frontend should refresh live standings after successful writes.
* If expanding editable fields, add explicit field-to-column mapping in `Code.js` and update this documentation.

## Known Fragile Areas

* `docs/app.js` hardcodes the Apps Script deployment URL. Changing the deployment requires updating `API_BASE_URL`.
* JSONP depends on `Code.js#createApiOutput_` and callback validation; replacing it with normal fetch requires confirming Apps Script CORS/public access behavior.
* `.claspignore` excludes `docs/**`; pushing Apps Script with clasp will not deploy the GitHub Pages frontend.
* Admin write access depends on Apps Script Script Property `ALWAYS_SMOOTH_ADMIN_CODE`; without it, write routes should fail closed.
* Admin write routes use the existing JSONP/GET pattern for simplicity, so keep them limited to low-risk, whitelisted league-maintenance fields.
* Betting submissions also use JSONP/GET for the public GitHub Pages app. Keep server-side validation strict because the frontend is not authenticated.
* Apps Script write routes can be slow on cold starts. `docs/app.js#fetchJsonp` uses longer timeouts for `submit-bets` and `update-team-field` than for normal read routes.
* `Settings` tab must provide values in `B2:B5` for season, week, league ID, and app icon URL. Season/week intentionally fall back to blank placeholders in the frontend, while league ID and app icon retain backend defaults.
* `Rosters & Records` must include `Team Name`, `W-L Record`, and `Fpts (Total)` headers for the frontend payload.
* `Rosters & Records` `Streak` falls back to column G if the header is missing.
* `Rosters & Records` display/real name resolution prefers headers like `Display Name`, then falls back to column J.
* `Teams` supplemental data expects headers on row 2 and data from row 3.
* `Teams` supplemental columns are fixed for mulligan, manager photo, turkey watch, trophies, Sleeper team image, team MVP name, beer trophies, and team MVP image.
* `Teams` team-name matching is normalized lower-case string matching against `Rosters & Records` team names.
* Google Drive image links are rewritten to `https://lh3.googleusercontent.com/d/...=w1920`; Drive sharing/permissions can still break images.
* `fetchMatchupData` depends on `API Data!A19` and writes matchup data starting at row `278`.
* `fetchAndPopulateRosters` depends on `Sleeper Players` having `Player ID` and `Full Name` headers.
* `fetchDraftPicksData` hardcodes Sleeper draft IDs for 2023, 2024, and 2025.
* Expanded team-card detail styling is split between `docs/index.html` CSS overlays/row glass and `docs/app.js` rendered Tailwind text classes; update both when changing light/dark treatment.
* `docs/service-worker.js` caches app shell files; update `CACHE_NAME` when changing cached assets in a way that must invalidate old clients.
* Root `index.html` and `docs/index.html` are separate frontends and can drift.
* The GitHub Pages frontend has a fixed bottom tab overlay in `docs/index.html`; `docs/app.js#setActiveTab` toggles `[data-tab-panel]` views and lazy-loads Betting data the first time the Betting tab is opened.
* `App Data Collection` powers Betting. `B1:G1` are weekly prompts, `A2:A11` are members, `B2:G11` are submissions, `B12:G12` are results/finalization cells, `B13:G13` maps input types, and `H1:K6` holds reusable option banks.
* Betting option-bank reads should stay limited to `H1:K6`; avoid using `getLastRow()` for those banks because unrelated sheet content can make Apps Script reads unnecessarily slow.
* The app should only write Betting submissions to `App Data Collection!B2:G11`. Do not let app-originated writes touch prompt, results, mapping, or option-bank ranges.

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
* The newest visible work is Betting tab v1: member selection, weekly prompt rendering, option-bank inputs, public submission, overwrite confirmation, and results-row lockout.
* The next product-shaping task is live deployment verification against the real `App Data Collection` sheet.
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
* Public member-based betting submissions are an intentional trust-model match for the prior Glide app; avoid adding login/PIN friction unless the league workflow changes.
* Standings, matchup, and betting views should make Sleeper data and supplemental league rules feel like one coherent league hub.
