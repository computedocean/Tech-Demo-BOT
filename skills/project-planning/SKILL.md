---
name: project-planning
description: Use when starting a new project, scoping an idea, choosing a stack, or producing an MVP implementation plan — an opinionated Bun/shadcn planning skill.
---

Turn a fresh project idea into a focused, MVP-first plan that favors prebuilt solutions and opinionated frameworks over custom complexity.

## Workflow

1. Clarify the goal in one sentence and define the single-user MVP boundary: what ships in the first cut, what is explicitly out of scope.
2. Decompose the goal into a small set of manageable tasks. Group by user-visible outcome, not by layer.
3. Research frameworks and libraries that could absorb whole tasks. Prefer pre-built solutions unless a clear constraint rules them out.
4. Start from an official scaffold or starter via bunx create-* (create-next-app, create-vite, create-t3-app, create-tanstack, create-expo) instead of hand-rolling the skeleton.
5. Before any dependency install, create or preserve bunfig.toml with `[install] minimumReleaseAge = 259200`. Prefer scaffold flags that skip the initial install, then run bun install.
6. Pick one opinionated framework (e.g. Next.js, TanStack Start) when it removes wiring decisions. Skip framework-grade tooling for one-screen utilities.
7. For UI, run `bunx shadcn@latest init` with a minimalist preset; prefer shadcn blocks; add components on demand.
8. Lay out components and services in a logical structure before writing code.
9. Keep the testing surface and git-hook surface small.
10. Produce a short plan: goal, MVP scope, task list, stack choices with one-line rationale, deferred items.

## Planning rules

- Build for one user first. Use Bun for runtime, packages, and scripts.
- Prefer prebuilt over bespoke; choose boring, well-documented defaults.
- Cut features before cutting clarity. Organize by feature once there is more than one screen.
- Test critical logic only. Git hooks for formatting and fast static checks only.
- Defer anything not on the path to a working MVP; re-evaluate once the first slice runs.

## Output shape

- Goal in one sentence
- Single-user MVP + explicit outs
- Outcome-oriented task list (vertical slices)
- Stack with one-line rationale each
- Deferred items and why
