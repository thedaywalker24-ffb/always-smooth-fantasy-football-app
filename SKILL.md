---
name: always-smooth-continuity
description: Canonical repo entrypoint for future agents working on the Always Smooth Fantasy Football App. Use at the start of development sessions and whenever maintaining project continuity.
---

# Always Smooth Continuity Skill

This repo is an active supplemental app for the Always Smooth Dynasty League. It combines Sleeper fantasy football data with league-specific data stored in Google Sheets, with a GitHub Pages frontend and Google Apps Script backend.

Use this file as the entrypoint, then read the detailed continuity artifacts instead of duplicating them here.

## Start Here

1. Read `README.md` for project overview, setup, architecture, and links.
2. Read `docs/project-state.md` for current build state, risks, and next task.
3. Read `docs/developer-continuity.md` for workflow rules, fragile areas, and guardrails.
4. Read `prompts/session-bootstrap-prompt.md` when starting a new implementation session.
5. Read `prompts/skill-maintenance-prompt.md` when updating this continuity system.

## Product Constraints

* Audience: the 10 members of the Always Smooth Dynasty League.
* Core workflow: view league data and place weekly fantasy football bets.
* Data model: Sleeper imports plus supplemental Google Sheets data.
* Boundary: do not replace Sleeper lineup/team management.

## Operating Rules

* Treat the repo as the source of truth.
* Inspect the current architecture and feature state before coding.
* Preserve established vanilla JS, GitHub Pages, Apps Script, and Google Sheets patterns unless change is justified.
* Document any new Google Sheets tab/column, Apps Script route, deployment URL, or config assumption.
* Keep continuity docs compact and high-signal.

## Recurring Agent Rule

Whenever a meaningful feature section is completed:

* Update `docs/project-state.md`.
* Update `docs/developer-continuity.md`.
* Refine `prompts/session-bootstrap-prompt.md` if new recurring workflow rules were learned.
* Refine `prompts/skill-maintenance-prompt.md` if the continuity system itself should evolve.
* Record the next recommended task.
