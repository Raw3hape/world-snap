export const T = {
  paper: '#F4F1EA',
  ink: '#1C1914',
  mute: '#7A746A',
  land: '#E6DFD4',
  ocean: '#D0D8DC',
  line: '#C6BFB4',
  hint: '#3D7A8C',
  miss: '#9A5A58',
  porcelain: '#E6DFD4',
  sheen: '#F6F2EA',
} as const

export const R = 1
export const OCEAN_R = 0.998
export const LAND_R = 1.0008
export const GLOBE_Y = 0

export const ZOOM = {
  distOut: 4.55,
  distTitle: 4.8,
  distIn: 1.95,
  distComplete: 5.1,
} as const

export const CAM_DIR = (() => {
  const d = [0, 0.06, 1] as const
  const len = Math.hypot(d[0], d[1], d[2]) || 1
  return [d[0] / len, d[1] / len, d[2] / len] as const
})()

export const CAM = {
  fov: 34,
  position: [
    CAM_DIR[0] * ZOOM.distOut,
    GLOBE_Y + CAM_DIR[1] * ZOOM.distOut,
    CAM_DIR[2] * ZOOM.distOut,
  ] as [number, number, number],
}

export const oceanColor = T.ocean

export const bisque = {
  color: T.ocean,
  roughness: 0.58,
  metalness: 0,
  clearcoat: 0.08,
  clearcoatRoughness: 0.7,
  sheen: 0.2,
  sheenColor: T.paper,
  sheenRoughness: 0.7,
  envMapIntensity: 0,
  ior: 1.5,
  specularIntensity: 0.18,
  specularColor: '#FFFFFF',
} as const

export const landMat = {
  color: T.land,
  roughness: 0.74,
  metalness: 0,
  clearcoat: 0.04,
  clearcoatRoughness: 0.55,
  sheen: 0.12,
  sheenColor: T.sheen,
  envMapIntensity: 0,
} as const

export const painted = {
  color: '#FFFFFF',
  roughness: 0.38,
  metalness: 0,
  clearcoat: 0.2,
  clearcoatRoughness: 0.3,
  sheen: 0.2,
  sheenColor: '#F7F4EE',
  envMapIntensity: 0,
  ior: 1.5,
  specularIntensity: 0.28,
  specularColor: '#FFFFFF',
} as const
