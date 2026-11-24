import { expect, test } from '@playwright/test'

test('plans the example and shows a local before/after', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('doctor')).toContainText(/ffmpeg on PATH|Dry-run/)
  await page.getByTestId('use-sample').click()
  await expect(page.getByTestId('clip-name')).toContainText('Synthetic test pattern')
  await page.getByTestId('example-chip').click()
  await expect(page.getByTestId('prompt')).toHaveValue(/trim to best 15s/)
  await page.getByTestId('plan-button').click()
  await expect(page.getByTestId('step-cut')).toBeVisible()
  await expect(page.getByTestId('step-caption')).toBeVisible()
  await expect(page.getByTestId('step-fit')).toBeVisible()
  await expect(page.getByTestId('step-loudness')).toBeVisible()
  await expect(page.getByTestId('ffmpeg-command').filter({ hasText: 'loudnorm=' }).first()).toBeVisible()
  await expect(page.getByTestId('ffmpeg-command').filter({ hasText: 'subtitles=' }).first()).toBeVisible()
  await page.getByTestId('run-button').click()
  const output = page.getByTestId('preview-output')
  await expect(output).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('run-status')).toContainText(/Local encode finished|Dry-run/)
  await output.evaluate(async (element) => {
    const video = element as HTMLVideoElement
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        video.addEventListener('loadeddata', () => resolve(), { once: true })
      })
    }
    video.currentTime = 2
    await new Promise<void>((resolve) => {
      video.addEventListener('seeked', () => resolve(), { once: true })
    })
  })
  await page.getByTestId('export-reels').click()
  await expect(page.getByTestId('step-export')).toContainText('export --preset reels')
  await page.screenshot({ path: 'docs/screenshot.png', fullPage: true })
})
