import { create } from 'zustand'
import { hintForIndex } from './snap'
import { emptySave, loadSave, writeSave } from './save'
import type { HintLevel, IsoA2, Phase } from './types'

interface GameStore {
  phase: Phase
  packId: string
  packSize: number
  placed: IsoA2[]
  painted: IsoA2[]
  firstId: IsoA2 | null
  collection: Record<string, { completedAt: string }>
  draggingId: IsoA2 | null
  ghostId: IsoA2 | null
  dragLabel: string | null
  missAt: number
  snapAt: number
  continent: string
  query: string
  hydrate: () => void
  persist: () => void
  setPackSize: (n: number) => void
  toTable: () => void
  paint: (id: IsoA2) => void
  place: (id: IsoA2) => void
  setDragging: (id: IsoA2 | null) => void
  setGhost: (id: IsoA2 | null) => void
  setDragLabel: (label: string | null) => void
  flashMiss: () => void
  replay: () => void
  setContinent: (id: string) => void
  setQuery: (q: string) => void
  hintFor: (id: IsoA2) => HintLevel
  isOnTable: (id: IsoA2) => boolean
}

export const useGame = create<GameStore>((set, get) => ({
  ...emptySave(),
  packSize: 0,
  draggingId: null,
  ghostId: null,
  dragLabel: null,
  missAt: 0,
  snapAt: 0,
  continent: 'all',
  query: '',

  hydrate: () => {
    const save = loadSave()
    set({
      phase: save.phase === 'complete' ? 'complete' : save.phase,
      packId: save.packId,
      placed: save.placed,
      painted: save.painted,
      firstId: save.firstId,
      collection: save.collection,
    })
  },

  setPackSize: (n) => set({ packSize: n }),

  persist: () => {
    const s = get()
    writeSave({
      version: 2,
      packId: s.packId,
      phase: s.phase,
      placed: s.placed,
      painted: s.painted,
      firstId: s.firstId,
      collection: s.collection,
    })
  },

  toTable: () => {
    set({ phase: 'play' })
    get().persist()
  },

  paint: (id) => {
    const { painted } = get()
    const next = painted.includes(id) ? painted.filter((x) => x !== id) : [...painted, id]
    set({ painted: next })
    get().persist()
  },

  place: (id) => {
    const s = get()
    if (s.placed.includes(id)) return
    const placed = [...s.placed, id]
    const painted = s.painted.includes(id) ? s.painted : [...s.painted, id]
    const done = s.packSize > 0 && placed.length >= s.packSize
    const collection = done
      ? { ...s.collection, [s.packId]: { completedAt: new Date().toISOString() } }
      : s.collection
    set({
      placed,
      painted,
      draggingId: null,
      snapAt: Date.now(),
      phase: done ? 'complete' : 'play',
      collection,
    })
    get().persist()
  },

  setDragging: (id) => set({ draggingId: id }),
  setGhost: (id) => set({ ghostId: id }),
  setDragLabel: (label) => set({ dragLabel: label }),
  flashMiss: () => set({ missAt: Date.now() }),

  replay: () => {
    set({
      phase: 'play',
      placed: [],
      painted: [],
      firstId: null,
      draggingId: null,
      ghostId: null,
      dragLabel: null,
      query: '',
    })
    get().persist()
  },

  setContinent: (id) => set({ continent: id }),
  setQuery: (q) => set({ query: q }),

  hintFor: (id) => {
    const { placed } = get()
    void id
    return hintForIndex(placed.length, false)
  },

  isOnTable: (id) => {
    const { phase, placed } = get()
    if (placed.includes(id)) return false
    return phase === 'play' || phase === 'complete'
  },
}))
