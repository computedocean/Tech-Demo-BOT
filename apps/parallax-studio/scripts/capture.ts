import { mkdirSync } from "node:fs"
import { chromium } from "playwright"

const baseURL = process.env.CAPTURE_URL ?? "http://127.0.0.1:5173"
const outDir = new URL("../output/screenshots/", import.meta.url)
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(baseURL, { waitUntil: "networkidle" })
await page.getByRole("heading", { name: "Parallax studio lab" }).waitFor()
await page.screenshot({
  path: new URL("01-studio.png", outDir).pathname,
  fullPage: true,
})

await page.getByTestId("generate").click()
await page.getByTestId("sample-badge").waitFor()
await page.screenshot({
  path: new URL("02-image-generate.png", outDir).pathname,
  fullPage: true,
})

await page.getByRole("tab", { name: "Video" }).click()
await page.getByTestId("generate").click()
await page.locator("video").waitFor()
await page.screenshot({
  path: new URL("03-video-generate.png", outDir).pathname,
  fullPage: true,
})

await page.getByRole("tab", { name: "Audio" }).click()
await page.getByTestId("generate").click()
await page.locator("audio").first().waitFor()
await page.screenshot({
  path: new URL("04-audio-generate.png", outDir).pathname,
  fullPage: true,
})

await page.getByTestId("batch-render").click()
await page.getByText("3 of 3 shots filled").waitFor()
await page.screenshot({
  path: new URL("05-cinema-batch.png", outDir).pathname,
  fullPage: true,
})

await page.getByTestId("propose-step").click()
await page.getByTestId("proposal").waitFor()
await page.screenshot({
  path: new URL("06-stand-in-proposal.png", outDir).pathname,
  fullPage: true,
})

await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({
  path: new URL("07-mobile.png", outDir).pathname,
  fullPage: true,
})

await browser.close()
console.log(`screenshots in ${outDir.pathname}`)
