# openbot-coworker-desk

## Goal
Ship a single-user Bun + Vite React lab that demonstrates OpenBot’s decide-then-record loop: give a coworker a task, show the action it proposes and the policy check, require an explicit Approve or Deny, and append the outcome to an audit log — using only a bundled scripted run, with no model keys and no CopilotKit Intelligence.

## Reality check
Verified 2026-11-13 from the [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot) README, [LICENSE](https://github.com/CopilotKit/OpenBot/blob/main/LICENSE), and site [open.bot](https://open.bot).

**What it is.** OpenBot is a modular, self-hostable workspace for AI coworkers from CopilotKit (creators of AG-UI). Each Bot gets a computer of its own (browser, files, tools). **Every action is decided — checked against policy — before it happens, and recorded after.** You can use built-in Bots or connect existing agents through AG-UI, and bring your own models. The official product also has sign-in, tool permissions, approvals, and audit at the API.

**Licenses (must be accurate in the UI).** The **OpenBot application template is MIT**. CopilotKit **Intelligence** (durable conversations, memory, Automatic Learning, enterprise governance services) is **separately licensed** and can run on your machine or Kubernetes: a free local license for personal use on a laptop (desktop setup handles it), a free trial for Kubernetes evaluation, and a production Intelligence license for Kubernetes beyond evaluation (included with OpenBot for Business). This demo must **not** install, vendor, or call Intelligence.

**Why a scripted fallback is required.** The real app expects a model key and, in the official stack, Intelligence beside the backend. A cloud agent, CI, and screenshot/video capture cannot assume those. Do not clone or run the OpenBot server, Docker backend, or Helm chart in this app. Demonstrate the governance loop with original UI and bundled fixtures.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, and `.vite`.
- One-page coworker desk:
  1. A short task field plus a list of **preset tasks** so no LLM is needed (for example: “Add a title to notes.md”, “List the files in the sandbox”, “Draft a changelog line”). Free text may map to the nearest preset; do not call a model.
  2. After the user starts a task (or when the bundled scripted run begins), show the **proposed action** in plain language: tool (files or a sandboxed “browser” preview), target, and a diff or transcript of what would change.
  3. A **policy check** panel that runs *before* anything mutates: allowed tools, path/scope, and whether the action needs approval. Make the pass/fail reason visible.
  4. Explicit **Approve** and **Deny** buttons, disabled until a proposal and policy result exist. Approve is the only path that mutates the **demo sandbox**. Deny writes a denial to the audit log and changes nothing. Neither button may send network requests, touch files outside `apps/openbot-coworker-desk/`, or talk to Intelligence.
  5. An **audit log** that appends every decision: timestamp, task, proposed action, policy result, and approved or denied. The log must persist for the session (memory is enough; localStorage is optional).
  6. A **bundled scripted run** that plays on first load (or via a “Play demo” control) so `bun install && bun run dev` is immediately interesting: propose → policy check → wait for Approve/Deny (the script may pause for the user, or auto-pause with a visible Approve). Include at least one files action that produces a visible sandbox diff.
  7. Footer: OpenBot’s application template is MIT; CopilotKit Intelligence is separately licensed and is **not** used here. This lab is an independent demo and is **not an official CopilotKit product**. Link https://github.com/CopilotKit/OpenBot and https://open.bot.
- All effects stay inside an in-app sandbox (for example `public/sandbox/` or in-memory files seeded from bundled fixtures). No real browser automation, no MCP, no AG-UI server.
- `bun install && bun run dev` from `apps/openbot-coworker-desk/` must run with **no secrets** and no extra system deps.
- **Tests (required):** `bun test` covering at least: (a) a preset task produces a proposal and a policy result before any mutation; (b) Approve applies only to the sandbox and appends an “approved” audit entry; (c) Deny mutates nothing and appends a “denied” audit entry; (d) policy failure or a path outside the sandbox cannot be approved; (e) no model keys, Intelligence tokens, or `VITE_*` secrets are required or leaked. Tests must not need network or API keys.
- Capture ≥1 screenshot and ≥1 video (**under 15 MB**) of the running UI: start the scripted run, show the proposed action and policy check, Approve (or Deny then Approve on a second action), and show the audit log plus the sandbox change. Attach both to **exactly one PR**. Do not commit large videos. **Do not merge the PR.**

## Explicitly out of scope
- Installing, vendoring, or calling the OpenBot server, desktop app, Docker backend, Helm chart, or CopilotKit Intelligence.
- Model API keys, AG-UI connections, MCP tools, SSO, or Kubernetes.
- Real email, Slack, or web sends; writing outside the demo sandbox.
- Implying this app is an official CopilotKit or OpenBot product, or copying their brand UI or marketing assets (a short text attribution is enough).
- Auth, routing, deploy, a new GitHub repo, or changes outside `apps/openbot-coworker-desk/`.
- Shared monorepo workspace deps. Merging the PR.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/openbot-coworker-desk/`, add `bunfig.toml` and `.gitignore`, install with Bun, init shadcn.
2. Build the desk chrome: task field + presets, proposal panel, policy check, Approve/Deny, audit log, and a visible sandbox/diff.
3. Add the bundled scripted run and sandbox fixtures; wire Approve to mutate only the sandbox and Deny to log-only.
4. Write `bun test` coverage for the proposal → policy → approve/deny → audit contract and sandbox isolation.
5. Run `bun install && bun run dev` with no keys, take a screenshot + short screen recording (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, and tests (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold; no Next, Docker, or OpenBot server.
- **shadcn/ui + Tailwind** — task controls, policy and proposal cards, buttons, and the audit log.
- **Bundled scripted fixtures + an in-app file sandbox** — demonstrate decide-then-record without models or Intelligence.

## Secrets
None. Do not add env files, ask for model keys, or mention a license token except in the footer’s Intelligence disclaimer.

## License limits
The OpenBot application template is **MIT** (copyright CopilotKit). Attribution and the license notice are required if any OpenBot source is copied; linking the repo and site is enough if the demo only implements the idea with original UI. **Do not copy CopilotKit Intelligence** or imply this lab includes it. Do not use CopilotKit or OpenBot marks in a way that implies official affiliation. This is an independent demo of a public open-source workflow.

## Deferred
- Optional “open in official OpenBot” notes for users who already have a local install — not needed to show the loop.
- Live AG-UI or MCP adapters — out of MVP.
- Cloudflare Pages preview wiring — optional later.

## Source
Bookmark: https://x.com/alanhoward/status/2119325231026434464  
Repo: https://github.com/CopilotKit/OpenBot  
Site: https://open.bot
