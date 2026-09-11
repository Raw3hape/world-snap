export type IsoA2 = string

export type Phase = 'title' | 'choose-first' | 'play' | 'complete'

export type HintLevel = 'full' | 'near' | 'none'

export type Geometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }

export interface Country {
  id: IsoA2
  nameRu: string
  nameEn: string
  isoA2: IsoA2
  centroid: [number, number]
  bbox: [number, number, number, number]
  geometry: Geometry
}

export interface Pack {
  id: string
  titleRu: string
  titleEn: string
  countries: Country[]
}

export interface CollectionPack {
  id: string
  titleRu: string
  status: 'playable' | 'locked'
  pieceCount: number
}

export interface CollectionFile {
  packs: CollectionPack[]
}

export interface SaveState {
  version: 1
  packId: string
  phase: Phase
  placed: IsoA2[]
  painted: IsoA2[]
  firstId: IsoA2 | null
  collection: Record<string, { completedAt: string }>
}

export interface MagnetResult {
  contains: boolean
  degrees: number
  magnetT: number
  canSnap: boolean
  nearGhost: boolean
}
