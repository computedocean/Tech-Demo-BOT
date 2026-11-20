import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Connect, type Plugin } from "vite"
import { publicLlmStatus, resolveVerdict } from "./src/server/llm.ts"
import { fetchPublicHourly, type PublicAsset } from "./src/server/public-candles.ts"
import { acceptWebhookBody, replayBundledSample } from "./src/server/webhook.ts"
import type { Packet } from "./src/lib/types.ts"

const root = path.dirname(fileURLToPath(import.meta.url))

function deskApi(): Plugin {
  const attach = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      const pathname = url.pathname
      if (pathname === "/api/llm-status" && req.method === "GET") {
        send(res, 200, publicLlmStatus())
        return
      }
      if (pathname === "/api/public-candles" && req.method === "GET") {
        const asset = url.searchParams.get("asset")
        if (asset !== "BTC" && asset !== "ETH") {
          send(res, 400, { ok: false, message: "Use asset=BTC or asset=ETH." })
          return
        }
        void fetchPublicHourly(asset as PublicAsset)
          .then((candles) => send(res, 200, { ok: true, ...candles }))
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Public candles are unavailable."
            send(res, 502, { ok: false, message: `${message} Staying on the bundled sample.` })
          })
        return
      }
      if (pathname === "/webhook/replay" && req.method === "POST") {
        const result = replayBundledSample()
        send(res, result.status, result.body)
        return
      }
      if (pathname === "/webhook" && req.method === "POST") {
        void readBody(req)
          .then((raw) => {
            const result = acceptWebhookBody(raw)
            send(res, result.status, result.body)
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Rejected: could not read the body."
            send(res, 400, { ok: false, message })
          })
        return
      }
      if (pathname === "/api/verdict" && req.method === "POST") {
        void readBody(req)
          .then(async (raw) => {
            const accepted = acceptWebhookBody(raw)
            if (!accepted.body.packet) {
              send(res, accepted.status, { ok: false, message: accepted.body.message })
              return
            }
            const result = await resolveVerdict(accepted.body.packet as Packet)
            send(res, 200, { ok: true, ...result })
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Could not read the verdict request."
            send(res, 400, { ok: false, message })
          })
        return
      }
      next()
    })
  }
  return {
    name: "agent-lens-desk-api",
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  const raw = JSON.stringify(body)
  res.statusCode = status
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.setHeader("content-length", Buffer.byteLength(raw))
  res.end(raw)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error("Rejected: body is larger than 64KB."))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

export default defineConfig({
  plugins: [react(), tailwindcss(), deskApi()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
})
