import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

test('plans a clip and captures the desk', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('footer-disclaimer')).toContainText('not affiliated with Rockstar Games')
  await expect(page.getByTestId('footer-disclaimer')).toContainText('does not post')
  await expect(page.getByTestId('footer-disclaimer')).toContainText('Analytics are simulated')
  await expect(page.getByTestId('analytics-panel')).toContainText('Simulated')
  await expect(page.getByTestId('simulated-badge')).toHaveText('Simulated')

  await page.getByTestId('clip-card-rooftop-hop').click()
  await expect(page.getByTestId('clip-title')).toHaveValue('Rooftop hop')
  const trimOut = page.getByTestId('trim-out')
  await trimOut.focus()
  for (let step = 0; step < 12; step += 1) {
    await trimOut.press('ArrowLeft')
  }
  await expect(page.getByTestId('playhead')).toContainText('0:04.8')
  await page.getByTestId('generate-captions').click()
  await expect(page.getByTestId('preview-caption')).toContainText('Rooftop hop')
  await expect(page.getByTestId('preview-aspect')).toHaveText('9:16')
  await expect(page.getByTestId('notice')).toContainText('No key required')

  await page.getByTestId('restore-week').click()
  const drag = page.getByTestId('queue-drag-sample-harbor')
  const slot = page.getByTestId('slot-fri-evening')
  await drag.dragTo(slot)
  await expect(slot.getByTestId('queue-item-sample-harbor')).toBeVisible()
  await expect(page.getByTestId('notice')).toContainText('fri evening')

  await mkdir('docs', { recursive: true })
  await page.screenshot({ path: 'docs/screenshot.png', fullPage: true })
})

test('stacks the desk on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Clip desk' })).toBeVisible()
  await expect(page.getByTestId('clip-library')).toBeVisible()
  await expect(page.getByTestId('preview-frame')).toBeVisible()
  await expect(page.getByTestId('week-board')).toBeVisible()
  await page.getByTestId('filter-stunt').click()
  await expect(page.getByTestId('clip-card-rooftop-hop')).toBeVisible()
  await expect(page.getByTestId('clip-card-harbor-cruise')).toHaveCount(0)
})
