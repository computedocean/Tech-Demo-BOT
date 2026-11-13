export type JobStatus = "Waiting" | "Generating" | "Done" | "Failed"

export type JobView = {
  uuid: string
  status: JobStatus
  queue_length?: number
  name?: string
}

export type LoopInfo = {
  kind: "none" | "in_place" | "travel"
  alignment: "none" | "duplicate" | "next"
  period_frames: number | null
  displacement: [number, number, number]
}

export type AnimationPreset = {
  animation_id: string
  category: string
  display_name: string
  content_description: string
  frames: number
  duration_seconds: number
  loop: LoopInfo
}

export type LabMode = "mock" | "live"

export type ModeResponse = {
  mode: LabMode
  live_submit_credits: number
}

export type AnimationsResponse = {
  animations: AnimationPreset[]
}

export type RigResponse = {
  uuid: string
  subscription_key: string
  jobs: JobView[]
}

export type StatusResponse = {
  subscription_key: string
  jobs: JobView[]
  ready: boolean
  error: string | null
  message?: string
}

export type ApiErrorBody = {
  error: string
  message?: string
}
