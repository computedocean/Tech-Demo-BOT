import type { JobStatus, JobView } from "./types.ts"

export function summarizeJobs(jobs: JobView[]): JobStatus | "Empty" {
  if (jobs.length === 0) return "Empty"
  if (jobs.some((job) => job.status === "Failed")) return "Failed"
  if (jobs.every((job) => job.status === "Done")) return "Done"
  if (jobs.some((job) => job.status === "Generating")) return "Generating"
  return "Waiting"
}
