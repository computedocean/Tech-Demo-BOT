# Tech-Demo-BOT

A sticky monorepo of small tech demos. Each weekday, Tech Demos scouts one new library or tool from X bookmarks, gets approval, then plans and builds a single-user MVP under `apps/<slug>/`.

- `apps/<slug>/` — one self-contained demo per pick (`bun install && bun run dev`)
- `skills/project-planning/` — the planning skill every demo follows
- `tracking/seen-bookmarks.json` — bookmarks already proposed, approved, or skipped
