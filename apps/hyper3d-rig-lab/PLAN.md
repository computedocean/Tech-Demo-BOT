# hyper3d-rig-lab

## Goal
Ship a single-user Bun + Vite React lab that shows Hyper3D Rigging end to end: drop in a GLB, choose auto-rig or type a skeleton prompt, pick stock animation presets, submit through a server-side proxy, poll until the rig is ready, and play the result in a three.js viewer with a bone overlay and clip switcher — with mock mode as the default so the app runs, tests, and records with no API key.

## Reality check
Verified 2026-11-12 from the [Rigging spec](https://docs.hyper3d.ai/en/api-specification/rigging), [Check Status](https://docs.hyper3d.ai/en/api-specification/check-status), [Download Results](https://docs.hyper3d.ai/en/api-specification/download-results), [Errors](https://docs.hyper3d.ai/en/api-specification/errors), and [Quick Start](https://docs.hyper3d.ai/en/get-started/quick-start). Hyper3D Rigging is a **paid, closed HTTP API** from Deemos (Hyper3D / Rodin), not an open-source library. There is no official npm editor to install. The Godot Rodin plugin is Apache-2.0 but only calls Rodin APIs; do not vendor it here.

**Base URL and auth.** All v2 endpoints live at `https://api.hyper3d.com/api/v2`. Protected requests use `Authorization: Bearer <key>`. Official docs name the env var `RODIN_API_KEY`. **This demo must use `HYPER3D_API_KEY` as the canonical server env var.** The server may also read `RODIN_API_KEY` as a fallback alias so official docs still work. Never put either name or value in client code, Vite `VITE_*` env, URLs, or API responses.

**Access and price.** Rigging needs Basic or Full API access (Creator plans include Basic). Each submission costs **0.5 credits**, reserved at submit, charged when packaging succeeds, released on failure or cancel. Rate limits are per account; honor `Retry-After` on HTTP 429.

**Submit (`POST /api/v2/rigging`, multipart/form-data).** Exactly one input mode: a Rodin `asset_id` **or** an uploaded `model` — never both, never neither. This MVP uses **uploaded models only** (`model` file). Supported uploads include `glb` (the drop-zone format for this app). Request `geometry_file_format=glb` so the viewer can load the result in-browser. Optional `image` can help auto template selection and `skeleton_description`.

**Skeleton.** `bone_template` is case-sensitive. `auto` (or omitted) picks the closest of `human`, `quadruped`, `bird`, `dragon`, `kaiju` from an image, or from a clay preview if none is available. For a typed prompt, set `bone_template=custom` and send a non-blank `skeleton_description` (natural language). `hierarchy` (a JSON bone list) is out of MVP unless it is cheap later. Do not send `hierarchy` and `skeleton_description` together.

**Animations.** Optional. `GET /api/v2/rigging_animations` (same bearer key; optional `category`, lowercase and case-sensitive: `human`, `canine`, `bird`, `fish`, `heavyhooved`, `leanhooved`, `lizard`, `rodentia`, `seaturtle`) returns `animation_id`, `category`, `display_name`, `content_description`, `frames`, `duration_seconds`, and `loop`. Pass selected ids in `animation_preset` (up to 10 distinct, case-sensitive). `animation_files` (custom FBX) is out of MVP and mutually exclusive with presets. `in_place=true` is allowed only with preset clips.

**Async contract (must implement faithfully).** A submit response is HTTP 201 even on some application errors. Treat it as accepted only when `error` is absent or empty **and** the top-level `uuid` is non-empty. Then poll `POST /api/v2/status` with `{ "subscription_key": jobs.subscription_key }` — never the top-level uuid or a job uuid. Job states: `Waiting`, `Generating`, `Done`, `Failed`. Start polling after 5 seconds, back off to at most 30 seconds, honor `Retry-After`, stop on any `Failed` job, and impose a deadline (20 minutes is the official example). When every job including packaging is `Done`, call `POST /api/v2/download` with `{ "task_uuid": <submit uuid> }`. Download URLs can expire; fetch promptly and proxy or cache the file on the server for the session. HTTP 400/401/429 are transport errors; do not retry a body-level `error`.

**Why mock mode is required.** A cloud agent, CI, and screenshot/video capture cannot assume a billed Hyper3D key or a long-running official job. Live calls spend credits and can fail for funds, plan, or throttling.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, `.vite`, `.env`, and `.env.local`. Commit `.env.example` with `HYPER3D_API_KEY=` only (no values).
- A small **Bun server in this app folder** is the only process that may talk to `api.hyper3d.com`. The Vite client talks only to same-origin `/api/*`. `bun run dev` must start UI + server together. The key is read from the environment on the server only and must never be returned to the client.
- One-page lab:
  1. Drop zone (and file picker) for a `.glb`. Show the unrigged mesh in the viewer immediately.
  2. Skeleton controls: **Auto** (`bone_template=auto`) or **Prompt** (`bone_template=custom` + `skeleton_description` text). Optional reference image upload for auto/prompt.
  3. Animation preset picker, loaded from `GET /api/v2/rigging_animations` in live mode, or from a bundled catalog fixture in mock mode. Allow multi-select up to 10, plus optional `in_place`.
  4. **Rig** submits through the local server. Show job status (`Waiting` / `Generating` / `Done` / `Failed`, queue length when present). On success, load the rigged GLB.
  5. **three.js viewer:** orbit/pan/zoom, play/pause/reset, a **clip switcher** for animations on the result, and a toggleable **bone overlay** (skeleton helper).
  6. A visible **Mock mode** badge when no `HYPER3D_API_KEY` (or alias) is set. Mock is the **default**. It must implement the same local `/api` contract with realistic submit → delayed poll states → download of a **bundled, permissively licensed** rigged+animated GLB (Khronos glTF Sample Assets or equivalent CC0 / MIT / Apache-2.0; document the license in the app and keep the license file next to the asset). Never use Deemos/Hyper3D marketing models. Mock must be fast enough for screenshots and video (a few seconds of status animation, not a 20-minute wait).
  7. Footer: this is an independent demo of a public API; **not affiliated with Deemos or Hyper3D**. Link the rigging docs. Mention that live submits cost 0.5 credits.
- `bun install && bun run dev` from `apps/hyper3d-rig-lab/` must run with **no key** (mock mode) and no extra system deps.
- **Tests (required):** `bun test` covering at least: (a) submit mapping (auto vs prompt, presets, `geometry_file_format=glb`, reject missing model); (b) HTTP 201 with a body `error` is a failure; (c) status polling uses `subscription_key`, download uses top-level `uuid`, stops on `Failed`, honors backoff; (d) mock mode returns the bundled GLB without calling Hyper3D; (e) API responses and client bundles contain neither `HYPER3D_API_KEY` nor `RODIN_API_KEY` values. Use mocked fetch; tests must not need a live key.
- Capture ≥1 screenshot and ≥1 video (**under 15 MB**) of the running UI in mock mode: drop or load a sample, choose auto or a prompt, pick a clip, show polling, then play the rigged result with bone overlay and clip switcher. Attach both to **exactly one PR**. Do not commit large videos. **Do not merge the PR.**

## Explicitly out of scope
- Exposing the API key to the browser, committing secrets, or logging bearer tokens.
- Rodin `asset_id` generation, text-to-3D, or the rest of the Rodin mesh pipeline.
- Custom `animation_files`, `hierarchy` editors, and FBX/USDZ export (`ue5` / `unity` / `actorcore` skeletons).
- Implying official Deemos / Hyper3D affiliation, or copying their brand UI or marketing assets.
- Multi-user auth, deploy, a new GitHub repo, or changes outside `apps/hyper3d-rig-lab/`.
- Shared monorepo workspace deps. Merging the PR.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/hyper3d-rig-lab/`, add `bunfig.toml`, `.gitignore`, and `.env.example`, install with Bun, init shadcn.
2. Add the Bun API proxy (`/api/rig`, `/api/status`, `/api/download`, `/api/animations`, `/api/mode`) with `HYPER3D_API_KEY` server-side only, faithful polling/download, and default mock mode plus a bundled licensed sample rig.
3. Build the one-page lab: drop zone, auto/prompt controls, preset picker, status panel, three.js viewer with bone overlay and clip switcher, attribution footer and mock-mode badge.
4. Write `bun test` coverage for mapping, 201-error handling, polling identifiers, mock mode, and key non-leakage.
5. Run `bun install && bun run dev` with no key, take a screenshot + short screen recording (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, tests, and the local API server (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold; no Next required.
- **shadcn/ui + Tailwind** — drop zone chrome, buttons, selects, badges, and the status panel.
- **three.js** (plus a thin React wrapper such as `@react-three/fiber` / `@react-three/drei` if they install cleanly) — GLB playback, orbit controls, `SkeletonHelper` bone overlay, and animation clip switching.

## Secrets
Live mode needs `HYPER3D_API_KEY` in the server environment (official docs: `RODIN_API_KEY`; allowed as a server-only alias). Do not commit values or add `VITE_HYPER3D_API_KEY`. Mock mode must be the path used for `bun run dev` in CI and for PR artifacts unless a reviewer explicitly supplies a key.

## License limits
The Rigging API and its output are Deemos/Hyper3D commercial services; do not claim the API, models, or docs are open source. Link the docs and do not copy substantial documentation verbatim. Do not use Deemos or Hyper3D marks in a way that implies this app is an official product. Vendor only a permissively licensed sample GLB and keep its license with the file. three.js and shadcn keep their own licenses; follow them.

## Deferred
- Live `asset_id` flow and texture generation — not needed to demo upload → rig → play.
- Custom FBX clip upload and engine-specific FBX skeletons — GLB is enough for a web viewer.
- Cloudflare preview wiring — optional later.

## Source
Bookmark: https://x.com/DeemosTech/status/2120192217482690735  
Docs: https://docs.hyper3d.ai/en/api-specification/rigging
