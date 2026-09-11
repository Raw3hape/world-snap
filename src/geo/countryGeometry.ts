import { geoAzimuthalEqualArea } from 'd3-geo'
import earcut from 'earcut'
import {
  BufferAttribute,
  BufferGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Country, Geometry } from '../game/types'
import { latLonToVector3 } from './sphere'

type Ring = number[][]
type Polygon = Ring[]

function polygonsOf(geometry: Geometry): Polygon[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

function openRing(ring: Ring): Ring {
  if (ring.length < 4) return ring
  const a = ring[0]
  const b = ring[ring.length - 1]
  if (a && b && a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1)
  return ring
}

function signedArea(ring: Ring) {
  let a = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % n]
    if (!p || !q) continue
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

function ensureWinding(ring: Ring, ccw: boolean) {
  const area = signedArea(ring)
  const isCcw = area > 0
  return isCcw === ccw ? ring : ring.slice().reverse()
}

function projectRing(
  ring: Ring,
  project: (pt: [number, number]) => [number, number] | null,
) {
  const out: { lon: number; lat: number; x: number; y: number }[] = []
  for (const pt of ring) {
    if (!pt || pt.length < 2) continue
    const lon = pt[0]
    const lat = pt[1]
    if (lon === undefined || lat === undefined) continue
    const xy = project([lon, lat])
    if (!xy) continue
    out.push({ lon, lat, x: xy[0], y: xy[1] })
  }
  return out
}

export function makeProjector(centroid: [number, number]) {
  const projection = geoAzimuthalEqualArea()
    .rotate([-centroid[0], -centroid[1]])
    .scale(1)
    .translate([0, 0])
  return (pt: [number, number]): [number, number] | null => {
    const p = projection(pt)
    if (!p) return null
    return [p[0], p[1]]
  }
}

export function projectedBounds(country: Country) {
  const project = makeProjector(country.centroid)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const polygon of polygonsOf(country.geometry)) {
    const outer = projectRing(openRing(polygon[0] ?? []), project)
    for (const p of outer) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  if (!Number.isFinite(minX)) return { minX: -1, minY: -1, maxX: 1, maxY: 1, w: 2, h: 2 }
  return { minX, minY, maxX, maxY, w: Math.max(maxX - minX, 1e-6), h: Math.max(maxY - minY, 1e-6) }
}

export function buildGlobeGeometry(country: Country, radius: number) {
  const project = makeProjector(country.centroid)
  const bounds = projectedBounds(country)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const tmp = new Vector3()
  const flagAspect = 1.5
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  const cover = Math.max(bounds.w / flagAspect, bounds.h)

  for (const polygon of polygonsOf(country.geometry)) {
    const rings = polygon
      .map((ring, i) => {
        const opened = openRing(ring)
        const wound = ensureWinding(opened, i === 0)
        return projectRing(wound, project)
      })
      .filter((r) => r.length >= 3)
    if (rings.length === 0 || (rings[0]?.length ?? 0) < 3) continue

    const verts2: number[] = []
    const meta: { lon: number; lat: number; x: number; y: number }[] = []
    const holes: number[] = []
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i]
      if (!ring) continue
      if (i > 0) holes.push(meta.length)
      for (const p of ring) {
        verts2.push(p.x, p.y)
        meta.push(p)
      }
    }
    const tris = earcut(verts2, holes, 2)
    const base = positions.length / 3
    for (const p of meta) {
      latLonToVector3(p.lat, p.lon, radius, tmp)
      positions.push(tmp.x, tmp.y, tmp.z)
      tmp.normalize()
      normals.push(tmp.x, tmp.y, tmp.z)
      uvs.push((p.x - cx) / (flagAspect * cover) + 0.5, 1 - ((p.y - cy) / cover + 0.5))
    }
    for (const idx of tris) indices.push(base + idx)
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

function shapeFromPolygon(polygon: Polygon, project: ReturnType<typeof makeProjector>, scale: number) {
  const rings = polygon
    .map((ring, i) => {
      const opened = openRing(ring)
      const wound = ensureWinding(opened, i === 0)
      return projectRing(wound, project)
    })
    .filter((r) => r.length >= 3)
  const outer = rings[0]
  if (!outer || outer.length < 3) return null
  const shape = new Shape(outer.map((p) => new Vector2(p.x * scale, p.y * scale)))
  for (let i = 1; i < rings.length; i++) {
    const hole = rings[i]
    if (!hole || hole.length < 3) continue
    shape.holes.push(new Path(hole.map((p) => new Vector2(p.x * scale, p.y * scale))))
  }
  return shape
}

export function pieceFit(country: Country) {
  const b = projectedBounds(country)
  const longest = Math.max(b.w, b.h)
  const target = 0.7
  const scale = target / longest
  return { ...b, scale, longest }
}

export function buildPieceGeometry(country: Country, depth = 0.034) {
  const project = makeProjector(country.centroid)
  const { scale } = pieceFit(country)
  const shapes: Shape[] = []
  for (const polygon of polygonsOf(country.geometry)) {
    const shape = shapeFromPolygon(polygon, project, scale)
    if (shape) shapes.push(shape)
  }
  if (shapes.length === 0) return new BufferGeometry()
  const geos = shapes.map(
    (shape) =>
      new ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.006,
        bevelSegments: 2,
        curveSegments: 1,
      }),
  )
  const geo = geos.length === 1 ? (geos[0] as ExtrudeGeometry) : mergeGeometries(geos, false)
  if (!geo) return new BufferGeometry()
  geo.center()
  geo.computeVertexNormals()
  return geo
}

export function buildSilhouetteShape(country: Country) {
  const project = makeProjector(country.centroid)
  const { scale } = pieceFit(country)
  const shapes: Shape[] = []
  for (const polygon of polygonsOf(country.geometry)) {
    const shape = shapeFromPolygon(polygon, project, scale)
    if (shape) shapes.push(shape)
  }
  if (shapes.length === 0) return new BufferGeometry()
  const geo = new ShapeGeometry(shapes, 2)
  geo.center()
  return geo
}

export function pieceTableLayout(index: number, total: number, seed = 1) {
  const cols = total <= 3 ? total : Math.min(4, total)
  const col = index % cols
  const row = Math.floor(index / cols)
  const dx = (col - (cols - 1) / 2) * 0.62
  const dz = 1.08 + row * 0.4
  const jitterX = Math.sin(index * 2.1 * seed) * 0.08
  const jitterZ = Math.cos(index * 1.7 * seed) * 0.06
  const rot = Math.sin(index * 1.3) * 0.18
  return { x: dx + jitterX, z: dz + jitterZ, rot }
}
