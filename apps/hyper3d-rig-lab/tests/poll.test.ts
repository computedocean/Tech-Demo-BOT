import { describe, expect, test } from "bun:test"
import { MAX_POLL_DELAY_MS, runLiveRig, type FetchLike } from "../server/hyper3d.ts"

const TASK = "task-uuid-111"
const SUB = "sub-key-222"

function clock() {
  let time = 0
  const sleeps: number[] = []
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      time += ms
    },
    sleeps,
  }
}

function json(body: unknown, status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers })
}

function doneJobs() {
  return {
    jobs: [
      { uuid: "rig-job", status: "Done" },
      { uuid: "pack-job", status: "Done" },
    ],
  }
}

describe("polling and download identifiers", () => {
  test("polls with subscription_key and downloads with the submit uuid", async () => {
    const calls: { url: string; body: string; auth: string }[] = []
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({ url, body: typeof init?.body === "string" ? init.body : "", auth: headers.Authorization ?? "" })
      if (url.endsWith("/api/v2/status")) {
        return json(
          calls.filter((call) => call.url.endsWith("/status")).length < 3
            ? { jobs: [{ uuid: "rig-job", status: "Generating", queue_length: 1 }, { uuid: "pack-job", status: "Waiting", queue_length: 2 }] }
            : doneJobs(),
          201,
        )
      }
      if (url.endsWith("/api/v2/download")) {
        return json({ list: [{ name: "model.glb", url: "https://cdn.example/rig.glb" }] }, 201)
      }
      if (url === "https://cdn.example/rig.glb") {
        expect(headers.Authorization).toBeUndefined()
        return new Response(new Uint8Array([103, 108, 84, 70]))
      }
      throw new Error(`unexpected ${url}`)
    }
    const time = clock()
    const result = await runLiveRig({
      taskUuid: TASK,
      subscriptionKey: SUB,
      apiKey: "test-key",
      fetchImpl,
      sleep: time.sleep,
      now: time.now,
    })
    expect(result.ok).toBe(true)
    expect(time.sleeps[0]).toBe(5_000)
    const statusCalls = calls.filter((call) => call.url.endsWith("/api/v2/status"))
    expect(statusCalls.length).toBeGreaterThan(0)
    for (const call of statusCalls) {
      expect(JSON.parse(call.body)).toEqual({ subscription_key: SUB })
      expect(call.body).not.toContain(TASK)
      expect(call.auth).toBe("Bearer test-key")
    }
    const download = calls.find((call) => call.url.endsWith("/api/v2/download"))
    expect(download).toBeTruthy()
    expect(JSON.parse(download!.body)).toEqual({ task_uuid: TASK })
    expect(download!.body).not.toContain(SUB)
    const fileCall = calls.find((call) => call.url === "https://cdn.example/rig.glb")
    expect(fileCall?.auth).toBe("")
  })

  test("stops on any Failed job and does not download", async () => {
    const calls: string[] = []
    const fetchImpl: FetchLike = async (input) => {
      calls.push(String(input))
      return json(
        {
          jobs: [
            { uuid: "rig-job", status: "Failed" },
            { uuid: "pack-job", status: "Done" },
          ],
        },
        201,
      )
    }
    const time = clock()
    const result = await runLiveRig({
      taskUuid: TASK,
      subscriptionKey: SUB,
      apiKey: "test-key",
      fetchImpl,
      sleep: time.sleep,
      now: time.now,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("JOB_FAILED")
    expect(calls).toEqual(["https://api.hyper3d.com/api/v2/status"])
    expect(time.sleeps).toEqual([5_000])
  })

  test("backs off to at most 30 seconds and honors Retry-After", async () => {
    let statusCount = 0
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input)
      if (url.endsWith("/api/v2/status")) {
        statusCount += 1
        if (statusCount === 1) return json({ jobs: [] }, 429, { "Retry-After": "12" })
        if (statusCount === 2) return json({ jobs: [{ uuid: "rig-job", status: "Waiting" }] }, 201)
        if (statusCount < 10) return json({ jobs: [{ uuid: "rig-job", status: "Generating" }] }, 201)
        return json(doneJobs(), 201)
      }
      if (url.endsWith("/api/v2/download")) return json({ list: [{ name: "out.glb", url: "https://cdn.example/out.glb" }] }, 201)
      return new Response(new Uint8Array([1, 2, 3]))
    }
    const time = clock()
    const result = await runLiveRig({
      taskUuid: TASK,
      subscriptionKey: SUB,
      apiKey: "test-key",
      fetchImpl,
      sleep: time.sleep,
      now: time.now,
    })
    expect(result.ok).toBe(true)
    expect(time.sleeps[0]).toBe(5_000)
    expect(time.sleeps[1]).toBe(12_000)
    expect(Math.max(...time.sleeps)).toBeLessThanOrEqual(MAX_POLL_DELAY_MS)
    expect(time.sleeps.some((delay) => delay === MAX_POLL_DELAY_MS)).toBe(true)
  })

  test("caps a large Retry-After at 30 seconds", async () => {
    let statusCount = 0
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input)
      if (url.endsWith("/api/v2/status")) {
        statusCount += 1
        if (statusCount === 1) return json({ jobs: [] }, 429, { "Retry-After": "90" })
        return json(doneJobs(), 201)
      }
      if (url.endsWith("/api/v2/download")) return json({ list: [{ name: "out.glb", url: "https://cdn.example/out.glb" }] }, 201)
      return new Response(new Uint8Array([1]))
    }
    const time = clock()
    const result = await runLiveRig({
      taskUuid: TASK,
      subscriptionKey: SUB,
      apiKey: "test-key",
      fetchImpl,
      sleep: time.sleep,
      now: time.now,
    })
    expect(result.ok).toBe(true)
    expect(time.sleeps[1]).toBe(30_000)
  })

  test("does not retry a body-level status error", async () => {
    let calls = 0
    const fetchImpl: FetchLike = async () => {
      calls += 1
      return json({ error: "NO_SUCH_TASK", message: "missing" }, 201)
    }
    const time = clock()
    const result = await runLiveRig({
      taskUuid: TASK,
      subscriptionKey: SUB,
      apiKey: "test-key",
      fetchImpl,
      sleep: time.sleep,
      now: time.now,
    })
    expect(result.ok).toBe(false)
    expect(calls).toBe(1)
  })
})
