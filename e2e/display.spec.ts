import { expect, test } from '@playwright/test'
import {
  VIEWPORT,
  canvasBox,
  canvasStats,
  chooseFirst,
  dragWorldToWorld,
  emptyStorageState,
  faceCountry,
  getGameState,
  gotoFresh,
  openCollection,
  paintCountry,
  waitForProjected,
} from './helpers'

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  storageState: emptyStorageState,
})

test.describe.configure({ timeout: 45_000 })

test('title globe renders and the page does not crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await gotoFresh(page)

  await expect(page.getByText('World Snap').first()).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()

  await expect
    .poll(async () => (await canvasStats(page)).meanLuma, { timeout: 15_000 })
    .toBeGreaterThan(8)

  const stats = await canvasStats(page)
  expect(stats.meanLuma, 'globe is not a black void').toBeGreaterThan(8)
  expect(stats.pixels).toBeGreaterThan(0)
  expect(errors, `uncaught page errors: ${errors.join('; ')}`).toEqual([])
})

test('snapping Italy with a real pointer paints colorful pixels', async ({ page }) => {
  await gotoFresh(page)
  await page.getByRole('button', { name: 'К столу' }).click()
  await expect(page.getByText('Выбери страну.')).toBeVisible()

  await chooseFirst(page, 'IT')
  await paintCountry(page, 'IT')
  await faceCountry(page, 'IT')
  const from = await waitForProjected(page, 'piece', 'IT')
  const to = await waitForProjected(page, 'country', 'IT')
  await dragWorldToWorld(page, from, to)

  await expect
    .poll(async () => (await getGameState(page)).placed, { timeout: 5_000 })
    .toContain('IT')

  await expect
    .poll(async () => (await canvasStats(page)).colorful, { timeout: 10_000 })
    .toBeGreaterThan(0)
})

test('collection overlay does not remove the canvas', async ({ page }) => {
  await gotoFresh(page)
  await expect(page.locator('canvas')).toBeVisible()
  const before = await canvasBox(page)

  await openCollection(page, true)
  await expect(page.getByText('Коллекция')).toBeVisible()
  await expect(page.getByText('Скоро').first()).toBeVisible()

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  const after = await canvasBox(page)
  expect(after.width).toBeGreaterThan(100)
  expect(after.height).toBeGreaterThan(100)
  expect(after.width).toBeCloseTo(before.width, 0)
  expect(after.height).toBeCloseTo(before.height, 0)

  const stats = await canvasStats(page)
  expect(stats.pixels).toBeGreaterThan(0)
})
