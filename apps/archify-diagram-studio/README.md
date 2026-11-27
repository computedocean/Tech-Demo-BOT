# Diagram studio

Single-user lab that turns a short system description into an interactive architecture diagram. Pick a preset or describe a web app, a queue, an auth gate, or an event flow. Pan and zoom, open a node, highlight a directed path, then apply a follow-up such as “add a Redis cache”.

```sh
bun install
bun run dev
bun test
```

No API keys are required. `bun run dev` uses the offline templates.

An optional wording rewrite can run inside the dev server when `ARCHIFY_DIAGRAM_LLM_KEY` or `OPENAI_API_KEY` is set in the server environment. Leave both empty. Do not prefix them with `VITE_`. See `.env.example`. The graph still comes from the templates.

This is an independent demo. It is not affiliated with Archify, and it is not an official skill or hosted service. It does not reproduce official Archify HTML artifacts.

Archify is Apache-2.0.

- https://github.com/tt-a1i/archify
- https://github.com/tt-a1i/archify/blob/main/LICENSE
- https://archify.si
- Bookmark: https://x.com/tom_doerr/status/2121961437559980092
