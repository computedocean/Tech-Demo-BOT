# archify-diagram-studio

## Goal
Ship a single-user Bun + Vite React lab that turns a short system description (or a preset) into an Archify-style interactive architecture diagram — pan/zoom, click a node for details, highlight a path — and applies follow-up edits such as “add a Redis cache,” fully offline by default, with no paid keys.

## Reality check
Verified 2026-11-16 from [tt-a1i/archify](https://github.com/tt-a1i/archify). GitHub SPDX and the repo `LICENSE` file are **Apache-2.0**. Homepage: [archify.si](https://archify.si). JavaScript agent skill (stable 3.2.0) for Claude Code, Codex, Cursor, and OpenCode. Official copy: start with an idea, question, or plan; the agent turns it into a **self-contained interactive HTML** you can explore, customize, and share. Output can be opened in a browser with no Archify install. Follow-ups in the README include “Add authentication”, “Highlight the cache-miss path”, and “Switch to the light theme.” Path exploration is a first-class interaction (probe a directed route). Archify is **not** a general-purpose drawing editor or a Mermaid theme.

Official README: Archify is free and open source; **third-party online services and paid plans are operated by their respective providers and do not represent Archify.** This demo must not imply it is an official Archify product or a hosted Archify service.

**Why a focused lab, not a fork.** Upstream is an agent skill plus a Node CLI that validates and delivers HTML artifacts from workflow JSON. This monorepo demo is a self-contained Bun + Vite + shadcn lab under `apps/archify-diagram-studio/`. Do not vendor the entire Archify tree, ship the skill installer, or claim renderer or visual parity with official showcase artifacts.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, `.vite`, `.env`, and `.env.local`. If an optional LLM path exists, commit `.env.example` with empty names only (no values).
- One-page diagram studio:
  1. A **prompt box** plus **3–4 preset systems** (for example a web app with API and database, a queue/worker pipeline, an auth-gated service, and a simple event-driven flow). Choosing a preset or submitting a recognized description generates a diagram immediately.
  2. An **Archify-style interactive architecture diagram**: pan and zoom the canvas, **click a node** to open details (name, role, connections), and **highlight a path** (for example request → API → cache miss → database). Interactions must be visible and keyboard- or click-reachable.
  3. **Follow-up edits** that modify the current diagram, including “add a Redis cache” (and 1–2 other cheap edits such as “add authentication”). The graph updates in place — new node(s) and edges — rather than resetting to a blank canvas. Unrecognized edits fail clearly and do not invent silent structure.
  4. **Mock/template generation is the default** and must work with **no secrets**: a deterministic template/parser maps presets and common phrases onto a structured graph (nodes, edges, detail copy, highlightable paths). Optional **server-side only** LLM rewrite is **off by default** (e.g. `ARCHIFY_DIAGRAM_LLM_KEY` or a clearly named key, read only by a Bun server). Never put the key in client code, `VITE_*` env, URLs, or responses. If no key is set, generation and edits still use the templates.
  5. Footer: this is an **independent demo**, **not affiliated with Archify**, not an official skill or hosted service. Attribute **Archify, Apache-2.0**, and link https://github.com/tt-a1i/archify and https://archify.si.
- `bun install && bun run dev` from `apps/archify-diagram-studio/` must run with **no secrets** and no extra system deps. Self-contained `package.json`; no monorepo workspace dependencies.
- **Tests (required):** `bun test` covering at least: (a) each preset (and a plain-words prompt that matches a template) produces a structured graph suitable for the interactive view; (b) applying “add a Redis cache” (and one other follow-up) mutates the graph with the new node/edges; (c) path highlighting selects a real directed route and can be cleared; (d) unrecognized input/edits fail clearly; (e) no API keys appear in client bundles or default responses, and the optional LLM path is off by default.
- **Validation:** Playwright captures **at least one screenshot** of the running UI, and the PR also includes **at least one video** (under 15 MB) of choosing a preset or entering a prompt, panning/zooming, opening a node’s details, highlighting a path, and applying “add a Redis cache.” Attach both to **exactly one PR**. Do not commit large videos. **Do not merge the PR.**

## Explicitly out of scope
- Installing or running the official Archify skill/CLI, or vendoring its full renderer and showcase pipeline.
- Requiring an LLM key for `bun run dev`.
- Claiming visual or engine parity with official Archify HTML artifacts, or copying substantial official brand UI or marketing diagrams.
- Implying affiliation with Archify, or with third-party hosted/paid Archify-branded services.
- A general drawing editor, Mermaid playground, codebase scanner, or export-to-share hosting.
- Auth, routing, deploy, a new GitHub repo, or changes outside `apps/archify-diagram-studio/`.
- Shared monorepo workspace deps. Merging the PR.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/archify-diagram-studio/`, add `bunfig.toml` and `.gitignore`, install with Bun, and init shadcn.
2. Build the prompt/presets, deterministic templates, and the interactive diagram (pan/zoom, node details, path highlight).
3. Apply follow-up edits in place, including “add a Redis cache,” and add the Apache-2.0 / independent-demo footer.
4. Write `bun test` coverage for template generation, edit application, path highlighting, clear failure cases, and “no key in the client.”
5. Add Playwright screenshot capture of the running app, record a short video (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, and tests (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold; do not start from the upstream Node CLI.
- **shadcn/ui + Tailwind** — prompt, presets, detail drawer, and edit field.
- **A small canvas** (SVG or a boring MIT graph view) — pan/zoom, nodes, edges, and path highlight; do not pull a full diagram IDE.
- **Playwright** — screenshot validation of the running UI (plus a manually or script-recorded video attached to the PR).

## Secrets
None required. Optional server-only LLM key, if implemented, stays in the server environment, is off by default, and is never required. Do not commit tokens.

## License limits
Archify is Apache-2.0. Include the required attribution and link the repo (and LICENSE). Do not copy substantial official artwork, lockup marks, or showcase HTML as if this were an official build. This lab is an independent demo, not an official Archify product or hosted service.

## Deferred
- Full official Archify validation/delivery CLI and explainer-page layout — not needed to prove prompt → interactive diagram → follow-up edit.
- Codebase import / “map this repo” — out of MVP.
- Cloudflare Pages preview wiring — optional later.

## Source
Bookmark: https://x.com/tom_doerr/status/2121961437559980092  
Repo: https://github.com/tt-a1i/archify (Apache-2.0)  
Site: https://archify.si
