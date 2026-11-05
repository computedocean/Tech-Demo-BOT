# Remotion Bookmark Reel — Plan

**Goal:** Render an animated "bookmark of the day" video card from props with Remotion (React → MP4).

Source: https://github.com/remotion-dev/remotion via https://x.com/e1genqq/status/2116270712390316375

## Single-user MVP
- One composition `BookmarkCard` (1080x1080, 30fps, 5s): title, author handle, short text, spring entrance, progress bar.
- Driven by input props (defaults in `src/defaults.ts`, override with `--props`).
- `bun run dev` opens Remotion Studio; `bun run render` writes `out/bookmark.mp4`; `bun run still` writes a PNG.

**Out:** multiple compositions, data fetching from X, audio, Lambda rendering, UI app shell.

## Tasks (vertical slices)
1. Composition renders static card with props.
2. Animated entrance + progress bar.
3. Render/still scripts produce MP4/PNG.

## Stack
- Remotion 4 — the library being demoed; provides Studio, CLI rendering, headless Chromium.
- React 19 + TypeScript — Remotion's native authoring model.
- Bun — runtime/package manager per repo rules.
- No shadcn: output is a video, not an interactive UI; inline styles keep it self-contained.
- Hand-written minimal skeleton instead of `create-video` to avoid template bloat (blank template equivalent).

## Deferred
- Pulling live bookmark data from X — needs auth; not needed to show Remotion.
- Tests — only render verification matters for MVP.
