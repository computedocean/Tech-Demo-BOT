import { describe, expect, test } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { createApi } from "../server/app.ts"

const SECRET = "super-secret-hyper3d-value"
const ALIAS = "super-secret-rodin-alias"
const root = fileURLToPath(new URL("..", import.meta.url))

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return listFiles(path)
      return [path]
    }),
  )
  return files.flat()
}

describe("key leakage", () => {
  test("API responses never contain the key value", async () => {
    const api = createApi({
      env: { HYPER3D_API_KEY: SECRET, RODIN_API_KEY: ALIAS },
      sampleGlb: new Uint8Array([1, 2, 3]),
      now: () => 0,
      sleep: async () => {},
      fetchImpl: async (input) => {
        const url = String(input)
        if (url.endsWith("/api/v2/rigging")) {
          return new Response(
            JSON.stringify({
              error: "API_INSUFFICIENT_FUNDS",
              message: `wallet ${SECRET} via ${ALIAS} is empty`,
              uuid: "task-uuid",
            }),
            { status: 201 },
          )
        }
        if (url.includes("/rigging_animations")) {
          return new Response(
            JSON.stringify([
              {
                animation_id: "demo_idle",
                category: "human",
                display_name: "Idle",
                content_description: `notes ${SECRET}`,
                frames: 10,
                duration_seconds: 1,
                loop: { kind: "none", alignment: "none", period_frames: null, displacement: [0, 0, 0] },
              },
            ]),
            { status: 200 },
          )
        }
        throw new Error(`unexpected ${url}`)
      },
    })

    const mode = await (await api.handle(new Request("http://lab.local/api/mode"))).text()
    const animations = await (await api.handle(new Request("http://lab.local/api/animations"))).text()
    const form = new FormData()
    form.set("model", new File([new Uint8Array([1])], "hero.glb"))
    form.set("bone_template", "auto")
    const rig = await (await api.handle(new Request("http://lab.local/api/rig", { method: "POST", body: form }))).text()

    for (const body of [mode, animations, rig]) {
      expect(body).not.toContain(SECRET)
      expect(body).not.toContain(ALIAS)
    }
    expect(rig).toContain("[redacted]")
    expect(animations).toContain("[redacted]")
    expect(mode).toContain("live")
  })

  test("client source does not name the server key or call Hyper3D", async () => {
    const files = [...(await listFiles(join(root, "src"))), join(root, "index.html")]
    for (const file of files) {
      const text = await readFile(file, "utf8")
      expect(text).not.toContain("HYPER3D_API_KEY")
      expect(text).not.toContain("RODIN_API_KEY")
      expect(text).not.toContain("api.hyper3d.com")
      expect(text).not.toContain("VITE_")
    }
  })
})
