import { mkdirSync } from "node:fs"
import { chromium } from "playwright-core"

const base = process.env.SCREENSHOT_URL ?? "http://127.0.0.1:5173"
const outDir = process.env.SCREENSHOT_DIR ?? "out"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
})
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
})

await page.goto(base, { waitUntil: "networkidle" })
await page.getByRole("heading", { name: "Walk a system before you build it." }).waitFor()
await page.getByRole("button", { name: "Web app with API and database" }).click()
const canvas = page.getByTestId("canvas")
const api = canvas.getByRole("button", { name: "API", exact: true })
await api.waitFor()
await page.getByRole("button", { name: "Zoom in" }).click()
await page.getByRole("button", { name: "Zoom in" }).click()
const box = await canvas.boundingBox()
if (!box) throw new Error("canvas has no box")
await page.mouse.move(box.x + 28, box.y + 28)
await page.mouse.down()
await page.mouse.move(box.x + 120, box.y + 90, { steps: 8 })
await page.mouse.up()
await page.getByRole("button", { name: "Fit diagram" }).click()
await api.click()
await page.getByTestId("node-details").getByText("HTTP service").waitFor()
await page.getByRole("button", { name: "Highlight Read request" }).click()
await page.getByTestId("highlighted-path").waitFor()
await page.screenshot({ path: `${outDir}/diagram-highlight.png` })

await page.getByLabel("Follow-up edit").fill("add a Redis cache")
await page.getByRole("button", { name: "Apply edit" }).click()
const redis = canvas.getByRole("button", { name: "Redis", exact: true })
await redis.waitFor()
await page.getByText("Added Redis").waitFor()
await page.getByRole("button", { name: "Highlight Cache miss" }).click()
await page.getByTestId("highlighted-path").getByText("falls through to Postgres").waitFor()
await redis.click()
await page.getByTestId("node-details").getByRole("heading", { name: "Redis" }).waitFor()
await page.screenshot({ path: `${outDir}/diagram-redis.png` })
await page.screenshot({ path: `${outDir}/diagram-redis-full.png`, fullPage: true })

await browser.close()
console.log(`screenshots written to ${outDir}`)
