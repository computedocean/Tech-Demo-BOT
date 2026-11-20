import notesSeed from "../../sandbox/notes.md?raw"
import readmeSeed from "../../sandbox/readme.txt?raw"

export const SEED: Record<string, string> = {
  "notes.md": notesSeed,
  "readme.txt": readmeSeed,
}

type SandboxBody =
  | { op: "reset" }
  | { op: "write"; file: string; content: string }

export async function fetchSandbox(): Promise<{
  files: Record<string, string>
  live: boolean
}> {
  try {
    const response = await fetch("/api/sandbox")
    if (!response.ok) throw new Error("sandbox request failed")
    const data = (await response.json()) as { files?: Record<string, string> }
    if (!data.files || typeof data.files["notes.md"] !== "string") {
      throw new Error("sandbox payload")
    }
    return { files: data.files, live: true }
  } catch {
    return { files: { ...SEED }, live: false }
  }
}

export async function postSandbox(
  body: SandboxBody,
  current: Record<string, string>,
): Promise<{ files: Record<string, string>; live: boolean }> {
  try {
    const response = await fetch("/api/sandbox", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await response.json()) as {
      files?: Record<string, string>
      error?: string
    }
    if (!response.ok || !data.files) {
      throw new Error(data.error ?? "sandbox write failed")
    }
    return { files: data.files, live: true }
  } catch (error) {
    if (error instanceof TypeError) {
      if (body.op === "reset") return { files: { ...SEED }, live: false }
      return {
        files: { ...current, [body.file]: body.content },
        live: false,
      }
    }
    throw error
  }
}
