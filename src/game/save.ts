import type { Phase, SaveState } from './types'

export const SAVE_KEY = 'world-snap-v1'

export const emptySave = (): SaveState => ({
  version: 1,
  packId: 'familiar',
  phase: 'title',
  placed: [],
  painted: [],
  firstId: null,
  collection: {},
})

export function loadSave(): SaveState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return emptySave()
    const parsed = JSON.parse(raw) as Partial<SaveState>
    if (parsed.version !== 1) return emptySave()
    return {
      ...emptySave(),
      ...parsed,
      version: 1,
      placed: Array.isArray(parsed.placed) ? parsed.placed : [],
      painted: Array.isArray(parsed.painted) ? parsed.painted : [],
      collection: parsed.collection ?? {},
      phase: (parsed.phase as Phase) ?? 'title',
    }
  } catch {
    return emptySave()
  }
}

export function writeSave(state: SaveState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
}
