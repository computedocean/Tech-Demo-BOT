# Agent rules for this repo

- One demo per pick, in `apps/<kebab-slug>/`. Only add or change files inside that folder (plus `tracking/seen-bookmarks.json` when told to).
- Never create a new GitHub repository for a demo.
- Plan first with `skills/project-planning/SKILL.md` and write `apps/<slug>/PLAN.md` before code.
- Each app is self-contained: its own `package.json` and `bunfig.toml`, runs with `bun install && bun run dev`. No shared root workspace dependencies.
- Use Bun. Every app has a `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install.
- UI defaults to shadcn/ui with a minimalist preset.
- Open exactly one PR per demo. The PR must include at least one screenshot AND at least one video of the running app. Do not commit large videos to git; attach them to the PR.
