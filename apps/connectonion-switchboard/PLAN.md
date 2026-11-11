# connectonion-switchboard

## Goal
Ship a single-user Bun + Vite React control panel that shows how ConnectOnion’s `co` CLI plans a tool action, previews the diff or transcript, and waits for an explicit Apply (`--yes`) before anything changes, using a no-credentials files/browser path that runs out of the box.

## Reality check
Verified 2026-11-11 from the [GitHub README](https://github.com/openonion/connectonion), [docs](https://docs.connectonion.com), [PyPI](https://pypi.org/project/connectonion/), and the Apache-2.0 LICENSE.

**Install and runtime.** ConnectOnion is a **Python** package, not a Node CLI. Stable on PyPI is **1.9.5**, `requires_python >=3.11` (the quickstart’s “3.10+” is stale). Install with `pip install connectonion` then `co init`, or the official `install.sh` (uses uv, no system Python required). `co commands` lists every command; `co <command> --help` is the reference. The npm package `connectonion` (0.3.4) is **ConnectOnion-TS**, a TypeScript client for talking to Python agents — it is not the `co` CLI. Do not install that npm package for this demo.

**There is no `co files` command.** The docs group “browser & files” as `co browser`, `co gdrive`, `co youtube`, and `co syno`. Local file read/write lives in the Python SDK (`FileTools`, `DiffWriter`), not as a first-class `co files` CLI. Drive and NAS need their own accounts.

**`--yes` preview is real, but not universal.** The README states: “Writes that matter preview until `--yes`.” Official docs confirm that pattern for Linear `create` / `update` / `comment`, Outlook calendar writes (preview JSON plus the exact `--yes` command; “No changes made.”), Canny status changes, `co handoff send` (preview only; `--draft --yes` sends), `co email transfer complete`, and `co syno share create|revoke`. It is **not** a blanket flag on every write: Gmail’s safe path is draft → `review` → `draft send --confirm <token>` (piped `yes` cannot approve), while `co gmail send` can send immediately; `co browser` direct calls (`go_to`, `click`, `type_text_by_selector`) run at once; `co browser import --yes` only skips a confirmation; `co init --yes` only skips setup prompts. Do not teach the UI that every tool waits for `--yes`.

**Auth.** One CLI, **per-provider credentials** stored locally in `~/.co/keys.env` (or a file selected with `co --env-file`), optionally encrypted with `co env set … --secret`. `co init` / `co auth` mints an agent identity and an `OPENONION_API_KEY` with starter credit for managed models — no OpenAI/Anthropic/Google model key is required to start. `co auth google` and `co auth microsoft` run browser OAuth through ConnectOnion’s broker; access/refresh tokens stay on the machine; content requests go to the provider. A missing login prints a recovery command such as `Next: co auth microsoft`. Browser **direct** function calls need no key and default to system Chrome at $0. Quoted natural-language browser tasks (`co browser "find the price"`) and `co ai` / `co rem` investigation need `OPENONION_API_KEY` (or another model key). Linear uses `LINEAR_API_KEY`.

**Rate limits and the skeptic’s question.** ConnectOnion is a unified command line and a local credential store, not a replacement for each service’s own API, login, or rate limits. 1.8.10 even describes Linear, Canny, and Slack as built on “the service’s own API.” Documented wrapper behavior is limited: `co rem` backs off and retries Microsoft Graph HTTP 429 and reads Outlook four messages at a time (Graph’s per-mailbox cap) while Gmail stays at twenty; OpenOnion Mail has `co email quota`; managed models spend OpenOnion credit (`co status`); the browser daemon has connection and 120s deadline caps. Slack rate-limit replies were “not exercised live” in those notes. The demo UI must say this plainly: auth is per tool, stored together; rate limits are mostly the provider’s, with a few documented retries and quotas on top.

**Why a fallback is required.** A cloud agent VM cannot rely on interactive Google/Microsoft OAuth, a visible Chrome window, or an LLM key to turn free-text into a `co` command. `co` itself is a Python install, not a Bun dependency. Direct `co browser --headless` calls are the only realistic live no-auth path, and even those need Python 3.11+ plus Patchright/Chrome.

**Working fallback (required):** `bun install && bun run dev` must show a working preview → Apply flow with **no** `co` binary, no Python, no Chrome, and no secrets. Bundle (1) a sandboxed demo workspace of local text files and (2) recorded, faithfully worded `co` preview transcripts taken from official docs (Outlook/Linear-style preview JSON and “Next: … --yes”, plus a headless `co browser go_to https://example.com` / `get_text` session and a missing-login email “Next: co auth google” path). If `co` is later found on PATH, the app may optionally run the live no-auth browser preview; the bundled recordings remain the default so the app never fails to start.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (use Nova or the closest available preset if “minimalist” is not a flag).
- Add a `.gitignore` covering `node_modules`, `dist`, and `.vite`.
- One-page switchboard:
  1. Tool picker: **Files**, **Browser**, **Email**.
  2. An agent-style task field, plus a short list of preset tasks so no LLM is needed (for example: “Add a title to notes.md”, “Open example.com and show the page text”, “Draft a note about the switchboard”). Free text may map to the nearest preset or show the `co` command it would become; do not call a model.
  3. **Preview** runs first and changes nothing. Show the planned `co` command(s), a structured action list, and a unified diff or command transcript.
  4. An explicit **Apply (--yes)** button, disabled until a preview exists. Apply is the only path that mutates the **demo sandbox**. It must never send real mail, touch `~/.co`, or write outside `apps/connectonion-switchboard/`.
  5. Files and Browser work with no credentials, using the sandbox and/or recorded transcripts (optional live `co browser --headless` if `co` is present).
  6. Email is optional and off by default. Without a login, show the official recovery (`Next: co auth google` / `co auth microsoft`) and a recorded draft preview. Do not send mail even if the user later has a live login; keep Apply disabled on Email or clearly limited to a non-sending draft preview.
  7. A visible “How auth and rate limits work” panel that answers the skeptic with the facts in Reality check (per-provider `keys.env` / `co auth …`, `--yes` is not universal, provider rate limits plus a few documented wrappers).
- `bun install && bun run dev` from `apps/connectonion-switchboard/` must run with no secrets and no extra system deps.
- Capture ≥1 screenshot and ≥1 video (**under 15 MB**) of the running UI: pick Files, run Preview, show the diff, then Apply (--yes). Attach both to exactly one PR (do not commit large videos).

## Explicitly out of scope
- Requiring `co`, Python, Chrome, or any API key for `bun run dev`.
- Calling an LLM to parse tasks, or using quoted `co browser "…"` / `co ai` / `co rem` in the required path.
- Live Google, Microsoft, Linear, Slack, or Gmail writes; real sends; writing outside the demo sandbox.
- Vendoring or rewriting the ConnectOnion Python package, or depending on the npm `connectonion` TypeScript client.
- Auth, routing, deploy, or a new GitHub repo.
- Changes outside `apps/connectonion-switchboard/`.
- Shared monorepo workspace deps.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/connectonion-switchboard/`, add `bunfig.toml` and `.gitignore`, install with Bun.
2. Init shadcn; build the switchboard chrome (tool picker, task field + presets, Preview, action list + diff, Apply (--yes), auth/rate-limit panel).
3. Add a sandbox workspace and recorded `co` preview fixtures; wire Files/Browser so Preview is inert and Apply only updates the sandbox.
4. Wire Email as an optional, login-gated preview that never sends, and keep the skeptic panel accurate.
5. Run the app, take a screenshot + short screen recording (under 15 MB) of preview-then-apply, and open one PR with both artifacts attached.

## Stack
- **Bun** — runtime, package manager, scripts (repo rule).
- **Vite + React + TypeScript** — lightest official scaffold for a one-screen control panel; no Next or Python runtime required.
- **shadcn/ui + Tailwind** — default UI; buttons, tabs, cards, and a diff/transcript pane.
- **Recorded `co` fixtures + a local sandbox** — demonstrate the real preview-until-`--yes` contract without Python, Chrome, or keys.

## Secrets
None required for this demo. Do not add env files or commit values. Names only, for a *live* `co` install the demo does not need:

- `OPENONION_API_KEY` — `co init` / `co auth`; managed models, `co ai`, quoted browser tasks, `co rem`
- Google OAuth record (`GOOGLE_ACCESS_TOKEN`, `GOOGLE_REFRESH_TOKEN`, and related `GOOGLE_*`) — `co auth google`; Gmail, Calendar, Drive, YouTube
- Microsoft OAuth record (`MICROSOFT_ACCESS_TOKEN`, `MICROSOFT_REFRESH_TOKEN`, and related `MICROSOFT_*`) — `co auth microsoft`; Outlook
- `LINEAR_API_KEY` — `co linear`
- Optional model keys if not using OpenOnion credit: `OPENAI_API_KEY` and Anthropic/Gemini equivalents

## License limits
ConnectOnion is **Apache-2.0** (repo LICENSE, copyright 2024 OpenOnion, and PyPI). Attribution and the license notice are required if any ConnectOnion source is copied; linking the repo and docs is enough if the demo only quotes short command examples and original UI. Do not use ConnectOnion marks in a way that implies this app is an official product. The npm `connectonion` package is a separate TypeScript client — do not confuse or vendor it here.

## Deferred
- Optional live `co` preview when the binary is installed and authenticated — nice to have, not needed for the MVP recording.
- A real backend that shells out to `co` for every tool — unsafe and credential-heavy for a cloud demo.
- Automated e2e tests — visual demo + PR artifacts are the validation surface.

## Source
Bookmark: https://x.com/DanKornas/status/2119692969133400510  
Repo: https://github.com/openonion/connectonion  
Docs: https://docs.connectonion.com  
PyPI: https://pypi.org/project/connectonion/ (1.9.5)
