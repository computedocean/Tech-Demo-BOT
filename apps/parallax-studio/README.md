# Parallax studio lab

A single-user mock studio for image, video, and audio. Generate returns bundled sample files, Cinema batch-fills a three-shot storyboard from those files, and a scripted Supercomputer stand-in proposes steps you can accept or dismiss.

Mock mode is the default. No API key is required.

```sh
bun install
bun run dev
```

`bun test` covers mock generate, the Cinema batch, the stand-in, and the live-path boundaries.

This is an independent MIT demo. It is not affiliated with Higgsfield, Orgo, or Nous Research, and it is not a model marketplace or billing product. It does not claim parity with [Parallax](https://github.com/nickvasilescu/parallax) (MIT).

Sample media in `public/samples/` is original and synthetic. See `public/samples/SOURCE.md`.
