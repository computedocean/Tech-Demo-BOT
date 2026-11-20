import { chromium } from "playwright-core"

const base = process.env.SCREENSHOT_URL ?? "http://127.0.0.1:5173"
const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
const failures: string[] = []
const note = (label: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "ok" : "FAIL"} ${label}: ${detail}`)
  if (!ok) failures.push(`${label}: ${detail}`)
}

await page.goto(base, { waitUntil: "networkidle" })
await page.getByRole("heading", { name: "Agent Lens desk" }).waitFor()
const decision = page.getByTestId("verdict-decision")
note("initial", (await decision.innerText()) === "WAIT", await decision.innerText())
note(
  "schema",
  (await page.getByTestId("packet-json").innerText()).includes('"schema": "ai-agent-lens/v1"'),
  "packet schema",
)
const footer = await page.locator("footer").innerText()
note(
  "footer",
  footer.includes("Not financial advice") &&
    footer.includes("tradingview-indicator-for-ai-agents") &&
    footer.includes("TradingView Lightweight Charts") &&
    (await page.locator("footer a[href='https://www.tradingview.com/']").count()) === 1 &&
    (await page.locator("footer a[href='https://github.com/roan-maverick/tradingview-indicator-for-ai-agents']").count()) === 1,
  footer,
)

const next = page.getByRole("button", { name: "Next candle" })
for (let i = 0; i < 8; i++) await next.click()
note("long", (await decision.innerText()) === "LONG", await decision.innerText())
note("entry", (await page.getByTestId("verdict-entry").innerText()) !== "—", await page.getByTestId("verdict-entry").innerText())
note("stop", (await page.getByTestId("verdict-stop").innerText()) !== "—", await page.getByTestId("verdict-stop").innerText())
note("tp1", (await page.getByTestId("verdict-tp1").innerText()) !== "—", await page.getByTestId("verdict-tp1").innerText())
note("risk", (await page.getByTestId("verdict-risk").innerText()).startsWith("Failure risk:"), await page.getByTestId("verdict-risk").innerText())
const longPacket = await page.getByTestId("packet-json").innerText()
note(
  "long packet",
  longPacket.includes('"schema": "ai-agent-lens/v1"') && (await page.getByTestId("score-long").innerText()).length > 0,
  longPacket.slice(0, 160),
)
await page.screenshot({ path: "out/agent-lens-long.png" })

await page.getByRole("button", { name: "Previous candle" }).click()
const afterPrev = await page.getByTestId("packet-json").innerText()
note("prev changes packet", afterPrev !== longPacket, "packet text differs after previous")

await page.getByRole("button", { name: "Short setup" }).click()
for (let i = 0; i < 6; i++) {
  if ((await decision.innerText()) === "SHORT") break
  await next.click()
}
note("short", (await decision.innerText()) === "SHORT", await decision.innerText())
note("short entry", (await page.getByTestId("verdict-entry").innerText()) !== "—", await page.getByTestId("verdict-entry").innerText())
await page.screenshot({ path: "out/agent-lens-short.png" })

await page.getByRole("button", { name: "High volatility" }).click()
const hv = await page.getByTestId("packet-json").innerText()
note("high vol", hv.includes("HIGH_VOLATILITY"), hv.match(/"regime": "[A-Z_]+"/)?.[0] ?? "missing regime")

await page.getByRole("button", { name: "SAMPLE ETH" }).click()
await page.waitForTimeout(200)
note("eth", (await page.locator("body").innerText()).includes("SAMPLE ETH"), "badge")
note("eth symbol", (await page.getByTestId("packet-json").innerText()).includes("SAMPLE:ETHUSD"), "symbol")

const live = page.getByRole("switch", { name: "Live public candles" })
await live.click()
await page.waitForTimeout(4000)
const body = await page.locator("body").innerText()
const liveOn = body.includes("BINANCE:") || body.includes("KRAKEN:")
const stayed = body.includes("SAMPLE ETH") || body.includes("SAMPLE BTC")
note("live or fallback", liveOn || stayed, liveOn ? "live source" : "stayed on sample")
if (liveOn) {
  await page.screenshot({ path: "out/agent-lens-live.png" })
  await live.click()
  await page.waitForTimeout(300)
}

await page.getByRole("button", { name: "Replay bundled sample" }).click()
const replay = await page.getByTestId("webhook-message").innerText()
note("replay", replay.toLowerCase().includes("no order"), replay)
const replayPacket = await page.getByTestId("webhook-packet").innerText()
note("replay symbol", replayPacket.includes("BINANCE:HYPEUSDT.P"), replayPacket.slice(0, 120))

await page.locator("textarea").fill('{"schema":"ai-agent-lens/v1","event":"BAR_CLOSE","symbol":"SAMPLE:POST"}')
await page.getByRole("button", { name: "Post JSON" }).click()
await page.getByTestId("webhook-message").filter({ hasText: "Accepted" }).waitFor()
const posted = await page.getByTestId("webhook-message").innerText()
note("post sample", posted.toLowerCase().includes("no order") && posted.includes("SAMPLE:POST") === false, posted)
const postedPacket = await page.getByTestId("webhook-packet").innerText()
note("posted packet", postedPacket.includes('"schema": "ai-agent-lens/v1"'), postedPacket.slice(0, 140))

await page.locator("textarea").fill('{"schema":"not-lens","event":"BAR_CLOSE"}')
await page.getByRole("button", { name: "Post JSON" }).click()
await page.getByTestId("webhook-message").filter({ hasText: "Rejected" }).waitFor()
const rejected = await page.getByTestId("webhook-message").innerText()
note("reject", rejected.includes("expected schema") && rejected.includes("ai-agent-lens/v1"), rejected)

await browser.close()
if (failures.length) {
  console.error(failures.join("\n"))
  process.exit(1)
}
console.log("flow verified")
