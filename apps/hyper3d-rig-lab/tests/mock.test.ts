import { describe, expect, test } from "bun:test"
import { createApi } from "../server/app.ts"
import { MOCK_DONE_MS } from "../server/mock.ts"

const SAMPLE = new Uint8Array([103, 108, 84, 70, 9, 9, 9])

function rigRequest(fields?: { bone?: string; prompt?: string; presets?: string[]; inPlace?: boolean }) {
  const form = new FormData()
  form.set("model", new File([new Uint8Array([1, 2, 3])], "hero.glb", { type: "model/gltf-binary" }))
  form.set("bone_template", fields?.bone ?? "auto")
  if (fields?.prompt) form.set("skeleton_description", fields.prompt)
  for (const id of fields?.presets ?? ["demo_walk"]) form.append("animation_preset", id)
  if (fields?.inPlace) form.set("in_place", "true")
  return new Request("http://lab.local/api/rig", { method: "POST", body: form })
}

describe("mock mode", () => {
  test("never calls Hyper3D and returns the bundled GLB", async () => {
    let clock = 1_000
    const calls: string[] = []
    const api = createApi({
      env: {},
      sampleGlb: SAMPLE,
      now: () => clock,
      fetchImpl: async (input) => {
        calls.push(String(input))
        throw new Error(`mock mode called ${String(input)}`)
      },
    })

    const mode = await api.handle(new Request("http://lab.local/api/mode"))
    expect(await mode.json()).toEqual({ mode: "mock", live_submit_credits: 0.5 })

    const submitted = await api.handle(rigRequest({ bone: "custom", prompt: "A biped with two arms and two legs.", presets: ["demo_walk"], inPlace: true }))
    expect(submitted.status).toBe(200)
    const body = (await submitted.json()) as { uuid: string; subscription_key: string; jobs: { status: string }[] }
    expect(body.uuid).not.toBe("")
    expect(body.subscription_key).not.toBe("")
    expect(body.jobs[0]?.status).toBe("Waiting")

    const waiting = await api.handle(new Request(`http://lab.local/api/status?subscription_key=${body.subscription_key}`))
    const waitingBody = (await waiting.json()) as { jobs: { status: string; queue_length?: number }[]; ready: boolean }
    expect(waitingBody.ready).toBe(false)
    expect(waitingBody.jobs.map((job) => job.status)).toEqual(["Waiting", "Waiting"])
    expect(waitingBody.jobs[0]?.queue_length).toBe(2)

    clock += MOCK_DONE_MS
    const done = await api.handle(new Request(`http://lab.local/api/status?subscription_key=${body.subscription_key}`))
    const doneBody = (await done.json()) as { jobs: { status: string; name?: string }[]; ready: boolean }
    expect(doneBody.ready).toBe(true)
    expect(doneBody.jobs.map((job) => job.status)).toEqual(["Done", "Done"])
    expect(doneBody.jobs.map((job) => job.name)).toEqual(["rig", "packaging"])

    const download = await api.handle(
      new Request("http://lab.local/api/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task_uuid: body.uuid }),
      }),
    )
    expect(download.status).toBe(200)
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(SAMPLE)
    expect(calls).toEqual([])
  })

  test("treats a blank key as mock mode", async () => {
    const api = createApi({
      env: { HYPER3D_API_KEY: "   ", RODIN_API_KEY: "" },
      sampleGlb: SAMPLE,
      fetchImpl: async () => {
        throw new Error("should stay in mock mode")
      },
    })
    const mode = await api.handle(new Request("http://lab.local/api/mode"))
    expect(await mode.json()).toMatchObject({ mode: "mock" })
  })

  test("filters the local catalog without a network call", async () => {
    const api = createApi({
      env: {},
      sampleGlb: SAMPLE,
      fetchImpl: async () => {
        throw new Error("should stay in mock mode")
      },
    })
    const human = await api.handle(new Request("http://lab.local/api/animations?category=human"))
    const payload = (await human.json()) as { animations: { category: string }[] }
    expect(payload.animations.length).toBeGreaterThan(0)
    expect(payload.animations.every((item) => item.category === "human")).toBe(true)
    const unknown = await api.handle(new Request("http://lab.local/api/animations?category=Human"))
    expect(await unknown.json()).toEqual({ animations: [] })
  })
})
