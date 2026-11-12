# JSON Canvas Playground — Plan

**Goal:** A single-user playground that treats [JSON Canvas 1.0](https://jsoncanvas.org/spec/1.0/) as the source of truth: edit text, file, link, and group nodes on an infinite canvas, and see the same document live as JSON.

This is an independent MIT demo of the open format. It is not affiliated with Obsidian. The spec lives at jsoncanvas.org.

## Single-user MVP

- Scaffold with `bunx create-vite` (React + TypeScript, `--no-immediate`), then `bunfig.toml` with `[install] minimumReleaseAge = 259200` before `bun install`.
- shadcn/ui via a minimal preset (Vega / stone / Inter, the minimalist collection preset, falling back to `base-nova` if the preset code is rejected).
- Infinite pan/zoom canvas.
- Add, move, resize, and edit text, file, link, and group nodes. Connect them with edges.
- Edges support labels, `fromSide` / `toSide`, and `fromEnd` / `toEnd` (`none` | `arrow`), including spec defaults (`fromEnd` none, `toEnd` arrow) when those keys are omitted.
- Z-order is the `nodes` array order: earlier nodes paint underneath. Controls reorder that array only.
- Groups are visual rectangles in absolute coordinates. They do not reparent children.
- A side-by-side JSON panel. Canvas edits rewrite the JSON; valid JSON edits update the canvas immediately. Invalid JSON shows errors and leaves the last valid document on the canvas.
- Starter documents: mind map, flowchart, and project board, as `.canvas` files.
- Import and export `.canvas` / `.json`. Import runs a strict validator and refuses documents the spec does not allow.
- File paths, subpaths, link URLs, and group backgrounds are stored and shown. Nothing is fetched or read from disk or the network.
- `bun install`, `bun run dev`, and `bun run build` succeed with no API keys.

**Out of scope:** Obsidian integration, real filesystem or image loading, collaboration, accounts, a server, and any dependency that needs a network call at runtime.

## Tasks (vertical slices)

1. Spec module: types, canonical stringify, strict validator, three example documents, unit tests for the validator.
2. Canvas: map the document onto `@xyflow/react` without inventing JSON fields (absolute positions, side handles, arrow ends, array z-index). Custom canvas only if that mapping cannot stay spec-faithful.
3. Editor chrome: add-node tools, inspector, live JSON panel, example switcher, import/export.

## Stack

- Bun — repo runtime and package manager.
- Vite + React + TypeScript — official `create-vite` React template; one screen, no server framework.
- shadcn/ui (minimal preset) — buttons, fields, and badges for the chrome.
- `@xyflow/react` — pan, zoom, drag, resize, and connections. Used only as a view: node `x`/`y`/`width`/`height` stay integers, handles map to the four sides, markers map to `fromEnd`/`toEnd`, and `zIndex` follows array order (`elevateNodesOnSelect` off, no `parentId`).
- Bun test — validator only.

## Deferred

- Loading `file` or `background` bytes — the spec stores paths, and this demo must not touch the network.
- Rich Markdown (tables, raw HTML) — a small safe subset is enough to show that text nodes are Markdown.
- Multi-select and undo stacks — single selection plus the JSON panel covers editing.
