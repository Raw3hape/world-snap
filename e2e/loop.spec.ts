import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import {
  OUTPUT_DIR,
  VIEWPORT,
  canvasStats,
  emptyStorageState,
  getGameState,
  gotoFresh,
  pointerDragPieceToCountry,
  saveShot,
} from './helpers'

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  storageState: emptyStorageState,
})

test.describe.configure({ timeout: 60_000 })

test('title to Italy snap on the light globe', async ({ page }) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  await gotoFresh(page)

  await expect(page.getByText('World Snap').first()).toBeVisible()
  await expect(page.getByText('Собери мир из стран')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Начать' })).toBeVisible()
  await saveShot(page, '01-title.png')
  const titleStats = await canvasStats(page)
  expect(titleStats.meanLuma).toBeGreaterThan(8)

  await page.getByRole('button', { name: 'Начать' }).click()
  await expect(page.locator('[data-iso="IT"]')).toBeVisible()
  await saveShot(page, '02-choose.png')

  await pointerDragPieceToCountry(page, 'IT', 'IT')
  await expect
    .poll(async () => (await getGameState(page)).placed, { timeout: 8_000 })
    .toContain('IT')
  await saveShot(page, '04-italy-snapped.png')
  const after = await canvasStats(page)
  expect(after.colorful).toBeGreaterThan(0)
})
