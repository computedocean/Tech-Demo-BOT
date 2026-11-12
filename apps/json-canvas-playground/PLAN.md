# json-canvas-playground

## Goal
Ship a single-user Bun + Vite React playground that implements the JSON Canvas 1.0 open format: pan and zoom an infinite canvas, add/edit/connect text, file, link, and group nodes with labeled edges, keep a live JSON panel in sync, and import/export valid `.canvas` files — with no Obsidian install and no API keys.

## Reality check
Verified 2026-11-12 from the [JSON Canvas 1.0 spec](https://jsoncanvas.org/spec/1.0/), [jsoncanvas.org](https://jsoncanvas.org/), the [obsidianmd/jsoncanvas](https://github.com/obsidianmd/jsoncanvas) repo (MIT `LICENSE`, 3,871 stars, not archived), and the official [announcement](https://obsidian.md/blog/json-canvas/).

**What it is.** JSON Canvas is an open **file format**, not an npm editor or an Obsidian plugin. Files use the `.canvas` extension and contain optional `nodes` and `edges` arrays. The spec is conservative (v1.0) and is explicitly free to implement as an import, export, or storage format in any app. The GitHub repo is the spec site plus `sample.canvas`; there is no official interactive editor package to install.

**Document model (must be the source of truth).**
- Every node has required `id` (unique string), `type` (`text` | `file` | `link` | `group`), and integer `x`, `y`, `width`, `height`. Optional `color` is a `canvasColor`: a hex string such as `"#FF0000"`, or a preset `"1"`–`"6"` (red, orange, yellow, green, cyan, purple). Preset *values* are left to the app; map them to a clear, consistent palette.
- Type-specific fields: `text` (required Markdown string) for text nodes; `file` (required path) and optional `subpath` (must start with `#`) for file nodes; `url` (required) for link nodes; optional `label`, `background` (path), and `backgroundStyle` (`cover` | `ratio` | `repeat`) for group nodes.
- Edges have required unique `id`, `fromNode`, and `toNode`. Optional `fromSide` / `toSide` are `top` | `right` | `bottom` | `left`. `fromEnd` defaults to `none`, `toEnd` defaults to `arrow`; both are `none` | `arrow`. Optional `color` and `label`.
- **Z-index is array order:** the first node in `nodes` is drawn at the bottom, the last on top. Exported JSON must preserve this.

**Sample and IDs.** The official `sample.canvas` uses 16-character hex ids, mixed node types (group, file, text), integer positions (including negatives), and edges with `fromSide` / `toSide`. New nodes in this demo should use unique opaque string ids (16-character hex is fine).

**No official runtime.** Do not require Obsidian, a vault, or any Obsidian CLI/skills package. File and background `path` values are display strings (and, if they happen to match a bundled public asset, may be previewed). The demo must run entirely in the browser.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (use Nova or the closest available preset if “minimalist” is not a flag).
- Add a `.gitignore` covering `node_modules`, `dist`, and `.vite`.
- One-page playground:
  1. **Infinite canvas** with pan and zoom (scroll/pinch zoom, drag empty space to pan, a fit-to-content or reset-view control).
  2. **Add, select, move, resize, and edit** all four node types: text (Markdown, rendered in the node, editable), file (path + optional `#subpath`, shown as a path chip / placeholder; preview only if a bundled asset matches), link (URL, shown as a card; may open in a new tab), and group (labeled container; optional background path + `backgroundStyle`).
  3. **Connect nodes with edges:** click-drag from a side handle (`top` / `right` / `bottom` / `left`), set `fromEnd` / `toEnd` (`none` or `arrow`; defaults as in the spec), and add an optional edge **label** and color. Selecting an edge or node opens a small inspector for its spec fields.
  4. **Live JSON panel** beside the canvas. Canvas edits update the JSON immediately. Editing the JSON updates the canvas when the document is valid; invalid JSON or spec errors are shown in place and must not clobber a still-valid canvas.
  5. **Starter examples** loadable in one click, bundled as `.canvas` files: a **mind map**, a **flowchart**, and a **project board**. First load should show one of these so `bun install && bun run dev` is immediately interesting. Include only original demo content (no third-party vaults or brand marks).
  6. **Import / export** `.canvas` files (file picker + download, plus copy-JSON). Import and export run a **spec validator** (required fields, unique ids, allowed enums, integer geometry, `subpath` prefix, edge endpoints that exist, known `type` values). Show a clear error list on failure; never write invalid JSON on export.
  7. A short footer or about line: JSON Canvas is an MIT open format; this app is a demo and is **not affiliated with Obsidian**. Link https://jsoncanvas.org/spec/1.0/ and https://github.com/obsidianmd/jsoncanvas.
- `bun install && bun run dev` from `apps/json-canvas-playground/` must run with no secrets, no Obsidian, and no extra system deps.
- Capture ≥1 screenshot and ≥1 video (**under 15 MB**) of the running UI: load a starter, pan/zoom, add or edit a node, connect a labeled edge, and show the live JSON (plus an import or export if it fits). Attach both to exactly one PR (do not commit large videos). Do not merge the PR.

## Explicitly out of scope
- Obsidian, Obsidian CLI, `obsidian-skills`, vaults, or any plugin host.
- API keys, accounts, auth, multi-page routing, or deploy.
- Vendoring or implying this is an official Obsidian or JSON Canvas product.
- A full whiteboard suite (freehand ink, comments, multiplayer, version history, realtime sync).
- Shared monorepo workspace deps, a new GitHub repo, or changes outside `apps/json-canvas-playground/`.
- Committing large videos; merging the PR.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/json-canvas-playground/`, add `bunfig.toml` and `.gitignore`, install with Bun.
2. Init shadcn; add a TypeScript document model and a strict JSON Canvas 1.0 validator (parse, type-check, and round-trip the official `sample.canvas` shape plus the starter examples).
3. Build the canvas (pan/zoom, all four node types, labeled edges with sides and arrow ends) with the JSON document as source of truth, using a prebuilt node-graph library if it can be mapped cleanly (see Stack).
4. Add the live JSON panel (bidirectional, with validation errors), the three starter examples, and import/export of `.canvas` files.
5. Polish for capture (readable light/dark, keyboard: delete selection, undo/redo if cheap), add the attribution footer, take a screenshot + short screen recording (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts (repo rule).
- **Vite + React + TypeScript** — lightest official scaffold for a one-screen playground; no Next or Obsidian runtime.
- **shadcn/ui + Tailwind** — default UI; toolbar, inspector, buttons, and the JSON / error panel.
- **`@xyflow/react` (React Flow, MIT)** — prebuilt pan/zoom, nodes, edges, and handles so the demo does not hand-roll a graph editor. Keep a JSON Canvas document as the only source of truth and map to/from React Flow; do not persist React Flow’s own schema. If the mapping cannot stay spec-faithful (z-index = array order, `fromSide`/`toSide`, `fromEnd`/`toEnd` defaults, group nodes), fall back to a small custom SVG/CSS canvas rather than shipping a leaky model.
- **A small Markdown renderer (e.g. `react-markdown`)** — text nodes are Markdown per the spec.

## Secrets
None. Do not add env files, ask for keys, or call any network API (link nodes may open a URL the user clicks; do not fetch them at load).

## License limits
JSON Canvas and the `obsidianmd/jsoncanvas` repo are **MIT**. Attribution and the license notice are required if any spec-site source or `sample.canvas` is copied; linking the spec and repo is enough if the demo only implements the format and ships original examples. Do not copy Obsidian branding, product UI, or trademarks in a way that implies official affiliation. This playground is an independent implementation of a public open format. React Flow and shadcn keep their own licenses; follow them.

## Deferred
- Full official `sample.canvas` file-preview parity (readme.md / logo.svg inside nodes) — path chips are enough for MVP; optional if bundled assets are easy.
- Collaborative editing, ink, and Obsidian-style embeds — not needed to prove the format.
- Automated e2e tests — visual demo + PR artifacts are the validation surface. Keep a unit-tested validator if it is cheap.
- Cloudflare Pages preview wiring — optional later.

## Source
Bookmark: https://x.com/humzaakhalid/status/2117976409125564822  
Spec: https://jsoncanvas.org/spec/1.0/  
Repo: https://github.com/obsidianmd/jsoncanvas  
Site: https://jsoncanvas.org
