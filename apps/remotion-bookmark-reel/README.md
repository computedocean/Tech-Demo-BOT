# Remotion Bookmark Reel

Animated "bookmark of the day" card rendered with [Remotion](https://github.com/remotion-dev/remotion).

```sh
bun install && bun run dev   # Remotion Studio
bun run render               # out/bookmark.mp4
bun run still                # out/bookmark.png
bunx remotion render src/index.ts BookmarkCard out/x.mp4 --props='{"title":"Hi","handle":"@me","text":"...","accent":"#16a34a"}'
```

![screenshot](docs/screenshot.png)
