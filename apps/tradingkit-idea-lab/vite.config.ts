import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { generateFromIdea } from "./server/generate.ts"

const root = path.dirname(fileURLToPath(import.meta.url))

function ideaApi(): Plugin {
  return {
    name: "idea-lab-api",
    configureServer(server) {
      server.middlewares.use("/api/generate", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405
          res.setHeader("content-type", "application/json; charset=utf-8")
          res.end(JSON.stringify({ ok: false, error: "POST only.", suggestions: [] }))
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        req.on("data", (chunk: Buffer) => {
          size += chunk.length
          if (size <= 10_000) chunks.push(chunk)
        })
        req.on("end", () => {
          void (async () => {
            if (size > 10_000) {
              res.statusCode = 413
              res.setHeader("content-type", "application/json; charset=utf-8")
              res.end(JSON.stringify({ ok: false, error: "That idea is too long.", suggestions: [] }))
              return
            }
            try {
              const raw = Buffer.concat(chunks).toString("utf8")
              const body = raw ? (JSON.parse(raw) as { idea?: unknown }) : {}
              const idea = typeof body.idea === "string" ? body.idea : ""
              const result = await generateFromIdea(idea)
              res.statusCode = result.ok ? 200 : 400
              res.setHeader("content-type", "application/json; charset=utf-8")
              res.end(JSON.stringify(result))
            } catch {
              res.statusCode = 400
              res.setHeader("content-type", "application/json; charset=utf-8")
              res.end(JSON.stringify({ ok: false, error: "Could not read that request.", suggestions: [] }))
            }
          })()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ideaApi()],
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
