# mewo-motion-playground

## Goal
Ship a single-user Bun + Vite React playground that shows 4–5 installable mewo (shadcn registry) motion components with a live prop panel, so Michael can screenshot and record them in one place.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript), Bun scripts, `bunfig.toml` with `minimumReleaseAge = 259200`.
- Init shadcn/ui (minimalist) and install mewo pieces via `bunx shadcn@latest add @mewo/...`.
- Ship these demos on one scrollable page with a simple prop panel each:
  1. Text Shimmer
  2. Spotlight Card
  3. Split Text
  4. One background (Grainient or Pattern Waves)
  5. One scroll reveal (Tile Reveal or Scroll Mask)
- `bun install && bun run dev` must start the app from `apps/mewo-motion-playground/`.
- Capture ≥1 screenshot and ≥1 video of the running UI; attach both to the PR (do not commit large videos).

## Explicitly out of scope
- Auth, multi-page routing, CMS, theming system beyond light/dark if free from scaffold.
- Building custom animation from scratch (use mewo source only).
- New GitHub repo; changes outside `apps/mewo-motion-playground/` (except tracking if instructed).
- Shared monorepo workspace deps.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/mewo-motion-playground/`, add bunfig, install with Bun.
2. Init shadcn; add mewo Text Shimmer, Spotlight Card, Split Text, one background, one scroll reveal.
3. Build a single playground page: each component in a section with a small prop panel (sliders/toggles for 2–4 key props).
4. Polish layout for demo capture (readable dark/light, reduced-motion still usable).
5. Run app, take screenshot + short screen recording; open one PR with both artifacts attached.

## Stack
- **Bun** — runtime, package manager, scripts (repo rule).
- **Vite + React + TypeScript** — lightest official scaffold for a one-screen motion playground; no Next needed.
- **shadcn/ui + mewo registry** — installable source components; mewo is the tech under demo.
- **Tailwind** — comes with shadcn; keep styling boring.

## Deferred
- Extra mewo catalog pieces and carousels — not needed to prove the registry.
- Export/Studio parity with mewo.vercel.app — out of MVP.
- Automated e2e tests — visual demo + PR artifacts are the validation surface.
- Cloudflare Pages preview wiring — optional later.

## Source
Bookmark: https://x.com/csaba_kissi/status/2118239590473666848  
Docs/registry: https://mewo-ui.vercel.app
