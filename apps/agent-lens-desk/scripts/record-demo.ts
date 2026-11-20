import { mkdirSync } from "node:fs"
import { chromium } from "playwright-core"

const base = process.env.SCREENSHOT_URL ?? "http://127.0.0.1:5173"
const outDir = process.env.SCREENSHOT_DIR ?? "out/video"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: "chrome", headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  recordVideo: { dir: outDir, size: { width: 1440, height: 1100 } },
})
const page = await context.newPage()

await page.goto(base, { waitUntil: "networkidle" })
await page.getByTestId("verdict-decision").waitFor()
await page.getByTestId("packet-json").waitFor()
await page.waitForTimeout(700)

const next = page.getByRole("button", { name: "Next candle" })
for (let step = 0; step < 3; step++) {
  await next.click()
  await page.waitForTimeout(450)
}

const play = page.getByRole("button", { name: "Play", exact: true })
await play.click()
await page.getByTestId("verdict-decision").filter({ hasText: "LONG" }).waitFor({ timeout: 10000 })
await page.waitForTimeout(1600)
await page.getByRole("button", { name: "Pause", exact: true }).click()
await page.waitForTimeout(500)

await page.getByRole("button", { name: "Short setup" }).click()
await page.waitForTimeout(400)
for (let step = 0; step < 4; step++) {
  await next.click()
  await page.waitForTimeout(400)
}
await page.getByTestId("verdict-decision").filter({ hasText: "SHORT" }).waitFor({ timeout: 5000 })
await page.waitForTimeout(1200)

await page.getByRole("button", { name: "Replay bundled sample" }).click()
await page.getByTestId("webhook-message").waitFor()
await page.waitForTimeout(900)

await context.close()
await browser.close()
console.log(`video written under ${outDir}`)
