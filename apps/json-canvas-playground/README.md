# JSON Canvas Playground

An independent, single-user editor for the [JSON Canvas 1.0](https://jsoncanvas.org/spec/1.0/) format. The `.canvas` document is the source of truth: the infinite canvas and the JSON panel edit the same file.

This project is not affiliated with Obsidian. It is an MIT demo of the open format published at jsoncanvas.org.

## Run

```bash
bun install
bun run dev
```

`bun run build` typechecks and writes `dist/`. `bun test` checks the strict validator and the starter files.

No API keys, no network fetches, and no filesystem reads. File paths, link URLs, and group backgrounds are stored and shown as text.

## What it edits

- Text, file, link, and group nodes, with integer `x`, `y`, `width`, and `height`
- Edges with labels, `fromSide` / `toSide`, and `fromEnd` / `toEnd`
- Z-order as the order of the `nodes` array (earlier nodes paint underneath)
- Preset colors `"1"`–`"6"` and `#RRGGBB`

Omitted `fromEnd` means `none`. Omitted `toEnd` means `arrow`. Groups are visual rectangles in absolute coordinates; they do not reparent other nodes.

Starter files in `examples/`:

- `mind-map.canvas`
- `flowchart.canvas`
- `project-board.canvas`

Import runs the validator and refuses documents the spec does not allow (unknown fields, non-integers, bad enums, dangling endpoints, duplicate ids). Export downloads the current valid document.

## Canvas library

`@xyflow/react` supplies pan, zoom, drag, resize, and connections. It is a view only. Positions stay integers, handles map to the four sides, markers map to `fromEnd` / `toEnd`, `elevateNodesOnSelect` is off, and `zIndexMode` is `manual` so array order is the only z-index. Nothing React Flow-specific is written into the JSON.
