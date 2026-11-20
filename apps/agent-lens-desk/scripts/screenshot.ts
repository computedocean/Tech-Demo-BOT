import { mkdirSync } from "node:fs"
import { chromium } from "playwright-core"

const base = process.env.SCREENSHOT_URL ?? "http://127.0.0.1:5173"
const outDir = process.env.SCREENSHOT_DIR ?? "out"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
})

await page.goto(base, { waitUntil: "networkidle" })
await page.getByRole("heading", { name: "Agent Lens desk" }).waitFor()
await page.getByTestId("verdict-decision").waitFor()
await page.getByTestId("packet-json").waitFor()
await page.getByText("ai-agent-lens/v1").first().waitFor()
await page.screenshot({ path: `${outDir}/agent-lens-desk.png`, fullPage: true })
await page.screenshot({ path: `${outDir}/agent-lens-viewport.png` })

await browser.close()
console.log(`screenshots written to ${outDir}`)
