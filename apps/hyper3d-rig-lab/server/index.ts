import { fileURLToPath } from "node:url"
import { createApi } from "./app.ts"

const port = Number(process.env.RIG_API_PORT ?? 8787)
const samplePath = fileURLToPath(new URL("../public/samples/rigged-figure.glb", import.meta.url))
const sampleFile = Bun.file(samplePath)
if (!(await sampleFile.exists())) {
  throw new Error(`Missing sample rig at ${samplePath}`)
}
const sampleGlb = new Uint8Array(await sampleFile.arrayBuffer())
const api = createApi({
  env: {
    HYPER3D_API_KEY: process.env.HYPER3D_API_KEY,
    RODIN_API_KEY: process.env.RODIN_API_KEY,
  },
  sampleGlb,
})

Bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch: (request) => api.handle(request),
})

const mode = process.env.HYPER3D_API_KEY?.trim() || process.env.RODIN_API_KEY?.trim() ? "live" : "mock"
console.log(`rig lab api listening on 127.0.0.1:${port} (${mode})`)
