import type { IncomingMessage, ServerResponse } from "node:http"
import type { Connect, Plugin } from "vite"
import { handleDiagramBody } from "./diagram.ts"

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size <= 80_000) chunks.push(chunk)
    })
    req.on("end", () => {
      if (size > 80_000) {
        reject(new Error("too-large"))
        return
      }
      resolve(Buffer.concat(chunks).toString("utf8"))
    })
    req.on("error", reject)
  })
}

function middleware(req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction): void {
  const url = req.url ?? ""
  if (!url.startsWith("/api/diagram")) {
    next()
    return
  }
  if (req.method !== "POST") {
    send(res, 405, { ok: false, error: "POST only.", suggestions: [], usedLlm: false })
    return
  }
  void (async () => {
    try {
      const raw = await readBody(req)
      const body = raw ? (JSON.parse(raw) as unknown) : {}
      const result = await handleDiagramBody(body)
      send(res, result.ok ? 200 : 400, result)
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === "too-large"
      send(res, tooLarge ? 413 : 400, {
        ok: false,
        error: tooLarge ? "That request is too long." : "Could not read that request.",
        suggestions: [],
        usedLlm: false,
      })
    }
  })()
}

export function diagramApi(): Plugin {
  return {
    name: "archify-diagram-api",
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
