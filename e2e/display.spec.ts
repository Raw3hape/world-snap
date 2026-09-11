import { expect, test } from '@playwright/test'
import {
  VIEWPORT,
  canvasStats,
  emptyStorageState,
  getGameState,
  gotoFresh,
  pointerDragPieceToCountry,
} from './helpers'

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  storageState: emptyStorageState,
})

test.describe.configure({ timeout: 45_000 })

test('title globe renders on a light ground', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await gotoFresh(page)
  await expect(page.locator('canvas')).toBeVisible()
  await expect.poll(async () => (await canvasStats(page)).meanLuma, { timeout: 15_000 }).toBeGreaterThan(20)
  expect(errors).toEqual([])
})

test('snapping Italy paints the globe', async ({ page }) => {
  await gotoFresh(page)
  await page.getByRole('button', { name: 'Начать' }).click()
  await pointerDragPieceToCountry(page, 'IT', 'IT')
  await expect.poll(async () => (await getGameState(page)).placed, { timeout: 8_000 }).toContain('IT')
  await expect.poll(async () => (await canvasStats(page)).colorful, { timeout: 10_000 }).toBeGreaterThan(0)
})

test('tray does not remove the canvas', async ({ page }) => {
  await gotoFresh(page)
  await page.getByRole('button', { name: 'Начать' }).click()
  await expect(page.locator('.tray')).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  const stats = await canvasStats(page)
  expect(stats.pixels).toBeGreaterThan(0)
})
