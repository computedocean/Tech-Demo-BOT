# parallax-studio

## Goal
Ship a single-user Bun + Vite React lab that demonstrates an AI image, video, and audio studio in **mock mode by default**: the user runs a generate flow on bundled sample media, batches a Cinema-style shot list, and reviews a scripted Supercomputer stand-in that proposes steps — with no paid keys and no live cloud computers.

## Reality check
Verified 2026-11-16 from [nickvasilescu/parallax](https://github.com/nickvasilescu/parallax) (MIT, TypeScript) and the bookmark [x.com/nickvasilescu/status/2121662771565879334](https://x.com/nickvasilescu/status/2121662771565879334).

**What it is.** Parallax is an independent, MIT-licensed open-source image, video, and audio studio with a community feed, library, canvas, Cinema (shot-by-shot batch), Shorts, and a Supercomputer agent chat. The author built it after a 15-agent Orgo swarm mapped Higgsfield; the repo is **not affiliated with or endorsed by Higgsfield**. Official quick start: `npm ci` and `PARALLAX_DEMO_SEED=1 npm run dev` on Node.js 22.13+ (upstream uses Node's built-in SQLite). **Without a provider key, every model returns a built-in sample file**, so the product can be clicked through for free.

**Live path (optional, not required).** Real generations go through one gateway, [treg.to](https://treg.to), via `TREG_TOKEN`. Upstream also has Supercomputer live mode (`SUPER_MODE=live` plus Anthropic / Orgo / Composio keys) and a Hermes engine that **has not been run against a live Hermes agent**. Those live paths can cost money. This demo must not enable them.

**Why a focused lab, not a fork.** Upstream is a full Node + npm app, not Bun. This monorepo demo is a self-contained Bun + Vite + shadcn lab under `apps/parallax-studio/`. Do not vendor the entire Parallax tree, claim engine or UI parity, copy Higgsfield branding, or copy upstream sample marketing (`LAUNCH-WEEK` discount badges or similar promo codes).

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, `.vite`, `.env`, and `.env.local`. If the optional Treg path exists, commit `.env.example` with empty names only (no values).
- One-page (or tight tabbed) studio lab:
  1. **Image / video / audio generate flow.** The user picks a studio, a mock model name, and a prompt (include 1–2 presets). Pressing Generate returns **bundled sample media** (at least one image, one short video, and one short audio clip), plus a visible “mock / sample file” badge. Disclose that these are bundled samples, not live model output.
  2. **Cinema-style shot list.** The user adds a few shots (or loads a small bundled storyboard), then runs a **batch render** that fills each shot with the corresponding sample media. Show a simple shot list and a playable or inspectable result strip — not a full NLE.
  3. **Scripted Supercomputer stand-in.** A chat-like pane proposes a short plan (e.g. generate an image, then a clip, then add them to the shot list). The user can accept or dismiss steps. Effects stay inside the app sandbox. This is a fixture/script, not a model and not a Hermes or Orgo session.
  4. **Mock mode is the default** and must work with **no secrets**. Optional **live Treg** is **off by default**, server-side only (e.g. `TREG_TOKEN` read only by a Bun server). Never put the token in client code, `VITE_*` env, URLs, or responses. If no token is set, generation always uses bundled samples. Do not implement Supercomputer live mode, Orgo computers, Composio, or Hermes.
  5. Footer: this is an **independent MIT paper-demo**, **not affiliated with Higgsfield, Orgo, or Nous Research**, not a real model marketplace, and not financial or production billing. Link https://github.com/nickvasilescu/parallax and note the MIT license.
- Vendor bundled sample media that is original, clearly labeled sample/synthetic, or permissively licensed, with the license/source noted in the app. Keep clips short so the repo stays small.
- `bun install && bun run dev` from `apps/parallax-studio/` must run with **no secrets** and no extra system deps.
- **Tests (required):** `bun test` covering at least: (a) mock generate for image, video, and audio returns a bundled sample and never requires a key; (b) a Cinema batch render fills a shot list from samples; (c) the Supercomputer stand-in proposes steps and records accept/dismiss without calling a model; (d) Treg is off by default and no tokens appear in client bundles or default responses; (e) Supercomputer live / Hermes / Orgo paths are not wired up.
- **Validation:** Playwright captures **at least one screenshot** of the running UI, and the PR also includes **at least one video** (under 15 MB) of a generate flow, a Cinema batch, and the stand-in proposing a step. Attach both to **exactly one PR**. Do not commit large videos. **Do not merge the PR.**

## Explicitly out of scope
- Live Treg generations unless a server-side token is later added; even then, mock remains the default. Do not require Treg for `bun run dev`.
- Supercomputer live mode, Orgo cloud computers, Composio, or any Hermes Agent path (Hermes was skipped as a pick; upstream's Hermes engine is untested).
- Forking or vendoring the full upstream Parallax app, or claiming parity with Parallax, Higgsfield, or any commercial studio.
- Higgsfield branding, look-alike logos, or upstream sample promo codes / fake launch discounts.
- A real payment processor, community social network, or developer API/MCP server.
- Auth, routing, deploy, a new GitHub repo, or changes outside `apps/parallax-studio/`.
- Shared monorepo workspace deps. Merging the PR.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/parallax-studio/`, add `bunfig.toml` and `.gitignore`, install with Bun, init shadcn, and vendor short sample image/video/audio with a license/source note.
2. Build the mock generate flow (image, video, audio) and the Cinema shot-list batch render on those samples.
3. Add the scripted Supercomputer stand-in (propose / accept / dismiss) and the independent-MIT disclaimer footer.
4. Write `bun test` coverage for mock generate, batch render, stand-in steps, and “no key / Treg off / no live Supercomputer.”
5. Add Playwright screenshot capture of the running app, record a short video (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, and tests (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold; do not start from the upstream Node/SQLite app.
- **shadcn/ui + Tailwind** — studio tabs, generate controls, shot list, and stand-in transcript.
- **Bundled static media** — mock outputs; no generation SDK required for MVP.
- **Playwright** — screenshot validation of the running UI (plus a manually or script-recorded video attached to the PR).

## Secrets
None required. Optional `TREG_TOKEN`, if implemented, stays in the server environment, is off by default, and is never required. Do not commit tokens. Do not add `ORGO_API_KEY`, `COMPOSIO_API_KEY`, or Hermes credentials.

## License limits
Parallax is MIT. Attribute the project and link the repo. Do not copy substantial Higgsfield brand UI, marketing charts, or promo offers. This lab is an independent demo, not an official Parallax, Higgsfield, Orgo, or Nous product, and not a promise of live model quality.

## Deferred
- Live Treg image/video/audio — optional later, never required for the PR.
- Community feed, wallet, contests, developer MCP, and Horizon long-form video — not needed to prove generate + Cinema + stand-in.
- Cloudflare Pages preview wiring — optional later.

## Source
Bookmark: https://x.com/nickvasilescu/status/2121662771565879334  
Repo: https://github.com/nickvasilescu/parallax (MIT)
