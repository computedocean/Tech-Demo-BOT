import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.playwright.ts",
  timeout: 60_000,
  outputDir: "./test-results",
  use: {
    baseURL: "http://127.0.0.1:5191",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    video: "off",
    channel: "chrome",
  },
  webServer: {
    command: "bun run dev",
    url: "http://127.0.0.1:5191",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        channel: "chrome",
      },
    },
  ],
});
