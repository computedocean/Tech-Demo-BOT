# ffmpeg-skill-cutroom

## Goal
Ship a single-user Bun + Vite React **agent cut room**: the user drops or picks a short clip, types a plain-English edit, and the app turns that request into an **editable step list of ffmpeg-skill tool calls with real ffmpeg commands**, then runs the plan locally with ffmpeg (or dry-runs when ffmpeg is missing) and shows a before/after preview plus Shorts / Reels / X export presets.

## Reality check
Verified 2026-11-23 from [kajisho5/ffmpeg-skill](https://github.com/kajisho5/ffmpeg-skill) (npm [ffmpeg-skill](https://www.npmjs.com/package/ffmpeg-skill) **4.7.0**). GitHub SPDX and the repo `LICENSE` are **MIT**. ffmpeg-skill is a local Agent Skill and MCP server: **42 typed FFmpeg tools**, a machine-readable **contract**, and a probe → edit (lossless when possible) → check → verify workflow. It needs **no cloud and no API keys**. Official docs used for this plan: [README](https://github.com/kajisho5/ffmpeg-skill/blob/main/README.md), [docs/contract.md](https://github.com/kajisho5/ffmpeg-skill/blob/main/docs/contract.md). Core stable tools (the default MCP `tools/list` set) are `probe`, `cut`, `fit`, `caption`, `loudness`, `export`, `check`, `look`, `audio`, `graphics`, `silence`, and `render`. Every public tool supports `--dry-run` (print ffmpeg command lines, write nothing), `--json`, and `--plan FILE`. Export / check presets include `shorts`, `reels`, and `x` (alias `twitter`). Destination paths that match a declared input are refused; overwriting an existing output requires an explicit overwrite.

**This demo is not ffmpeg-skill.** It is an independent one-screen cut room that models the skill’s **tool-call + command** surface so a person can see the plan, edit it, and run it. Prefer an original TypeScript planner and command builder that emits **faithful ffmpeg-skill tool names and flags** (and the ffmpeg command lines those tools would run for this subset). Reuse MIT source only with attribution and the license notice. Do **not** vendor the whole 42-script tree, the MCP server, or any upstream demo footage (including Veo or phone clips from `demos/footage/`).

**Media must be original.** The bundled sample clip must be **self-generated** (for example `ffmpeg` `testsrc` / `testsrc2` plus `sine`). No copyrighted media, no stock pulls, no upstream demo files. Say in the app that the sample is a synthetic test pattern.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, `.vite`, `.env`, `.env.local`, and a local output/cache dir (e.g. `.cutroom/`). If an optional LLM path exists, commit `.env.example` with empty names only (no values).
- One-page **cut room**:
  1. **Clip in.** Drag-and-drop or file picker for a short local video, **or** choose the bundled synthetic sample. Uploads stay on the machine (workspace / browser temp); they are never uploaded to a remote host in the default path. Show a compact probe of the source when ffmpeg/ffprobe is available (duration, size, fps, audio); when it is not, show file name and a “probe skipped — dry-run mode” note.
  2. **Plain-English edit.** A prompt box with the example (and a one-click chip): `trim to best 15s, burn captions, reframe 9:16, normalize loudness`. **Default planning is deterministic and offline** (rule-based pattern matching / templates). “Best 15s” must be a **documented proxy** (for example the loudest 15s, or ffmpeg-skill `scenes`--style `--rank-by audio` / duration on the source — **not** a semantic quality model). Caption burn uses a bundled or generated timed text / SRT (synthetic cues are fine); do not require Whisper or any speech engine. Optional **server-side only** LLM rewrite of the plan is **off by default** (env key, never `VITE_*`, never in the client). If no key is set, the rule-based plan still works.
  3. **Editable step list of ffmpeg-skill tool calls.** The planner emits an ordered list the user can edit (tweak flags, remove a step, reorder when safe). Each step shows: tool name (`cut`, `fit`, `caption`, `loudness`, `export`, `probe`, `check`, …), typed options (e.g. `--aspect 9:16`, `--fit crop`, `--preset reels`), and the **real ffmpeg command** that step would run. Follow official names and flags for the subset you implement; cite the contract / README. A typical parse of the example prompt should include some form of trim (`cut` and/or `fit --duration` / `--method trim`), caption burn (`caption`), 9:16 reframe (`fit --aspect 9:16`), and loudness (`loudness` to the common −14 LUFS / −1 dBTP target unless a preset says otherwise). `probe` first is encouraged, matching the skill’s workflow.
  4. **Run locally, or dry-run.** If `ffmpeg` (and `ffprobe` when probing) is on PATH, run the plan **locally** in a dedicated output directory. **Never overwrite the source**; refuse a destination that matches a declared input. Prefer argv-style invocation (no `shell: true` with concatenated user text); escape or reject unsafe filter text. If ffmpeg is **missing**, the app stays fully usable in **dry-run mode**: show the step list and commands, write no media, and label the UI clearly. A dry-run toggle should also be available when ffmpeg is present. Do not require `python3` or a global `ffmpeg-skill` install for `bun run dev` to work. A doctor/status chip should say whether ffmpeg is available.
  5. **Before/after preview.** Side-by-side (or swipe) players for the source and the last successful output. In dry-run mode, show the planned output facts (aspect, duration, preset) and a still or placeholder, not a fake “rendered” file.
  6. **Export presets: Shorts, Reels, X.** Buttons or a select that add or retarget an `export --preset shorts|reels|x` step (and optionally a `check --platform` of the same name), using the skill’s delivery idea: 9:16 / platform frame, loudness correction as the preset specifies. The user can still download the file the local run wrote. No real posting to any platform, no OAuth, no upload APIs.
  7. Footer: **independent demo, not the official ffmpeg-skill product**, not affiliated with the upstream project, **runs locally** (or dry-runs), bundled media is a **synthetic testsrc/sine** clip, and optional LLM is off by default. Attribute **ffmpeg-skill, MIT**, and link https://github.com/kajisho5/ffmpeg-skill.
- Ship a **generator script** (e.g. `scripts/generate-sample.ts`) that writes a short bundled clip with `ffmpeg` `testsrc`/`testsrc2` and `sine` (a few seconds, tiny bitrate, with a couple of distinct segments or tones so a “best 15s” proxy is demonstrable; if the sample is shorter than 15s, scale the example to “best 8s” or generate ≥15s). Commit the tiny generated file **and** the script, and note how it was made. If a regenerate step needs ffmpeg, `bun run dev` must still start using the committed sample.
- `bun install && bun run dev` from `apps/ffmpeg-skill-cutroom/` must run with **no secrets**, no paid keys, and no extra required system deps. ffmpeg is **optional** (dry-run fallback). Self-contained `package.json`; no monorepo workspace dependencies.
- **Tests (required):** `bun test` covering at least: (a) the example prompt parses offline into an ordered step list that includes trim, caption burn, 9:16 reframe, and loudness, with ffmpeg-skill tool names/flags; (b) each of those steps exposes a real ffmpeg command string (e.g. trim/crop or scale, subtitles/`ass`/drawtext, `loudnorm` or equivalent); (c) Shorts / Reels / X map to `export --preset shorts|reels|x` (or the documented alias); (d) dry-run mode (ffmpeg treated as missing) returns the plan and commands and does not write an output media file; (e) a destination equal to the source is refused; (f) “best N seconds” is a deterministic proxy (stable on the bundled sample); (g) no API keys in client bundles, and the optional LLM path is off by default.
- **Validation:** Playwright captures **at least one screenshot** of the running UI (prompt, step list with commands, and before/after or dry-run plan visible). The PR also includes **at least one video** (under 15 MB) of choosing the sample clip, submitting the example prompt, showing the editable tool-call list and ffmpeg commands, and either running a local encode with before/after **or**, if ffmpeg cannot be installed in that environment, a clearly labeled dry-run plus an export-preset change. Prefer installing a system ffmpeg so the video can show a real run. Attach both artifacts to **exactly one PR**. Do not commit large videos or large media. **Do not merge the PR.**

## Explicitly out of scope
- Vendoring all 42 upstream scripts, the MCP server, or requiring `npx ffmpeg-skill` / Whisper / faster-whisper.
- Using or fetching upstream demo footage, copyrighted media, or any stock library.
- Real posting, scheduling, or OAuth to Shorts / Reels / X / TikTok / YouTube.
- A full NLE, multicam, HDR pipelines, or GPU encoding as a requirement.
- Auth, routing, deploy, a new GitHub repo, or changes outside `apps/ffmpeg-skill-cutroom/`.
- Shared monorepo workspace deps. Merging the PR. Implying this app is official ffmpeg-skill.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/ffmpeg-skill-cutroom/`, add `bunfig.toml` and `.gitignore`, install with Bun, init shadcn, and add a script plus a committed tiny testsrc/sine sample clip.
2. Build the clip picker, deterministic English → ffmpeg-skill step planner, editable step list with real ffmpeg commands, and Shorts / Reels / X preset actions.
3. Implement local ffmpeg execution in a safe output dir (no source overwrite), dry-run when ffmpeg is missing, and a before/after preview.
4. Write `bun test` coverage for planning, command strings, presets, dry-run, overwrite refusal, deterministic “best N seconds,” and “no keys / LLM off.”
5. Add Playwright screenshot capture of the running app, record a short video (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, and tests (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold.
- **shadcn/ui + Tailwind** — prompt, step list, preview, and preset controls.
- **Local ffmpeg / ffprobe** — optional runtime for probe, encode, and sample regeneration; dry-run if missing.
- **Playwright** — screenshot validation of the running UI (plus a manually or script-recorded video attached to the PR).

## Secrets
None required. Optional server-only LLM key, if implemented, stays in the server environment, is off by default, and is never required. Do not commit tokens.

## License limits
ffmpeg-skill is **MIT**. This desk is original work in the monorepo and is **not** the official product. Reuse upstream source only with attribution and the MIT notice. Bundled media must be original synthetic test patterns. The demo is not affiliated with kajisho5 / ffmpeg-skill. FFmpeg itself is a separate program the user may already have installed; this app does not redistribute it.

## Deferred
- A full contract-driven runner that shells out to every upstream Python tool — a faithful core subset is enough.
- Speech-to-caption engines, karaoke, multicam, and batch watch folders — out of scope on purpose.
- Cloudflare Pages preview wiring — optional later.

## Source
https://github.com/kajisho5/ffmpeg-skill  
Bookmark (approval source): https://x.com/gippp69/status/2124170727473500234
