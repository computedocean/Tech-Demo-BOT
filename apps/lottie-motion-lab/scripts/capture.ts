import { mkdir } from "node:fs/promises"
import { chromium, type Page } from "playwright"

const baseUrl = process.env.LAB_URL ?? "http://127.0.0.1:5173"
const outDir = process.env.LAB_OUT ?? "/tmp/lottie-motion-lab-capture"

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 1280, height: 1040 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outDir,
    size: { width: 1280, height: 1040 },
  },
})
const page = await context.newPage()

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" })
  await page.getByRole("heading", { name: "Lottie motion lab" }).waitFor()
  await page.waitForTimeout(400)
  await shot(page, "lab-defaults.png")

  await page.getByTestId("personality-calm").click()
  await page.waitForTimeout(250)
  await page.getByTestId("play-button").click()
  await page.waitForTimeout(900)

  await page.getByTestId("duration-input").fill("1200")
  await page.getByTestId("easing-input").fill("cubic-bezier(0.2, 0, 0, 1)")
  await page.waitForTimeout(400)
  await shot(page, "lab-edited-before-replay.png")

  const before = await page.getByTestId("played-duration").innerText()
  if (!before.includes("640")) {
    throw new Error(`Edit should not replace the last play yet, saw ${before}`)
  }

  await page.getByTestId("play-button").click()
  await page.waitForTimeout(250)
  await shot(page, "lab-card-mid.png")
  await page.waitForTimeout(1200)
  await shot(page, "lab-after-replay.png")

  const played = await page.getByTestId("played-duration").innerText()
  const draft = await page.getByTestId("draft-duration").innerText()
  if (!played.includes("1200")) {
    throw new Error(`Expected last play to show 1200ms, saw ${played}`)
  }
  if (!draft.includes("1200")) {
    throw new Error(`Expected draft to show 1200ms, saw ${draft}`)
  }

  await page.getByTestId("pattern-loading-success").click()
  await page.getByTestId("play-button").click()
  await page.waitForTimeout(1100)
  await shot(page, "lab-success.png")

  await page.getByTestId("outcome-error").click()
  await page.getByTestId("play-button").click()
  await page.waitForTimeout(200)
  await shot(page, "lab-error-loading.png")
  await page.waitForTimeout(900)
  await shot(page, "lab-error.png")

  await page.getByTestId("personality-playful").click()
  await page.getByTestId("pattern-staggered-dashboard").click()
  await page.getByTestId("duration-input").fill("700")
  await page.getByTestId("play-button").click()
  await page.waitForTimeout(1400)
  await shot(page, "lab-dashboard.png")
} finally {
  await context.close()
  await browser.close()
}

console.log(`Captured lab walkthrough in ${outDir}`)

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${outDir}/${name}` })
}
