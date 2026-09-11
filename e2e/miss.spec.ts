import { expect, test } from '@playwright/test'
import { VIEWPORT, emptyStorageState, getGameState, gotoFresh, saveShot } from './helpers'

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  storageState: emptyStorageState,
})

test('drop off the globe does not place', async ({ page }) => {
  await gotoFresh(page)
  await page.getByRole('button', { name: 'Начать' }).click()
  const btn = page.locator('[data-iso="EG"]')
  await btn.scrollIntoViewIfNeeded()
  const box = await btn.boundingBox()
  if (!box) throw new Error('no EG')
  await page.mouse.move(box.x + box.width / 2, box.y + 8)
  await page.mouse.down()
  await page.mouse.move(48, 36, { steps: 20 })
  await page.mouse.up()
  const state = await getGameState(page)
  expect(state.placed).not.toContain('EG')
  await saveShot(page, 'miss.png')
})
