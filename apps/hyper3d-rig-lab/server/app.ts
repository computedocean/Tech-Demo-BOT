import { summarizeJobs } from "../shared/jobs.ts"
import type { JobView, StatusResponse } from "../shared/types.ts"
import { filterMockAnimations } from "./catalog.ts"
import {
  listAnimations,
  normalizeRigInput,
  redactSecrets,
  resolveApiKey,
  runLiveRig,
  submitRigging,
  type EnvLike,
  type FetchLike,
  type RigInput,
} from "./hyper3d.ts"
import { mockJobViews, mockReady } from "./mock.ts"

const LIVE_SUBMIT_CREDITS = 0.5

type Session = {
  taskUuid: string
  subscriptionKey: string
  createdAt: number
  mode: "mock" | "live"
  rigUuid: string
  packagingUuid: string
  jobs: JobView[]
  error: string | null
  message?: string
  file: Uint8Array | null
  fileName: string
}

export type ApiOptions = {
  env: EnvLike
  fetchImpl?: FetchLike
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  sampleGlb: Uint8Array
  deadlineMs?: number
}

export function createApi(options: ApiOptions) {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? (() => Date.now())
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const sessions = new Map<string, Session>()
  const byTask = new Map<string, Session>()
  const apiKey = resolveApiKey(options.env)
  const secrets = [options.env.HYPER3D_API_KEY, options.env.RODIN_API_KEY, apiKey]

  function remember(session: Session) {
    sessions.set(session.subscriptionKey, session)
    byTask.set(session.taskUuid, session)
  }

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(redactUnknown(body, secrets)), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    })
  }

  function fail(error: string, message: string | undefined, status: number): Response {
    return json({ error: redactSecrets(error, secrets), message: message ? redactSecrets(message, secrets) : undefined }, status)
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/api/mode" && request.method === "GET") {
      return json({ mode: apiKey ? "live" : "mock", live_submit_credits: LIVE_SUBMIT_CREDITS })
    }
    if (url.pathname === "/api/animations" && request.method === "GET") {
      const category = url.searchParams.get("category")
      if (!apiKey) return json({ animations: filterMockAnimations(category) })
      const listed = await listAnimations({ apiKey, category, fetchImpl })
      if (!listed.ok) return fail(listed.error, listed.message, listed.error === "UNAUTHORIZED" ? 401 : 502)
      return json({ animations: listed.animations })
    }
    if (url.pathname === "/api/rig" && request.method === "POST") return submit(request)
    if (url.pathname === "/api/status" && request.method === "GET") return status(url)
    if (url.pathname === "/api/download" && request.method === "POST") return download(request)
    return fail("NOT_FOUND", "Unknown API route.", 404)
  }

  async function submit(request: Request): Promise<Response> {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return fail("BAD_REQUEST", "Expected a multipart rigging request.", 400)
    }
    if (form.get("asset_id")) {
      return fail("ASSET_ID_UNSUPPORTED", "This lab rigs an uploaded model only.", 400)
    }
    const model = form.get("model")
    const image = form.get("image")
    const input: RigInput = {
      model: model instanceof Blob ? model : null,
      modelName: model instanceof File ? model.name : undefined,
      boneTemplate: stringField(form.get("bone_template")),
      skeletonDescription: stringField(form.get("skeleton_description")),
      animationPresets: readPresets(form),
      inPlace: stringField(form.get("in_place")) === "true",
      image: image instanceof Blob ? image : null,
      imageName: image instanceof File ? image.name : undefined,
    }
    if (!apiKey) return acceptMock(input)
    const submitted = await submitRigging({ input, apiKey, fetchImpl })
    if (!submitted.ok) {
      const statusCode = submitted.error === "UNAUTHORIZED" ? 401 : submitted.error === "RATE_LIMITED" ? 429 : 422
      return fail(submitted.error, submitted.message, statusCode)
    }
    const rigUuid = submitted.jobUuids[0] ?? crypto.randomUUID()
    const packagingUuid = submitted.jobUuids[1] ?? submitted.jobUuids[0] ?? crypto.randomUUID()
    const jobs: JobView[] = submitted.jobUuids.length
      ? submitted.jobUuids.map((uuid) => ({ uuid, status: "Waiting" as const }))
      : [
          { uuid: rigUuid, status: "Waiting" },
          { uuid: packagingUuid, status: "Waiting" },
        ]
    const session: Session = {
      taskUuid: submitted.uuid,
      subscriptionKey: submitted.subscriptionKey,
      createdAt: now(),
      mode: "live",
      rigUuid,
      packagingUuid,
      jobs,
      error: null,
      file: null,
      fileName: "model.glb",
    }
    remember(session)
    void watchLive(session)
    return json({ uuid: session.taskUuid, subscription_key: session.subscriptionKey, jobs: session.jobs })
  }

  function acceptMock(input: RigInput): Response {
    const normalized = normalizeRigInput(input)
    if (!normalized.ok) return fail(normalized.error, normalized.message, 400)
    const taskUuid = crypto.randomUUID()
    const subscriptionKey = crypto.randomUUID()
    const rigUuid = crypto.randomUUID()
    const packagingUuid = crypto.randomUUID()
    const session: Session = {
      taskUuid,
      subscriptionKey,
      createdAt: now(),
      mode: "mock",
      rigUuid,
      packagingUuid,
      jobs: mockJobViews(0, rigUuid, packagingUuid),
      error: null,
      file: null,
      fileName: "rigged-figure.glb",
    }
    remember(session)
    return json({ uuid: taskUuid, subscription_key: subscriptionKey, jobs: session.jobs })
  }

  async function watchLive(session: Session) {
    if (!apiKey) return
    const result = await runLiveRig({
      subscriptionKey: session.subscriptionKey,
      taskUuid: session.taskUuid,
      apiKey,
      fetchImpl,
      sleep,
      now,
      deadlineMs: options.deadlineMs,
      onUpdate: (jobs) => {
        session.jobs = jobs
      },
    })
    if (!result.ok) {
      session.error = redactSecrets(result.error, secrets)
      session.message = result.message ? redactSecrets(result.message, secrets) : undefined
      if (result.jobs) session.jobs = result.jobs
      else if (summarizeJobs(session.jobs) !== "Failed") {
        session.jobs = session.jobs.map((job) => ({ ...job, status: "Failed" }))
      }
      return
    }
    session.jobs = result.jobs
    session.file = result.bytes
    session.fileName = result.name
  }

  function status(url: URL): Response {
    const subscriptionKey = url.searchParams.get("subscription_key")?.trim() ?? ""
    if (!subscriptionKey) return fail("MISSING_SUBSCRIPTION_KEY", "Status requires a subscription key.", 400)
    const session = sessions.get(subscriptionKey)
    if (!session) return fail("NO_SUCH_TASK", "That subscription key is not in this session.", 404)
    if (session.mode === "mock") {
      session.jobs = mockJobViews(now() - session.createdAt, session.rigUuid, session.packagingUuid)
    }
    const ready = session.mode === "mock" ? mockReady(now() - session.createdAt) : session.file != null
    const body: StatusResponse = {
      subscription_key: session.subscriptionKey,
      jobs: session.jobs,
      ready,
      error: session.error,
      message: session.message,
    }
    return json(body)
  }

  async function download(request: Request): Promise<Response> {
    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return fail("BAD_REQUEST", "Expected a JSON body with task_uuid.", 400)
    }
    const taskUuid =
      payload && typeof payload === "object" && typeof (payload as { task_uuid?: unknown }).task_uuid === "string"
        ? (payload as { task_uuid: string }).task_uuid.trim()
        : ""
    if (!taskUuid) return fail("MISSING_TASK_UUID", "Download requires the submit task uuid.", 400)
    const session = byTask.get(taskUuid)
    if (!session) return fail("NO_SUCH_TASK", "That task is not in this session.", 404)
    if (session.error) return fail(session.error, session.message, 422)
    const ready = session.mode === "mock" ? mockReady(now() - session.createdAt) : session.file != null
    if (!ready) return fail("NOT_READY", "The rig is not ready to download yet.", 409)
    const bytes = session.mode === "mock" ? options.sampleGlb : session.file
    if (!bytes) return fail("NOT_READY", "The rigged file is not cached yet.", 409)
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "model/gltf-binary",
        "content-disposition": `attachment; filename="${session.fileName.replaceAll('"', "")}"`,
        "cache-control": "no-store",
      },
    })
  }

  return { handle, sessions, byTask }
}

function stringField(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined
}

function readPresets(form: FormData): string[] {
  const raw = form.getAll("animation_preset").filter((value): value is string => typeof value === "string")
  if (raw.length === 1 && raw[0]?.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw[0]) as unknown
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) return parsed
    } catch {
      // A single preset id is not JSON. Keep it as one id.
    }
  }
  return raw
}

function redactUnknown(value: unknown, secrets: Array<string | null | undefined>): unknown {
  if (typeof value === "string") return redactSecrets(value, secrets)
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item, secrets))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) out[key] = redactUnknown(item, secrets)
    return out
  }
  return value
}
