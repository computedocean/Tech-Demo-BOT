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
await page.getByRole("heading", { name: "Pine Script v6" }).waitFor()
await page.getByText("Sharpe", { exact: true }).waitFor()
await page.getByText("//@version=6").waitFor()
await page.screenshot({ path: `${outDir}/idea-lab-overview.png`, fullPage: true })
await page.screenshot({ path: `${outDir}/idea-lab-viewport.png` })

await page.getByLabel("Plain English").fill("mean-revert bitcoin with a kalman filter")
await page.getByRole("button", { name: "Run idea" }).click()
await page.getByRole("alert").waitFor()
await page.getByText("does not recognize").waitFor()
await page.screenshot({ path: `${outDir}/idea-lab-unrecognized.png` })

await page.getByRole("button", { name: "EMA 8/55 crossover on SPY daily" }).click()
await page.getByRole("button", { name: "Run idea" }).click()
await page.getByRole("heading", { name: "Pine Script v6" }).waitFor()
await page.getByRole("button", { name: "Save run" }).click()
await page.getByText('Saved "EMA 8/55 crossover".').waitFor()

await page.getByRole("button", { name: "20-day breakout on SPY daily" }).click()
await page.getByRole("button", { name: "Run idea" }).click()
await page.getByRole("heading", { name: "Local backtest" }).waitFor()
await page.getByText("20-day breakout", { exact: true }).waitFor()
await page.getByRole("button", { name: "Save run" }).click()
await page.getByText('Saved "20-day breakout".').waitFor()

const boxes = page.getByRole("checkbox")
await boxes.nth(0).check()
await boxes.nth(1).check()
await page.getByRole("button", { name: "Compare selected" }).click()
const comparison = page.getByRole("heading", { name: "Comparison" })
await comparison.waitFor()
await comparison.scrollIntoViewIfNeeded()
await page.screenshot({ path: `${outDir}/idea-lab-compare.png` })

await page.getByText("Each curve is rebased to 100").scrollIntoViewIfNeeded()
await page.screenshot({ path: `${outDir}/idea-lab-compare-curves.png` })

await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: `${outDir}/idea-lab-mobile.png` })

await browser.close()
console.log(`screenshots written to ${outDir}`)
