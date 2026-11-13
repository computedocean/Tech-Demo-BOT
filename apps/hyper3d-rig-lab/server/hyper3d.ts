import { summarizeJobs } from "../shared/jobs.ts"
import type { AnimationPreset, JobStatus, JobView } from "../shared/types.ts"

export const HYPER3D_ORIGIN = "https://api.hyper3d.com"
export const RIGGING_PATH = "/api/v2/rigging"
export const STATUS_PATH = "/api/v2/status"
export const DOWNLOAD_PATH = "/api/v2/download"
export const ANIMATIONS_PATH = "/api/v2/rigging_animations"

export const INITIAL_POLL_DELAY_MS = 5_000
export const MAX_POLL_DELAY_MS = 30_000
export const DEFAULT_DEADLINE_MS = 20 * 60 * 1000

const JOB_STATUSES = new Set<JobStatus>(["Waiting", "Generating", "Done", "Failed"])

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

export type EnvLike = {
  HYPER3D_API_KEY?: string
  RODIN_API_KEY?: string
}

export type RigInput = {
  model: Blob | null
  modelName?: string
  boneTemplate?: string
  skeletonDescription?: string
  animationPresets?: string[]
  inPlace?: boolean
  image?: Blob | null
  imageName?: string
}

export type NormalizedRig = {
  model: Blob
  modelName: string
  boneTemplate: "auto" | "custom"
  skeletonDescription?: string
  animationPresets: string[]
  inPlace: boolean
  image?: Blob
  imageName?: string
}

export type SubmitSuccess = {
  ok: true
  uuid: string
  subscriptionKey: string
  jobUuids: string[]
}

export type SubmitFailure = {
  ok: false
  error: string
  message?: string
}

export function resolveApiKey(env: EnvLike): string | null {
  const primary = env.HYPER3D_API_KEY?.trim()
  if (primary) return primary
  const alias = env.RODIN_API_KEY?.trim()
  if (alias) return alias
  return null
}

export function redactSecrets(value: string, secrets: Array<string | null | undefined>): string {
  let out = value
  for (const secret of secrets) {
    if (secret && secret.length > 0) out = out.split(secret).join("[redacted]")
  }
  return out
}

export function isEmptyError(error: unknown): boolean {
  if (error == null) return true
  if (typeof error === "string") return error.trim() === ""
  return false
}

export function normalizeRigInput(input: RigInput): { ok: true; value: NormalizedRig } | SubmitFailure {
  if (!input.model || input.model.size === 0) {
    return { ok: false, error: "MISSING_MODEL", message: "Upload a GLB model." }
  }
  const modelName = input.modelName?.trim() || "model.glb"
  if (!modelName.toLowerCase().endsWith(".glb")) {
    return { ok: false, error: "UNSUPPORTED_MODEL", message: "Upload a .glb model." }
  }
  const boneTemplate = (input.boneTemplate ?? "auto").trim()
  if (boneTemplate !== "auto" && boneTemplate !== "custom") {
    return { ok: false, error: "INVALID_BONE_TEMPLATE", message: "Choose auto or a skeleton prompt." }
  }
  const skeletonDescription = input.skeletonDescription?.trim() ?? ""
  if (boneTemplate === "custom" && skeletonDescription.length === 0) {
    return { ok: false, error: "MISSING_SKELETON_DESCRIPTION", message: "Enter a skeleton prompt." }
  }
  const presets: string[] = []
  for (const raw of input.animationPresets ?? []) {
    const id = raw.trim()
    if (!id) return { ok: false, error: "INVALID_PRESET", message: "Animation preset ids must be non-blank." }
    if (!presets.includes(id)) presets.push(id)
  }
  if (presets.length > 10) {
    return { ok: false, error: "TOO_MANY_PRESETS", message: "Select at most 10 animation presets." }
  }
  if (input.inPlace && presets.length === 0) {
    return { ok: false, error: "IN_PLACE_WITHOUT_PRESET", message: "In place applies only when a preset is selected." }
  }
  let image: Blob | undefined
  let imageName: string | undefined
  if (input.image && input.image.size > 0) {
    image = input.image
    imageName = input.imageName?.trim() || "image.png"
  }
  const value: NormalizedRig = {
    model: input.model,
    modelName,
    boneTemplate,
    animationPresets: presets,
    inPlace: Boolean(input.inPlace && presets.length > 0),
  }
  if (boneTemplate === "custom") value.skeletonDescription = skeletonDescription
  if (image) {
    value.image = image
    value.imageName = imageName
  }
  return { ok: true, value }
}

