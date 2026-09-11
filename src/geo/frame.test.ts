import { describe, expect, it } from 'vitest'
import { Group, Quaternion, Vector3 } from 'three'
import { evaluateSnap } from '../game/snap'
import type { Country } from '../game/types'
import { latLonToVector3, vector3ToLatLon } from './sphere'

const italy: Country = {
  id: 'IT',
  nameRu: 'Италия',
  nameEn: 'Italy',
  isoA2: 'IT',
  centroid: [12.14, 42.75],
  bbox: [6.7, 36.6, 18.5, 47.1],
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [6.7, 36.6],
      [6.7, 47.1],
      [18.5, 47.1],
      [18.5, 36.6],
      [6.7, 36.6],
    ]],
  },
}

describe('globe local snap frame', () => {
  it('recovers country lat/lon after the globe is rotated', () => {
    const globe = new Group()
    const local = latLonToVector3(42.75, 12.14, 1)
    const camDir = new Vector3(0.15, 1.4, 4).normalize()
    globe.quaternion.copy(new Quaternion().setFromUnitVectors(local.clone().normalize(), camDir))
    globe.updateMatrixWorld(true)

    const world = local.clone()
    globe.localToWorld(world)
    const back = world.clone()
    globe.worldToLocal(back)
    const ll = vector3ToLatLon(back)
    const snap = evaluateSnap(italy, ll.lon, ll.lat, 'full')
    expect(snap.contains).toBe(true)
    expect(snap.canSnap).toBe(true)
  })

  it('fails if you feed world coords without converting', () => {
    const globe = new Group()
    const local = latLonToVector3(42.75, 12.14, 1)
    const camDir = new Vector3(0.15, 1.4, 4).normalize()
    globe.quaternion.copy(new Quaternion().setFromUnitVectors(local.clone().normalize(), camDir))
    globe.updateMatrixWorld(true)
    const world = local.clone()
    globe.localToWorld(world)
    const ll = vector3ToLatLon(world)
    const snap = evaluateSnap(italy, ll.lon, ll.lat, 'none')
    expect(snap.contains).toBe(false)
  })
})
