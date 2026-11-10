# reactdrops-liquid-glass

## Goal
Ship a single-user Bun + Vite React playground that shows ReactDrops' Liquid Glass Orb cycling through AI agent states, with a live control panel, ready for screenshot and video capture.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript), `bunfig.toml` with `minimumReleaseAge = 259200`, then `bun install`.
- Init shadcn/ui (minimalist preset).
- Install the orb: `bunx shadcn@latest add https://reactdrops.dev/r/liquid-glass-orb.json` (pulls GSAP).
- One page: big centered orb plus a control panel (shadcn Select/Slider/Switch) for `state` (idle, listening, thinking, searching, speaking, success, error), `preset` palette, `speed`, `distortion`, `thinkingAnimation`.
- An "Auto demo" toggle that cycles states every few seconds and fakes `audioLevel` with a sine wave during listening/speaking (no mic needed).
- Optional: one sibling ReactDrops component only if it installs cleanly from the registry.
- `bun install && bun run dev` from `apps/reactdrops-liquid-glass/`.

## Explicitly out of scope
- Real microphone or LLM wiring, auth, routing, deploy.
- Re-packaging ReactDrops as a registry/kit (license forbids redistribution in kits); keep its license notice with the installed source.

## Tasks
1. Scaffold app, bunfig, install, shadcn init.
2. Install Liquid Glass Orb from the registry; render it.
3. Control panel + auto-demo state cycler.
4. Layout polish for capture; reduced-motion still readable.
5. Screenshot + video of the orb cycling states; one PR with both attached.

## Stack
- **Bun** — repo rule.
- **Vite + React + TS** — one-screen playground, no framework needed.
- **shadcn/ui** — controls, and the CLI that installs the ReactDrops registry item.
- **GSAP** — dependency of the orb, comes with the install.

## Deferred
- Live mic via `getAudioLevel`, extra drops, Cloudflare preview.

## Source
Bookmark: https://x.com/basit_designs/status/2119451556190044515  
Component: https://reactdrops.dev/components/ai/liquid-glass-orb
