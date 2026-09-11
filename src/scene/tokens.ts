export const T = {
  porcelain: '#E6E2DA',
  porcelainWet: '#D4CFC6',
  ink: '#0B1220',
  brass: '#C4A15C',
  brassDim: '#8A6A32',
  lamp: '#FFC89A',
  shade: '#2A2420',
  walnut: '#1C1410',
  oceanGhost: '#C5CFD4',
  hint: '#A9C7D4',
  miss: '#8A4E56',
  sheen: '#EDE8E0',
  moon: '#8AA4B8',
  sky: '#1A2838',
} as const

export const R = 1
export const TABLE_Y = -1.18
export const CAM = { fov: 36, position: [0.18, 2.62, 4.45] as [number, number, number] }

/** View axis from the table look-at to the default camera. */
export const CAM_DIR = (() => {
  const look = [0, -0.58, 0.32] as const
  const d = [CAM.position[0] - look[0], CAM.position[1] - look[1], CAM.position[2] - look[2]] as const
  const len = Math.hypot(d[0], d[1], d[2]) || 1
  return [d[0] / len, d[1] / len, d[2] / len] as const
})()

export const ZOOM = {
  distOut: 5.23,
  distIn: 2.08,
  distComplete: 5.45,
} as const

export const oceanColor = '#E2E3DF'

export const bisque = {
  color: T.porcelain,
  roughness: 0.62,
  metalness: 0,
  clearcoat: 0.18,
  clearcoatRoughness: 0.55,
  sheen: 1,
  sheenColor: T.sheen,
  sheenRoughness: 0.75,
  envMapIntensity: 0.4,
  ior: 1.5,
  specularIntensity: 0.35,
  specularColor: '#F5F0E8',
} as const

export const painted = {
  color: '#FFFFFF',
  roughness: 0.3,
  metalness: 0,
  clearcoat: 0.45,
  clearcoatRoughness: 0.28,
  sheen: 0.35,
  sheenColor: '#F2EDE6',
  sheenRoughness: 0.55,
  envMapIntensity: 0.7,
  ior: 1.5,
  specularIntensity: 0.5,
  specularColor: '#F5F0E8',
} as const
