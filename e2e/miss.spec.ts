import { expect, test } from '@playwright/test'
import {
  VIEWPORT,
  chooseFirst,
  emptyStorageState,
  getGameState,
  gotoFresh,
  placeCountry,
  pointerDragPieceToCountry,
  saveShot,
} from './helpers'

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  storageState: emptyStorageState,
})

test('wrong country does not snap', async ({ page }) => {
  await gotoFresh(page)
  await page.getByRole('button', { name: 'К столу' }).click()
  await expect(page.getByText('Выбери страну.')).toBeVisible()

  await chooseFirst(page, 'IT')
  for (const id of ['IT', 'JP', 'BR', 'AU', 'IN', 'MG'] as const) {
    await placeCountry(page, id)
  }

  await pointerDragPieceToCountry(page, 'EG', 'BR')
  const state = await getGameState(page)
  expect(state.placed, 'Egypt must not snap onto Brazil').not.toContain('EG')
  await saveShot(page, 'miss.png')
})
