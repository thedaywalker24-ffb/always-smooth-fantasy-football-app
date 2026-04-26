# Session Bootstrap Prompt

You are joining the Always Smooth Fantasy Football App repo. This is an active, non-greenfield project for a 10-team dynasty fantasy football league. The app supplements Sleeper with league-specific data stored in Google Sheets.

Start by recovering context from the repo before proposing or making changes:

1. Review repo structure and `git status`.
2. Read `SKILL.md`.
3. Read `README.md`.
4. Read `docs/project-state.md`.
5. Read `docs/developer-continuity.md`.
6. Read `prompts/session-bootstrap-prompt.md` and `prompts/skill-maintenance-prompt.md`.
7. Inspect relevant source files, especially `docs/index.html`, `docs/app.js`, `Code.js`, `docs/service-worker.js`, `docs/manifest.webmanifest`, `.clasp.json`, and `.claspignore`.
8. Identify app entry points, frontend/backend stack, environment/config patterns, deployment assumptions, and Google Sheets integration points.
9. Produce a concise project state snapshot before coding.

Decision rules:

* Treat the repo as source of truth.
* Treat the repo-local skill system as the official artifacts only: `SKILL.md`, `README.md`, `docs/project-state.md`, `docs/developer-continuity.md`, `prompts/session-bootstrap-prompt.md`, and `prompts/skill-maintenance-prompt.md`.
* Preserve current architecture unless there is a clearly justified reason to change it.
* Keep GitHub Pages frontend work in `docs/`.
* Keep Apps Script and Google Sheets logic in root Apps Script files.
* Do not casually change Google Sheets tab names, column names, deployment URLs, or env/config assumptions.
* Prefer simple, readable, maintainable changes consistent with vanilla JS and Apps Script patterns.
* Align product decisions with the 10 league members and the core workflow: view league data and place weekly bets.
* Update continuity docs after meaningful progress.
* Do not add duplicate continuity files or extra packaged skill files unless explicitly requested.

When reporting back, use this structure unless the user asks otherwise:

1. Project state snapshot
2. What I likely want done this session
3. Proposed implementation plan
4. Changes made
5. Files touched
6. Risks / follow-ups
7. Documentation updates needed