export function buildRiggingForm(input: NormalizedRig): FormData {
  const form = new FormData()
  form.append("model", input.model, input.modelName)
  form.append("geometry_file_format", "glb")
  form.append("bone_template", input.boneTemplate)
  if (input.boneTemplate === "custom" && input.skeletonDescription) {
    form.append("skeleton_description", input.skeletonDescription)
  }
  for (const id of input.animationPresets) form.append("animation_preset", id)
  if (input.inPlace) form.append("in_place", "true")
  if (input.image) form.append("image", input.image, input.imageName ?? "image.png")
  return form
}

export function interpretSubmitResponse(status: number, body: unknown): SubmitSuccess | SubmitFailure {
  if (status === 429) return { ok: false, error: "RATE_LIMITED", message: "Hyper3D rate limited the submission." }
  if (status === 401) return { ok: false, error: "UNAUTHORIZED", message: "Hyper3D rejected the API key." }
  if (status === 400) return { ok: false, error: "BAD_REQUEST", message: "Hyper3D rejected the rigging request." }
  if (status !== 201) return { ok: false, error: "UPSTREAM_ERROR", message: `Hyper3D returned HTTP ${status}.` }
  if (!body || typeof body !== "object") {
    return { ok: false, error: "UNREADABLE_RESPONSE", message: "Hyper3D returned an unreadable submission." }
  }
  const record = body as Record<string, unknown>
  if (!isEmptyError(record.error)) {
    const error = typeof record.error === "string" && record.error.trim() ? record.error : "REQUEST_REJECTED"
    const message = typeof record.message === "string" ? record.message : "Rigging was rejected."
    return { ok: false, error, message }
  }
  const uuid = typeof record.uuid === "string" ? record.uuid.trim() : ""
  if (!uuid) {
    return { ok: false, error: "MISSING_UUID", message: "Hyper3D did not return a task uuid." }
  }
  const jobs = record.jobs
  let subscriptionKey = ""
  const jobUuids: string[] = []
  if (jobs && typeof jobs === "object") {
    const bag = jobs as Record<string, unknown>
    if (typeof bag.subscription_key === "string") subscriptionKey = bag.subscription_key.trim()
    if (Array.isArray(bag.uuids)) {
      for (const id of bag.uuids) {
        if (typeof id === "string" && id.trim()) jobUuids.push(id)
      }
    }
  }
  if (!subscriptionKey) {
    return { ok: false, error: "MISSING_SUBSCRIPTION_KEY", message: "Hyper3D did not return a subscription key." }
  }
  return { ok: true, uuid, subscriptionKey, jobUuids }
}

export async function submitRigging(args: {
  input: RigInput
  apiKey: string
  fetchImpl: FetchLike
}): Promise<SubmitSuccess | SubmitFailure> {
  const normalized = normalizeRigInput(args.input)
  if (!normalized.ok) return normalized
  const form = buildRiggingForm(normalized.value)
  let response: Response
  try {
    response = await args.fetchImpl(`${HYPER3D_ORIGIN}${RIGGING_PATH}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.apiKey}` },
      body: form,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hyper3D could not be reached."
    return { ok: false, error: "NETWORK", message }
  }
  const body = await readJson(response)
  return interpretSubmitResponse(response.status, body)
}

export function retryAfterMs(header: string | null, now: number): number | null {
  if (!header) return null
  const trimmed = header.trim()
  if (!trimmed) return null
  const seconds = Number(trimmed)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(trimmed)
  if (Number.isFinite(date)) return Math.max(0, date - now)
  return null
}

export function nextPollDelay(currentMs: number, retryAfter: number | null): number {
  if (retryAfter != null) return Math.min(MAX_POLL_DELAY_MS, Math.max(0, retryAfter))
  return Math.min(MAX_POLL_DELAY_MS, Math.round(currentMs * 1.5))
}

export function parseStatusBody(body: unknown): { ok: true; jobs: JobView[] } | SubmitFailure {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "UNREADABLE_STATUS", message: "Hyper3D returned an unreadable status." }
  }
  const record = body as Record<string, unknown>
  if (!isEmptyError(record.error)) {
    const error = typeof record.error === "string" && record.error.trim() ? record.error : "STATUS_REJECTED"
    const message = typeof record.message === "string" ? record.message : "Status check was rejected."
    return { ok: false, error, message }
  }
  if (!Array.isArray(record.jobs)) {
    return { ok: false, error: "MISSING_JOBS", message: "Status response did not include jobs." }
  }
  const jobs: JobView[] = []
  for (const item of record.jobs) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const uuid = typeof row.uuid === "string" ? row.uuid : "job"
    const status = typeof row.status === "string" ? row.status : ""
    const view: JobView = {
      uuid,
      status: JOB_STATUSES.has(status as JobStatus) ? (status as JobStatus) : "Generating",
    }
    if (typeof row.queue_length === "number" && Number.isFinite(row.queue_length)) {
      view.queue_length = row.queue_length
    }
    jobs.push(view)
  }
  return { ok: true, jobs }
}

