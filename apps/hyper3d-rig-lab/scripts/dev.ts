import { fileURLToPath } from "node:url"

const cwd = fileURLToPath(new URL("..", import.meta.url))

const server = Bun.spawn(["bun", "./server/index.ts"], {
  cwd,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
})

const vite = Bun.spawn(["bun", "./node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "5173"], {
  cwd,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
})

let stopped = false
const stop = () => {
  if (stopped) return
  stopped = true
  server.kill()
  vite.kill()
}

process.on("SIGINT", () => {
  stop()
  process.exit(0)
})
process.on("SIGTERM", () => {
  stop()
  process.exit(0)
})

console.log("Hyper3D Rigging Lab: http://127.0.0.1:5173")

const code = await Promise.race([server.exited, vite.exited])
stop()
process.exit(typeof code === "number" ? code : 0)
