import { expect, test } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'

test('scores a sample campaign and exports the tracker', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('footer-disclaimer')).toContainText('not affiliated with Rockstar Games')
  await expect(page.getByTestId('footer-disclaimer')).toContainText('does not post')
  await expect(page.getByTestId('footer-disclaimer')).toContainText('Analytics are simulated')
  await expect(page.getByTestId('campaign-scoreboard')).toBeVisible()
  await expect(page.getByTestId('campaign-card-sample-lantern')).toHaveAttribute('data-selected', 'true')
  await expect(page.getByTestId('campaign-streamers-sample-lantern')).toContainText('Nia Calder')
  await expect(page.getByTestId('campaign-rank-sample-lantern')).toHaveText('Rank 1')
  await expect(page.getByTestId('payout-simulated')).toHaveText('Simulated')

  await page.getByTestId('campaign-card-sample-paper').click()
  await expect(page.getByTestId('campaign-streamers-sample-paper')).toContainText('Jonah Pike')
  await expect(page.getByTestId('check-platform')).toHaveAttribute('data-pass', 'false')
  await page.getByTestId('campaign-card-sample-lantern').click()
  await expect(page.getByTestId('check-length')).toHaveAttribute('data-pass', 'true')
  await expect(page.getByTestId('check-aspect')).toHaveAttribute('data-pass', 'true')
  await expect(page.getByTestId('check-caption')).toHaveAttribute('data-pass', 'false')
  await expect(page.getByTestId('check-streamer')).toHaveAttribute('data-pass', 'false')
  await expect(page.getByTestId('check-policy')).toHaveAttribute('data-pass', 'false')
  await expect(page.getByTestId('mark-ready')).toBeDisabled()

  await mkdir('docs', { recursive: true })
  await page.getByTestId('jobs-top').screenshot({ path: 'docs/jobs-scoreboard.png' })

  await page.getByTestId('load-sample-paste').click()
  await page.getByTestId('parse-rules').click()
  await expect(page.getByTestId('campaign-name')).toHaveValue('Sample: Glasswater Run')
  await page.getByTestId('add-campaign').click()
  await expect(page.getByTestId('campaign-card-sample-glasswater-run')).toBeVisible()
  await page.getByTestId('campaign-card-sample-lantern').click()

  await page.getByTestId('job-streamer').selectOption('Nia Calder')
  await page.getByTestId('add-missing-tags').click()
  await page.getByTestId('policy-reviewed').check()
  await expect(page.getByTestId('check-caption')).toHaveAttribute('data-pass', 'true')
  await expect(page.getByTestId('check-streamer')).toHaveAttribute('data-pass', 'true')
  await expect(page.getByTestId('check-policy')).toHaveAttribute('data-pass', 'true')
  await expect(page.getByTestId('check-duplicate')).toHaveAttribute('data-pass', 'true')
  await expect(page.getByTestId('mark-ready')).toBeEnabled()
  await page.getByTestId('mark-ready').click()
  await expect(page.getByTestId('ready-state')).toHaveText('Ready')

  await page.getByTestId('simulate-views-sample-harbor').click()
  await expect(page.getByTestId('views-day1-sample-harbor')).not.toHaveValue('')
  await expect(page.getByTestId('views-day3-sample-harbor')).not.toHaveValue('')
  await expect(page.getByTestId('tracker-paid-sample-harbor')).toContainText('Simulated')

  await page.getByTestId('nightly-report-button').click()
  await expect(page.getByTestId('nightly-report')).toContainText('Nightly report (Simulated)')
  await expect(page.getByTestId('nightly-report')).toContainText('Simulated earnings')
  await expect(page.getByTestId('nightly-report')).toContainText('What to change')
  await page.getByTestId('friday-report-button').click()
  await expect(page.getByTestId('friday-report')).toContainText('Friday best titles')
  await expect(page.getByTestId('friday-report')).toContainText('Simulated')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-tracker-csv').click(),
  ])
  const csvPath = await download.path()
  expect(csvPath).toBeTruthy()
  const csv = await readFile(csvPath ?? '', 'utf8')
  expect(csv.split('\n')[0]).toBe('date,clip,platform,hook,views,paid')
  await expect(page.getByTestId('tracker-csv')).toContainText('date,clip,platform,hook,views,paid')
})