export function parseDownloadBody(body: unknown): { ok: true; files: { name: string; url: string }[] } | SubmitFailure {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "UNREADABLE_DOWNLOAD", message: "Hyper3D returned an unreadable download." }
  }
  const record = body as Record<string, unknown>
  if (!isEmptyError(record.error)) {
    const error = typeof record.error === "string" && record.error.trim() ? record.error : "DOWNLOAD_REJECTED"
    const message = typeof record.message === "string" ? record.message : "Download was rejected."
    return { ok: false, error, message }
  }
  if (!Array.isArray(record.list)) {
    return { ok: false, error: "MISSING_FILES", message: "Download response did not include files." }
  }
  const files: { name: string; url: string }[] = []
  for (const item of record.list) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    if (typeof row.url !== "string" || !row.url) continue
    files.push({
      name: typeof row.name === "string" && row.name ? row.name : "model.glb",
      url: row.url,
    })
  }
  if (files.length === 0) return { ok: false, error: "MISSING_FILES", message: "Download response did not include a file URL." }
  return { ok: true, files }
}

export function pickDownloadFile(files: { name: string; url: string }[]): { name: string; url: string } {
  return files.find((file) => file.name.toLowerCase().endsWith(".glb")) ?? files[0]!
}

export function mapAnimation(row: unknown): AnimationPreset | null {
  if (!row || typeof row !== "object") return null
  const record = row as Record<string, unknown>
  if (typeof record.animation_id !== "string" || !record.animation_id) return null
  const loopRecord = record.loop && typeof record.loop === "object" ? (record.loop as Record<string, unknown>) : {}
  const displacement = Array.isArray(loopRecord.displacement) ? loopRecord.displacement : [0, 0, 0]
  return {
    animation_id: record.animation_id,
    category: typeof record.category === "string" ? record.category : "",
    display_name: typeof record.display_name === "string" ? record.display_name : record.animation_id,
    content_description: typeof record.content_description === "string" ? record.content_description : "",
    frames: typeof record.frames === "number" ? record.frames : 0,
    duration_seconds: typeof record.duration_seconds === "number" ? record.duration_seconds : 0,
    loop: {
      kind: loopRecord.kind === "in_place" || loopRecord.kind === "travel" || loopRecord.kind === "none" ? loopRecord.kind : "none",
      alignment:
        loopRecord.alignment === "duplicate" || loopRecord.alignment === "next" || loopRecord.alignment === "none"
          ? loopRecord.alignment
          : "none",
      period_frames: typeof loopRecord.period_frames === "number" ? loopRecord.period_frames : null,
      displacement: [numberOrZero(displacement[0]), numberOrZero(displacement[1]), numberOrZero(displacement[2])],
    },
  }
}

