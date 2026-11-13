import type { AnimationsResponse, ModeResponse, RigResponse, StatusResponse } from "../../shared/types.ts"

export async function fetchMode(): Promise<ModeResponse> {
  const response = await fetch("/api/mode")
  if (!response.ok) throw new Error("Could not read the lab mode.")
  return response.json() as Promise<ModeResponse>
}

export async function fetchAnimations(category: string): Promise<AnimationsResponse> {
  const query = category === "all" ? "" : `?category=${encodeURIComponent(category)}`
  const response = await fetch(`/api/animations${query}`)
  if (!response.ok) throw new Error("Could not load animation presets.")
  return response.json() as Promise<AnimationsResponse>
}

export async function submitRig(form: FormData): Promise<RigResponse> {
  const response = await fetch("/api/rig", { method: "POST", body: form })
  const payload = (await response.json()) as RigResponse & { error?: string; message?: string }
  if (!response.ok) throw new Error(payload.message || payload.error || "Rigging was rejected.")
  return payload
}

export async function fetchStatus(subscriptionKey: string): Promise<StatusResponse> {
  const response = await fetch(`/api/status?subscription_key=${encodeURIComponent(subscriptionKey)}`)
  const payload = (await response.json()) as StatusResponse
  if (!response.ok) throw new Error(payload.message || payload.error || "Status check failed.")
  return payload
}

export async function downloadRig(taskUuid: string): Promise<Blob> {
  const response = await fetch("/api/download", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task_uuid: taskUuid }),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "Download failed." }))) as { error?: string; message?: string }
    throw new Error(payload.message || payload.error || "Download failed.")
  }
  return response.blob()
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
