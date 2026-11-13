# Hyper3D Rigging Lab

Single-user demo of the public Hyper3D Rigging API. Drop a GLB, choose auto-rig or a skeleton prompt, pick stock animation presets, and play the result.

`bun run dev` starts the Vite UI and the Bun API together. With no server key, the lab stays in mock mode and never calls Hyper3D. Set `HYPER3D_API_KEY` (or the server-only alias `RODIN_API_KEY`) to use the live API. Live submits cost 0.5 credits.

```bash
bun install
bun run dev
bun test
```

This project is an independent demo of a public API and is not affiliated with Deemos or Hyper3D.
Docs: https://docs.hyper3d.ai/en/api-specification/rigging
