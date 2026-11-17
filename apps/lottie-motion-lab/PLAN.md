# lottie-motion-lab

## Goal
Ship a single-user Bun + Vite React lab where the user picks a motion personality (playful, calm, or sharp) and a pattern (card entrance, loading→success button, or staggered dashboard load), then plays that animation with visible, editable duration and easing values and a short “why this timing” note — fully offline, with no paid keys and no LottieFiles account.

## Reality check
Verified 2026-11-17 from [LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill). GitHub SPDX and the repo `LICENSE` file are **MIT**. This is a **markdown agent skill**, not a playback engine: it teaches timing, easing, choreography, and Disney’s 12 principles adapted for UI, with personality archetypes and recipes for entrances, state feedback, and multi-element sequences. Install path upstream is `npx skills add LottieFiles/motion-design-skill`.

**This demo must not run the official skill.** Do not call `npx skills add`, do not shell out to an agent, and do not claim to execute the LottieFiles skill runtime. **Hand-implement a few patterns** in the app from the published principles (duration/easing tables, personalities, entrance / state-feedback / stagger recipes). Keep the surface small — **not a component gallery**.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, `.vite`, `.env`, and `.env.local`. No secrets are required.
- One-page motion playground:
  1. Pick a **personality**: playful, calm, or sharp. Each maps to documented duration/easing defaults (and a short intent line).
  2. Pick a **pattern**: card entrance, a button that goes **loading → success** (and a cheap path to error if it stays small), or a **staggered dashboard load**.
  3. **Play** the animation (replay control required). Show **visible, editable duration and easing** values; changing them and replaying updates the motion. Show a short **“why this timing”** note derived from the selected personality and pattern (not a wall of skill markdown).
  4. Optional and small: a read-only 8-step checklist or principle chips, only if it stays one screen. Do not add a catalog of dozens of components or Lottie files.
  5. All motion is implemented in CSS and/or a boring MIT helper (or a minimal Motion/CSS approach). **No LottieFiles account, no paid Lottie assets, no network fetch of animations.** If any sample motion file is bundled, it must be original or permissively licensed, with the source noted.
  6. Footer: independent demo, **not an official LottieFiles product**, not a skill runner. Attribute **motion-design-skill, MIT**, and link https://github.com/LottieFiles/motion-design-skill.
- `bun install && bun run dev` from `apps/lottie-motion-lab/` must run with **no secrets**, no skill installer, and no extra system deps. Self-contained `package.json`; no monorepo workspace dependencies.
- **Tests (required):** `bun test` covering at least: (a) each personality × pattern pair yields finite duration/easing defaults and a non-empty “why this timing” note; (b) edited duration/easing values are validated and applied to the next play; (c) no skill-install commands, API keys, or LottieFiles account tokens appear in client bundles or scripts.
- **Validation:** Playwright captures **at least one screenshot** of the running UI, and the PR also includes **at least one video** (under 15 MB) of picking a personality and a pattern, playing the motion, editing duration or easing, and replaying. Attach both to **exactly one PR**. Do not commit large videos. **Do not merge the PR.**

## Explicitly out of scope
- Running `npx skills add`, installing the official skill, or claiming official skill-runtime parity.
- A LottieFiles login, paid assets, or a large animation/component gallery (this is not another mewo / ReactDrops gallery).
- Implying official LottieFiles affiliation, or copying substantial official brand artwork.
- Auth, routing, deploy, a new GitHub repo, or changes outside `apps/lottie-motion-lab/`.
- Shared monorepo workspace deps. Merging the PR.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/lottie-motion-lab/`, add `bunfig.toml` and `.gitignore`, install with Bun, and init shadcn.
2. Encode personality defaults and three hand-implemented patterns (card entrance, loading→success button, staggered dashboard) with a replay control.
3. Expose editable duration/easing plus a “why this timing” note, and add the MIT / independent-demo footer.
4. Write `bun test` coverage for defaults, edits, and “no skill runner / no keys.”
5. Add Playwright screenshot capture of the running app, record a short video (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, and tests (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold.
- **shadcn/ui + Tailwind** — personality and pattern pickers, value fields, and the preview stage.
- **CSS and/or a small MIT motion helper** — hand-implemented patterns only; do not pull a full animation IDE or the official skill package.
- **Playwright** — screenshot validation of the running UI (plus a manually or script-recorded video attached to the PR).

## Secrets
None. Do not add LottieFiles credentials or model keys.

## License limits
The upstream skill is MIT. Include attribution and a link to the repo. Do not copy substantial official brand artwork. This lab is an independent demo of a few published principles, not an official LottieFiles product or skill runner.

## Deferred
- Additional patterns, personality archetypes, or a formal “review my animation” linter — not needed to prove personality + pattern + editable timing.
- Cloudflare Pages preview wiring — optional later.

## Source
Bookmark: https://x.com/anstapnever/status/2121943855075635255  
Repo: https://github.com/LottieFiles/motion-design-skill (MIT)