export async function listAnimations(args: {
  apiKey: string
  category: string | null
  fetchImpl: FetchLike
}): Promise<{ ok: true; animations: AnimationPreset[] } | SubmitFailure> {
  const url = new URL(`${HYPER3D_ORIGIN}${ANIMATIONS_PATH}`)
  if (args.category) url.searchParams.set("category", args.category)
  let response: Response
  try {
    response = await args.fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${args.apiKey}` },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hyper3D could not be reached."
    return { ok: false, error: "NETWORK", message }
  }
  if (response.status === 401) return { ok: false, error: "UNAUTHORIZED", message: "Hyper3D rejected the API key." }
  if (response.status === 429) return { ok: false, error: "RATE_LIMITED", message: "Hyper3D rate limited the catalog request." }
  if (!response.ok) return { ok: false, error: "UPSTREAM_ERROR", message: `Hyper3D returned HTTP ${response.status}.` }
  const body = await readJson(response)
  if (!Array.isArray(body)) return { ok: false, error: "UNREADABLE_CATALOG", message: "Hyper3D returned an unreadable catalog." }
  return { ok: true, animations: body.map(mapAnimation).filter((item): item is AnimationPreset => item != null) }
}

export async function pollUntilDone(args: {
  subscriptionKey: string
  apiKey: string
  fetchImpl: FetchLike
  sleep: (ms: number) => Promise<void>
  now: () => number
  deadlineMs?: number
  onUpdate?: (jobs: JobView[]) => void
}): Promise<{ ok: true; jobs: JobView[] } | (SubmitFailure & { jobs?: JobView[] })> {
  const deadline = args.now() + (args.deadlineMs ?? DEFAULT_DEADLINE_MS)
  let delay = INITIAL_POLL_DELAY_MS
  let latest: JobView[] | undefined
  while (true) {
    if (args.now() >= deadline) {
      return { ok: false, error: "DEADLINE", message: "Rigging exceeded the wait deadline.", jobs: latest }
    }
    const wait = Math.min(delay, Math.max(0, deadline - args.now()))
    await args.sleep(wait)
    if (args.now() >= deadline) {
      return { ok: false, error: "DEADLINE", message: "Rigging exceeded the wait deadline.", jobs: latest }
    }
    let response: Response
    try {
      response = await args.fetchImpl(`${HYPER3D_ORIGIN}${STATUS_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscription_key: args.subscriptionKey }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Hyper3D could not be reached."
      return { ok: false, error: "NETWORK", message, jobs: latest }
    }
    if (response.status === 429 || response.status >= 500) {
      delay = nextPollDelay(delay, retryAfterMs(response.headers.get("Retry-After"), args.now()))
      continue
    }
    if (response.status === 401) return { ok: false, error: "UNAUTHORIZED", message: "Hyper3D rejected the API key.", jobs: latest }
    if (response.status === 400) return { ok: false, error: "BAD_REQUEST", message: "Hyper3D rejected the status request.", jobs: latest }
    const body = await readJson(response)
    if (response.status !== 201 && response.status !== 200) {
      return { ok: false, error: "UPSTREAM_ERROR", message: `Hyper3D returned HTTP ${response.status}.`, jobs: latest }
    }
    const parsed = parseStatusBody(body)
    if (!parsed.ok) return { ...parsed, jobs: latest }
    latest = parsed.jobs
    args.onUpdate?.(parsed.jobs)
    const summary = summarizeJobs(parsed.jobs)
    if (summary === "Failed") {
      return { ok: false, error: "JOB_FAILED", message: "A rigging job failed.", jobs: parsed.jobs }
    }
    if (summary === "Done") return { ok: true, jobs: parsed.jobs }
    delay = nextPollDelay(delay, null)
  }
}

export async function downloadRiggedGlb(args: {
  taskUuid: string
  apiKey: string
  fetchImpl: FetchLike
}): Promise<{ ok: true; bytes: Uint8Array; name: string } | SubmitFailure> {
  let response: Response
  try {
    response = await args.fetchImpl(`${HYPER3D_ORIGIN}${DOWNLOAD_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ task_uuid: args.taskUuid }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hyper3D could not be reached."
    return { ok: false, error: "NETWORK", message }
  }
  if (response.status === 429) return { ok: false, error: "RATE_LIMITED", message: "Hyper3D rate limited the download." }
  if (response.status === 401) return { ok: false, error: "UNAUTHORIZED", message: "Hyper3D rejected the API key." }
  if (response.status === 400) return { ok: false, error: "BAD_REQUEST", message: "Hyper3D rejected the download request." }
  const body = await readJson(response)
  if (response.status !== 201 && response.status !== 200) {
    return { ok: false, error: "UPSTREAM_ERROR", message: `Hyper3D returned HTTP ${response.status}.` }
  }
  const parsed = parseDownloadBody(body)
  if (!parsed.ok) return parsed
  const file = pickDownloadFile(parsed.files)
  let fileResponse: Response
  try {
    fileResponse = await args.fetchImpl(file.url, { method: "GET" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The rigged file could not be fetched."
    return { ok: false, error: "DOWNLOAD_FETCH", message }
  }
  if (!fileResponse.ok) {
    return { ok: false, error: "DOWNLOAD_FETCH", message: `The rigged file returned HTTP ${fileResponse.status}.` }
  }
  const bytes = new Uint8Array(await fileResponse.arrayBuffer())
  if (bytes.byteLength === 0) return { ok: false, error: "EMPTY_FILE", message: "The rigged file was empty." }
  return { ok: true, bytes, name: file.name }
}

export async function runLiveRig(args: {
  subscriptionKey: string
  taskUuid: string
  apiKey: string
  fetchImpl: FetchLike
  sleep: (ms: number) => Promise<void>
  now: () => number
  deadlineMs?: number
  onUpdate?: (jobs: JobView[]) => void
}): Promise<{ ok: true; bytes: Uint8Array; name: string; jobs: JobView[] } | (SubmitFailure & { jobs?: JobView[] })> {
  const polled = await pollUntilDone(args)
  if (!polled.ok) return polled
  const file = await downloadRiggedGlb({
    taskUuid: args.taskUuid,
    apiKey: args.apiKey,
    fetchImpl: args.fetchImpl,
  })
  if (!file.ok) return { ...file, jobs: polled.jobs }
  return { ok: true, bytes: file.bytes, name: file.name, jobs: polled.jobs }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
