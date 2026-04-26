# Skill Maintenance Prompt

Use this prompt when maintaining the repo's continuity system, operating manual, or project-specific skill layer.

Goal: keep future sessions fast, accurate, and consistent with the current Always Smooth Fantasy Football App architecture.

Smallest useful version: maintain only the official artifacts unless the user explicitly asks for a packaged Codex skill or another docs layer.

Maintenance workflow:

1. Read `README.md`, `docs/project-state.md`, `docs/developer-continuity.md`, and both prompt files.
2. Inspect recent code changes and `git status`.
3. Identify whether any completed work changed product behavior, architecture, setup, deployment, API routes, Google Sheets schema, or fragile assumptions.
4. Update `docs/project-state.md` first, especially the pinned `Current Status` section.
5. Update `docs/developer-continuity.md` with new workflow rules, fragile areas, handoff notes, and don't-do-this guidance.
6. Keep `README.md` concise and link to deeper docs rather than duplicating them.
7. Refine `prompts/session-bootstrap-prompt.md` when startup instructions or recurring repo rules become clearer.
8. Refine this file when the continuity maintenance process itself changes.

Record at minimum:

* What was completed.
* How it works.
* Files changed.
* Setup/config impact.
* Google Sheets schema impact.
* Product/UX impact.
* Unresolved issues.
* Suggested next step.
* Any new workflow rules or prompt improvements.

Guardrails:

* Do not invent architecture that is not present in the repo.
* Do not remove useful historical context unless it is obsolete and replaced with clearer current truth.
* Do not let prompt/docs drift away from code reality.
* Do not create duplicate continuity docs if an existing file can be updated.
* Do not create a separate `SKILL.md` package for this repo-local continuity layer unless explicitly requested.
* Keep docs compact and high-signal; future agents should be able to rehydrate quickly.
