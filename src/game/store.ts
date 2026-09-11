import { create } from 'zustand'
import { hintForIndex } from './snap'
import { emptySave, loadSave, writeSave } from './save'
import type { HintLevel, IsoA2, Phase } from './types'

const FIRST_CHOICES = new Set(['IT', 'JP', 'BR'])

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
  collectionOpen: boolean
  muted: boolean
  hydrate: () => void
  persist: () => void
  setPackSize: (n: number) => void
  toTable: () => void
  chooseFirst: (id: IsoA2) => void
  paint: (id: IsoA2) => void
  place: (id: IsoA2) => void
  setDragging: (id: IsoA2 | null) => void
  setGhost: (id: IsoA2 | null) => void
  setDragLabel: (label: string | null) => void
  flashMiss: () => void
  openCollection: (open: boolean) => void
  replay: () => void
  toggleMute: () => void
  hintFor: (id: IsoA2) => HintLevel
  isOnTable: (id: IsoA2) => boolean
}

export const useGame = create<GameStore>((set, get) => ({
  ...emptySave(),
  packSize: 8,
  draggingId: null,
  ghostId: null,
  dragLabel: null,
  missAt: 0,
  snapAt: 0,
  collectionOpen: false,
  muted: false,

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
      version: 1,
      packId: s.packId,
      phase: s.phase,
      placed: s.placed,
      painted: s.painted,
      firstId: s.firstId,
      collection: s.collection,
    })
  },

  toTable: () => {
    const { firstId, placed } = get()
    set({
      phase: firstId || placed.length ? 'play' : 'choose-first',
      collectionOpen: false,
    })
    get().persist()
  },

  chooseFirst: (id) => {
    if (!FIRST_CHOICES.has(id)) return
    if (get().firstId) return
    set({ firstId: id, phase: 'play' })
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
    const done = placed.length >= s.packSize
    const collection = done
      ? { ...s.collection, [s.packId]: { completedAt: new Date().toISOString() } }
      : s.collection
    set({
      placed,
      painted,
      draggingId: null,
      snapAt: Date.now(),
      phase: done ? 'complete' : s.phase,
      collection,
    })
    get().persist()
  },

  setDragging: (id) => set({ draggingId: id, ghostId: id ? get().ghostId : null, dragLabel: id ? get().dragLabel : null }),
  setGhost: (id) => set({ ghostId: id }),
  setDragLabel: (label) => set({ dragLabel: label }),
  flashMiss: () => set({ missAt: Date.now() }),

  openCollection: (open) => set({ collectionOpen: open }),

  replay: () => {
    set({
      phase: 'choose-first',
      placed: [],
      painted: [],
      firstId: null,
      draggingId: null,
      ghostId: null,
      dragLabel: null,
      collectionOpen: false,
    })
    get().persist()
  },

  toggleMute: () => set({ muted: !get().muted }),

  hintFor: (id) => {
    const { placed, firstId } = get()
    return hintForIndex(placed.length, id === firstId && !placed.includes(id))
  },

  isOnTable: (id) => {
    const { phase, firstId, placed } = get()
    if (placed.includes(id)) return false
    if (phase === 'title' || phase === 'complete') return false
    if (!firstId) return FIRST_CHOICES.has(id)
    if (placed.length === 0) return id === firstId
    return true
  },
}))

export const FIRST_PIECES = ['IT', 'JP', 'BR'] as const
