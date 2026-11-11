import fs from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import type { Plugin, PreviewServer, ViteDevServer } from "vite"

const ALLOWED = new Set(["notes.md", "readme.txt", "browser-session.txt"])

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > 200_000) {
        reject(new Error("body too large"))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.end(payload)
}

export function sandboxPlugin(appRoot: string): Plugin {
  const seedDir = path.resolve(appRoot, "sandbox")
  const runtimeDir = path.resolve(seedDir, ".runtime")

  function readSeed(): Record<string, string> {
    const files: Record<string, string> = {}
    if (!fs.existsSync(seedDir)) return files
    for (const name of fs.readdirSync(seedDir)) {
      if (!ALLOWED.has(name)) continue
      const full = path.join(seedDir, name)
      if (fs.statSync(full).isFile()) files[name] = fs.readFileSync(full, "utf8")
    }
    return files
  }

  function resetRuntime() {
    fs.rmSync(runtimeDir, { recursive: true, force: true })
    fs.mkdirSync(runtimeDir, { recursive: true })
    for (const [name, content] of Object.entries(readSeed())) {
      fs.writeFileSync(path.join(runtimeDir, name), content)
    }
  }

  function ensureRuntime() {
    if (!fs.existsSync(runtimeDir)) resetRuntime()
  }

  function readRuntime(): Record<string, string> {
    ensureRuntime()
    const files: Record<string, string> = {}
    for (const name of ALLOWED) {
      const full = path.join(runtimeDir, name)
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        files[name] = fs.readFileSync(full, "utf8")
      }
    }
    return files
  }

  function writeRuntime(name: string, content: string) {
    if (!ALLOWED.has(name) || name.includes("/") || name.includes("\\")) {
      throw new Error("file not allowed")
    }
    if (content.length > 100_000) throw new Error("file too large")
    ensureRuntime()
    const dest = path.resolve(runtimeDir, name)
    if (dest !== path.join(runtimeDir, name)) throw new Error("path refused")
    fs.writeFileSync(dest, content)
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    try {
      if (req.method === "GET") {
        send(res, 200, { files: readRuntime(), root: "sandbox/.runtime" })
        return
      }
      if (req.method !== "POST") {
        send(res, 405, { error: "method not allowed" })
        return
      }
      const data = JSON.parse(await readBody(req)) as {
        op?: string
        file?: string
        content?: string
      }
      if (data.op === "reset") {
        resetRuntime()
        send(res, 200, { files: readRuntime() })
        return
      }
      if (
        data.op === "write" &&
        typeof data.file === "string" &&
        typeof data.content === "string"
      ) {
        writeRuntime(data.file, data.content)
        send(res, 200, { files: readRuntime() })
        return
      }
      send(res, 400, { error: "unsupported sandbox operation" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "sandbox error"
      send(res, 400, { error: message })
    }
  }

  function attach(middlewares: ViteDevServer["middlewares"]) {
    middlewares.use("/api/sandbox", (req, res) => {
      void handle(req, res)
    })
  }

  return {
    name: "switchboard-sandbox",
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server: PreviewServer) {
      attach(server.middlewares)
    },
  }
}
