import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export const VIEWPORT = { width: 1440, height: 900 } as const
export const OUTPUT_DIR = path.join(process.cwd(), 'e2e', 'output')

/** Experience.tsx subtracts 8px from mouse clientY when building the drag ray. */
const MOUSE_LIFT_Y = 8

export type Vec3 = [number, number, number]

export type GameSnapshot = {
  phase: string
  placed: string[]
  painted: string[]
  firstId: string | null
  collectionOpen: boolean
  missAt: number
  snapAt: number
  draggingId: string | null
}

export type CanvasStats = {
  pixels: number
  meanLuma: number
  colorful: number
}

type WsBridge = {
  ready: boolean
  size: { width: number; height: number }
  project: (world: Vec3) => { x: number; y: number } | null
  pieceWorld: (id: string) => Vec3 | null
  countryWorld: (id: string) => Vec3 | null
  faceCountry: (id: string) => void
  canvasStats: () => CanvasStats
}

type GameStore = {
  getState: () => GameSnapshot & {
    toTable: () => void
    chooseFirst: (id: string) => void
    paint: (id: string) => void
    place: (id: string) => void
    replay: () => void
    openCollection: (open: boolean) => void
    flashMiss: () => void
  }
}

type BridgeWindow = Window & {
  __ws?: WsBridge
  __worldSnap?: GameStore
}

export const emptyStorageState = { cookies: [], origins: [] }

export async function waitMs(page: Page, ms: number) {
  await page.evaluate((t) => new Promise<void>((r) => setTimeout(r, t)), ms)
}

export async function waitFrames(page: Page, count = 1) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    }
  }, count)
}

export async function waitForBridge(page: Page) {
  await page.waitForFunction(
    () => {
      const w = window as BridgeWindow
      const ws = w.__ws
      return Boolean(w.__worldSnap && ws && ws.ready && ws.size.width > 0 && ws.size.height > 0)
    },
    { timeout: 30_000 },
  )
}

export async function gotoFresh(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {
      /* private mode */
    }
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForBridge(page)
}

export async function canvasBox(page: Page) {
  const box = await page.locator('canvas').first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  if (box.width < 2 || box.height < 2) throw new Error('canvas is not laid out')
  return box
}

export async function pagePointFromWorld(page: Page, world: Vec3) {
  const box = await canvasBox(page)
  const proj = await page.evaluate((w) => {
    const ws = (window as BridgeWindow).__ws
    if (!ws) return null
    return ws.project(w)
  }, world)
  if (!proj) throw new Error(`project() returned null for [${world.join(', ')}]`)
  return { x: box.x + proj.x, y: box.y + proj.y }
}

export async function getGameState(page: Page): Promise<GameSnapshot> {
  return page.evaluate(() => {
    const s = (window as BridgeWindow).__worldSnap!.getState()
    return {
      phase: s.phase,
      placed: [...s.placed],
      painted: [...s.painted],
      firstId: s.firstId,
      collectionOpen: s.collectionOpen,
      missAt: s.missAt,
      snapAt: s.snapAt,
      draggingId: s.draggingId,
    }
  })
}

export async function canvasStats(page: Page): Promise<CanvasStats> {
  await waitFrames(page, 2)
  return page.evaluate(() => (window as BridgeWindow).__ws!.canvasStats())
}

export async function faceCountry(page: Page, id: string) {
  await page.evaluate((iso) => {
    const ws = (window as BridgeWindow).__ws
    if (!ws) throw new Error('__ws missing')
    ws.faceCountry(iso)
  }, id)
  await waitFrames(page, 3)
}

export async function waitForProjected(
  page: Page,
  kind: 'piece' | 'country',
  id: string,
): Promise<Vec3> {
  await page.waitForFunction(
    ({ kind: k, id: iso }) => {
      const ws = (window as BridgeWindow).__ws
      if (!ws?.ready) return false
      const world = k === 'piece' ? ws.pieceWorld(iso) : ws.countryWorld(iso)
      return Boolean(world && ws.project(world))
    },
    { kind, id },
    { timeout: 15_000 },
  )
  const world = await page.evaluate(
    ({ kind: k, id: iso }) => {
      const ws = (window as BridgeWindow).__ws!
      return k === 'piece' ? ws.pieceWorld(iso) : ws.countryWorld(iso)
    },
    { kind, id },
  )
  if (!world) throw new Error(`${kind}World('${id}') is null`)
  return world
}

export async function chooseFirst(page: Page, id: string) {
  await page.evaluate((iso) => {
    ;(window as BridgeWindow).__worldSnap!.getState().chooseFirst(iso)
  }, id)
  await page.waitForFunction((iso) => {
    return (window as BridgeWindow).__worldSnap!.getState().firstId === iso
  }, id)
}

export async function paintCountry(page: Page, id: string) {
  await page.evaluate((iso) => {
    ;(window as BridgeWindow).__worldSnap!.getState().paint(iso)
  }, id)
}

export async function placeCountry(page: Page, id: string) {
  await page.evaluate((iso) => {
    ;(window as BridgeWindow).__worldSnap!.getState().place(iso)
  }, id)
}

export async function openCollection(page: Page, open = true) {
  await page.evaluate((value) => {
    ;(window as BridgeWindow).__worldSnap!.getState().openCollection(value)
  }, open)
}

export async function saveShot(page: Page, filename: string) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename) })
}

/**
 * Real pointer drag from one world point to another.
 * Mouse-down must hit the piece mesh; this does not call store.place.
 */
export async function dragWorldToWorld(
  page: Page,
  from: Vec3,
  to: Vec3,
  settleMs = 400,
) {
  const start = await pagePointFromWorld(page, from)
  const dest = await pagePointFromWorld(page, to)
  const end = { x: dest.x, y: dest.y + MOUSE_LIFT_Y }

  const offsets: [number, number][] = [
    [0, 0],
    [0, -8],
    [10, 0],
    [-10, 0],
    [0, 12],
    [12, 8],
    [-12, 8],
  ]

  let grabbed = false
  for (const [dx, dy] of offsets) {
    await page.mouse.move(start.x + dx, start.y + dy)
    await page.mouse.down({ button: 'left' })
    await waitFrames(page, 2)
    const dragging = await page.evaluate(
      () => (window as BridgeWindow).__worldSnap?.getState().draggingId ?? null,
    )
    if (dragging) {
      grabbed = true
      break
    }
    await page.mouse.up()
    await waitFrames(page, 1)
  }

  if (!grabbed) {
    throw new Error(
      `Pointer down never picked up a piece at projected (${start.x.toFixed(1)}, ${start.y.toFixed(1)}).`,
    )
  }

  await page.mouse.move(end.x, end.y, { steps: 36 })
  await waitMs(page, settleMs)
  await page.mouse.up()
  await waitFrames(page, 2)
}

export async function pointerDragPieceToCountry(page: Page, pieceId: string, countryId: string) {
  await faceCountry(page, countryId)
  const from = await waitForProjected(page, 'piece', pieceId)
  const to = await waitForProjected(page, 'country', countryId)
  await dragWorldToWorld(page, from, to)
}
