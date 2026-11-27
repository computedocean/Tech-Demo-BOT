import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { LENS_SCHEMA, type Packet } from "../lib/types.ts"

const MAX_BODY = 64 * 1024

export type WebhookResult = {
  status: number
  body: {
    ok: boolean
    message: string
    packet?: Packet
  }
}

export function loadBundledSample(): Packet {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../data/sample-packet.json")
  return JSON.parse(readFileSync(path, "utf8")) as Packet
}

export function acceptWebhookBody(raw: string): WebhookResult {
  if (raw.length === 0) {
    return reject(`Rejected: empty body. Expected a JSON object with schema "${LENS_SCHEMA}".`)
  }
  if (raw.length > MAX_BODY) {
    return reject("Rejected: body is larger than 64KB.")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return reject("Rejected: body is not valid JSON.")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return reject(`Rejected: expected a JSON object with schema "${LENS_SCHEMA}".`)
  }
  const schema = (parsed as { schema?: unknown }).schema
  if (schema !== LENS_SCHEMA) {
    const shown = schema === undefined ? "missing" : JSON.stringify(schema)
    return reject(`Rejected: expected schema "${LENS_SCHEMA}", received ${shown}.`)
  }
  return {
    status: 200,
    body: {
      ok: true,
      message: "Accepted ai-agent-lens/v1 packet. Stored on this desk only. No order was placed.",
      packet: parsed as Packet,
    },
  }
}

export function replayBundledSample(): WebhookResult {
  const packet = loadBundledSample()
  const accepted = acceptWebhookBody(JSON.stringify(packet))
  if (!accepted.body.ok || !accepted.body.packet) return accepted
  return {
    status: 200,
    body: {
      ok: true,
      message:
        "Replayed the bundled sample packet adapted from the upstream MIT example (not a live TradingView alert). No order was placed.",
      packet: accepted.body.packet,
    },
  }
}

function reject(message: string): WebhookResult {
  return { status: 400, body: { ok: false, message } }
}
