# motionclone-remix-studio

## Goal
Ship a single-user Bun + Vite React remix studio that demonstrates MotionClone’s reference-to-editable-code workflow: load a short clip, play the original next to a rebuilt animation on one shared scrubber, tweak text, colors, and timing live, and export the reconstruction as code.

## Reality check
MotionClone itself cannot be the runtime for this demo.

- Canonical repo: https://github.com/blixvip/MotionClone (homepage https://motionclone.lol). As of 2026-11-11 the GitHub user and repo both return 404; setup docs on the official site still point at that URL.
- It is a local **Windows** app, not a JS library. Prerequisites: Git, Python 3.11+, Node.js 22+ with npm, FFmpeg + ffprobe, Google Chrome, and the official Codex CLI with a ChatGPT login (`codex login`, then `.\start.ps1`).
- Documented local workflow needs **no API key**. AI access comes from an interactive Codex / ChatGPT sign-in; account costs and limits apply. There is no documented public rendering API. Optional upstream env `FRAMEFORGE_MODEL` applies only to the official app, not this demo.
- Inputs: public X / YouTube / Vimeo / direct URL or a local file, up to 120 seconds and 250 MB. Output is a HyperFrames project (HTML, assets, fonts, timing), plus rebuilt and comparison MP4s.
- A cloud agent VM cannot complete that pipeline (Windows + interactive Codex login + paid ChatGPT usage + Python/Chrome/FFmpeg). Do not vendor or run MotionClone in this app.

**Working fallback (required):** bundle an original short sample clip and a prebuilt, seekable reconstruction so `bun install && bun run dev` is enough. Live Codex reconstruction is out of MVP. URL / file drop can exist as UI, but must not fake a rebuild of arbitrary footage.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` before any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (use Nova or the closest available preset if “minimalist” is not a flag).
- Add a `.gitignore` covering `node_modules`, `dist`, and `.vite`.
- One page studio:
  1. Drop zone and paste-link field (accept a file or URL for UX).
  2. Default to the bundled sample on first load; `bun install && bun run dev` must show a working comparison immediately.
  3. Side-by-side original (sample video) and rebuilt animation, with **one shared scrubber** seeking both.
  4. Live controls for headline/body text, 2–3 colors, and timing (duration, delay or stagger, easing).
  5. Export the current reconstruction as copyable / downloadable code (scene JS + tokens/CSS, or a small ZIP of those files).
- Author original demo assets only (a 5–8s typography + shapes title clip in `public/samples/`, plus a matching GSAP or equivalent seekable scene). Do not use third-party ads, MotionClone marketing footage, or brand marks.
- If the user pastes a link or drops another file, play it on the original side only if practical, and clearly state that live reconstruction needs the official MotionClone Windows app and a Codex / ChatGPT login. Keep the bundled scene as the editable rebuild; do not pretend an arbitrary clip was cloned.
- `bun install && bun run dev` from `apps/motionclone-remix-studio/` must run with no secrets and no extra system deps.
- Capture ≥1 screenshot and ≥1 video of the running UI; attach both to exactly one PR (do not commit large videos).

## Explicitly out of scope
- Installing, redistributing, or wrapping the MotionClone Windows app or its source.
- Live Codex / ChatGPT reconstruction, `codex login`, or any paid model call.
- YouTube / X / Vimeo downloaders, FFmpeg/Chrome/Python pipelines, or HyperFrames CLI rendering.
- Auth, routing, deploy, or a new GitHub repo.
- Changes outside `apps/motionclone-remix-studio/`.
- Shared monorepo workspace deps.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/motionclone-remix-studio/`, add `bunfig.toml` and `.gitignore`, install with Bun.
2. Init shadcn; build the studio chrome (drop/paste, two-pane stage, shared scrubber, control panel, export).
3. Create the original sample clip and a matching prebuilt reconstruction with a single seekable clock (e.g. GSAP `timeline.seek(t)` plus the video element’s `currentTime`).
4. Wire live text / color / timing controls and a code export of the current scene.
5. Run the app, take a screenshot + short screen recording of scrubbing and a live edit, and open one PR with both artifacts attached.

## Stack
- **Bun** — runtime, package manager, scripts (repo rule).
- **Vite + React + TypeScript** — lightest official scaffold for a one-screen studio; no Next or HyperFrames toolchain needed.
- **shadcn/ui + Tailwind** — default UI; controls for text, color, timing, and export.
- **GSAP (or equivalent seekable timeline)** — HyperFrames uses a timeline engine; a `seek(t)` clock keeps original and rebuild in sync without Windows/Codex/FFmpeg.

## Secrets
None for this demo. Do not add env files or ask for keys. A live MotionClone rebuild would use an interactive Codex / ChatGPT login rather than a named API secret; that path is not in MVP.

## License limits
MotionClone has **no project-wide open-source license**. Official docs state that public source availability is not a blanket reuse or redistribution license. Third-party components in the upstream project keep their own licenses. Do not copy MotionClone source, assets, or branding into this app. Attribute the idea and link the repo and site. Ship only original sample media created for this demo.

## Deferred
- Optional “open in official MotionClone” instructions for users who already have Codex on Windows — not needed to demo the workflow.
- HyperFrames `project.json` export parity and MP4 render — bun-only code export is enough for MVP.
- Automated e2e tests — visual demo + PR artifacts are the validation surface.

## Source
Bookmark: https://x.com/Asteri_eth/status/2115496727893410053  
Repo: https://github.com/blixvip/MotionClone  
Docs: https://motionclone.lol/get-started and https://motionclone.lol/agents
