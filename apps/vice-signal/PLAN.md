# vice-signal

## Goal
Ship a single-page **Vice Signal** night-radio playground: the user tunes pirate stations and each station remaps Leonida’s atmosphere (neon, grain, skyline pulse, motion), brand-first and interactive — not a generic landing page.

## Single-user MVP
- Scaffold Vite + React + TypeScript under `apps/vice-signal/` with Bun, `bunfig.toml` (`minimumReleaseAge = 259200`), and shadcn/ui minimalist preset.
- One full-viewport composition: brand **VICE SIGNAL**, one headline, one short line, tuner controls, and a dominant full-bleed skyline/atmosphere plane.
- 4–5 pirate stations; selecting one crossfades atmosphere tokens (neon hue, grain intensity, pulse speed, skyline glow).
- Motion (`motion/react`): intentional station morph, skyline pulse, and tuner feedback (2–3 animations).
- `bun install && bun run dev` runs from `apps/vice-signal/`.
- ≥1 screenshot + ≥1 video attached to one PR (videos not committed).

## Explicitly out of scope
- Real audio streaming / WebAudio synthesis beyond optional lightweight tick (visual-first).
- Multi-page routing, auth, CMS, maps, 3D engines.
- Card grids, purple-AI gradients, cream/terracotta, broadsheet, glow-pill chrome.
- New GitHub repo; files outside `apps/vice-signal/`.

## Outcome-oriented tasks
1. Scaffold Vite React-TS, bunfig, Bun install; init shadcn minimalist; add Slider (and Button if needed).
2. Define station presets + CSS variables; build full-bleed atmosphere + SVG/CSS skyline plane.
3. Wire tuner UI (station strip + frequency dial) that remaps atmosphere; add Motion morph/pulse/dial.
4. Polish typography (expressive Google fonts), mobile layout, reduced-motion fallback.
5. Run locally, verify desktop + mobile, capture screenshot + recording, open one PR with artifacts.

## Stack
- **Bun** — runtime and package manager (repo rule).
- **Vite + React + TypeScript** — lightest scaffold for a one-screen playground.
- **shadcn/ui (minimalist) + Tailwind** — sparse controls without card chrome.
- **motion/react** — station morph, skyline pulse, dial feedback.
- **Expressive fonts** (e.g. Bebas Neue + Instrument Sans) — brand-first Vice signal, not system defaults.

## Deferred
- Real radio audio / playlist sync — visual atmosphere is the demo.
- Persist last station — unnecessary for a walkthrough.
- Automated e2e — PR media is the validation surface.
