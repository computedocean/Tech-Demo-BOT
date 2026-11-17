import { mkdir } from "node:fs/promises"
import { chromium } from "playwright-core"

const baseUrl = process.env.LAB_URL ?? "http://127.0.0.1:5173"
const outDir = new URL("../out/", import.meta.url).pathname

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await context.newPage()
await page.goto(baseUrl, { waitUntil: "domcontentloaded" })
await page.getByTestId("source-badge").waitFor()
await page.getByTestId("stats-card").getByText("Trades").waitFor()
await page.getByTestId("candle-chart").waitFor()
await page.getByTestId("equity-chart").waitFor()
await page.screenshot({ path: `${outDir}lab-default.png` })

await page.getByTestId("trail-input").fill("8")
await page.getByTestId("run-button").click()
await page.getByTestId("run-note").getByText("trail 8%").waitFor()
await page.screenshot({ path: `${outDir}lab-trail-8.png` })
await page.screenshot({ path: `${outDir}lab-trail-8-full.png`, fullPage: true })

await page.getByTestId("symbol-btc").click()
await page.getByTestId("fast-input").fill("12")
await page.getByTestId("slow-input").fill("26")
await page.getByTestId("trail-input").fill("3")
await page.getByTestId("run-button").click()
await page.getByTestId("run-note").getByText("BTC 12/26 trail 3%").waitFor()
await page.getByTestId("equity-chart").waitFor()
await page.screenshot({ path: `${outDir}lab-btc.png` })

await page.getByTestId("fast-input").fill("")
await page.getByTestId("run-button").click()
await page.getByTestId("form-error").waitFor()
await page.screenshot({ path: `${outDir}lab-invalid.png` })

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
const phone = await mobile.newPage()
await phone.goto(baseUrl, { waitUntil: "domcontentloaded" })
await phone.getByTestId("stats-card").getByText("Trades").waitFor()
await phone.screenshot({ path: `${outDir}lab-mobile.png`, fullPage: true })
await mobile.close()

await context.close()
await browser.close()
console.log(`captured ${outDir}`)
