import { MathUtils, Vector3 } from 'three'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

/** Geographic lat/lon (degrees) → Y-up sphere. Lon 0 sits on +X. */
export function latLonToVector3(lat: number, lon: number, radius = 1, target = new Vector3()) {
  const phi = (90 - lat) * DEG
  const theta = (lon + 180) * DEG
  const sinPhi = Math.sin(phi)
  return target.set(
    -radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  )
}

export function vector3ToLatLon(v: Vector3): { lat: number; lon: number } {
  const r = v.length() || 1
  const lat = 90 - Math.acos(MathUtils.clamp(v.y / r, -1, 1)) * RAD
  let lon = Math.atan2(v.z, -v.x) * RAD - 180
  if (lon <= -180) lon += 360
  if (lon > 180) lon -= 360
  return { lat, lon }
}

export function wrapLon(lon: number) {
  let x = lon
  while (x <= -180) x += 360
  while (x > 180) x -= 360
  return x
}

export function angularDegrees(a: Vector3, b: Vector3) {
  const na = a.lengthSq() === 0 ? a : a.clone().normalize()
  const nb = b.lengthSq() === 0 ? b : b.clone().normalize()
  return Math.acos(MathUtils.clamp(na.dot(nb), -1, 1)) * RAD
}
