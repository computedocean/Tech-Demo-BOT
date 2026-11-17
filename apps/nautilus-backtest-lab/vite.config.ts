import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin, type ViteDevServer } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss(), backtestApi()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
})

function backtestApi(): Plugin {
  return {
    name: "backtest-api",
    configureServer(server) {
      server.middlewares.use("/api/backtest", (req, res, next) => {
        if (req.method !== "POST") {
          next()
          return
        }
        void respond(server, req, res)
      })
    },
  }
}

async function respond(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  try {
    const raw = await readBody(req)
    const handler = (await server.ssrLoadModule("/src/server/handle.ts")) as {
      handleBacktest: (body: string) => Promise<{ ok: boolean }>
    }
    const payload = await handler.handleBacktest(raw)
    res.statusCode = payload.ok ? 200 : 400
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify(payload))
  } catch {
    res.statusCode = 500
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: false, error: "Backtest API failed." }))
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", () => reject(new Error("request body failed")))
  })
}
