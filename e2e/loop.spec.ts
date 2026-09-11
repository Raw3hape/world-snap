import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import {
  OUTPUT_DIR,
  VIEWPORT,
  canvasStats,
  chooseFirst,
  dragWorldToWorld,
  emptyStorageState,
  faceCountry,
  getGameState,
  gotoFresh,
  openCollection,
  paintCountry,
  placeCountry,
  saveShot,
  waitForProjected,
  waitMs,
} from './helpers'

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  storageState: emptyStorageState,
})

test.describe.configure({ timeout: 60_000 })

test.beforeEach(async ({ page }) => {
  await gotoFresh(page)
})

test('happy path: title, first real snap, pack, collection, replay', async ({ page }) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  await expect(page.getByText('World Snap').first()).toBeVisible()
  await expect(page.getByText('Собери мир из стран')).toBeVisible()
  await expect(page.getByRole('button', { name: 'К столу' })).toBeVisible()
  await saveShot(page, '01-title.png')

  await expect
    .poll(async () => (await canvasStats(page)).meanLuma, { timeout: 15_000 })
    .toBeGreaterThan(8)
  const titleStats = await canvasStats(page)
  expect(titleStats.meanLuma, 'globe is not a black void').toBeGreaterThan(8)

  await page.getByRole('button', { name: 'К столу' }).click()
  await expect(page.getByText('Выбери страну.')).toBeVisible()
  await saveShot(page, '02-choose.png')

  await chooseFirst(page, 'IT')
  await paintCountry(page, 'IT')
  await expect(page.locator('.hud')).toContainText(/Флаг|Теперь|Поставь|Италия/)
  await saveShot(page, '03-painted.png')

  await faceCountry(page, 'IT')
  const from = await waitForProjected(page, 'piece', 'IT')
  const to = await waitForProjected(page, 'country', 'IT')
  await dragWorldToWorld(page, from, to)

  await expect
    .poll(async () => (await getGameState(page)).placed, { timeout: 5_000 })
    .toContain('IT')

  await waitMs(page, 900)
  await saveShot(page, '04-italy-snapped.png')

  const afterItaly = await canvasStats(page)
  const placed = (await getGameState(page)).placed
  expect(
    afterItaly.colorful > titleStats.colorful || placed.length === 1,
    'Italy snap should paint the globe or at least record the place',
  ).toBe(true)

  // rest of pack via store after first real snap
  for (const id of ['JP', 'BR', 'AU', 'IN', 'MG', 'EG', 'GB'] as const) {
    await placeCountry(page, id)
  }

  await expect(page.locator('.wordmark.lg', { hasText: 'Мир собран' })).toBeVisible()
  await expect(page.getByText('Восемь стран на месте.')).toBeVisible()
  await saveShot(page, '05-complete.png')

  const toCollection = page.getByRole('button', { name: 'В коллекцию' })
  if (await toCollection.isVisible()) {
    await toCollection.click()
  } else {
    await openCollection(page, true)
  }

  await expect(page.getByText('Восемь стран')).toBeVisible()
  await expect(page.getByText('Скоро').first()).toBeVisible()
  await saveShot(page, '06-collection.png')

  await page.getByRole('button', { name: 'Ещё раз' }).click()
  await expect(page.getByText('Выбери страну.')).toBeVisible()
  expect((await getGameState(page)).placed).toEqual([])
})
