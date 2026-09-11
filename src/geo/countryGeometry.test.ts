import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import type { Country, Pack } from '../game/types'
import {
  buildGlobeGeometry,
  buildPieceGeometry,
  continentCohort,
  pieceFit,
  projectedBounds,
  silhouetteSVG,
} from './countryGeometry'

const world = JSON.parse(
  readFileSync(new URL('../../public/data/pack-world.json', import.meta.url), 'utf8'),
) as Pack

const familiar = JSON.parse(
  readFileSync(new URL('../../public/data/pack-familiar.json', import.meta.url), 'utf8'),
) as Pack

function byId(pack: Pack, id: string) {
  const c = pack.countries.find((x) => x.id === id)
  if (!c) throw new Error('missing ' + id)
  return c
}

function vertexLength(geo: BufferGeometry, i: number) {
  const pos = geo.getAttribute('position')
  return Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i))
}

function minVertexDistance(a: BufferGeometry, b: BufferGeometry) {
  const pa = a.getAttribute('position')
  const pb = b.getAttribute('position')
  let min = Infinity
  for (let i = 0; i < pa.count; i++) {
    const ax = pa.getX(i)
    const ay = pa.getY(i)
    const az = pa.getZ(i)
    for (let j = 0; j < pb.count; j++) {
      const d = Math.hypot(ax - pb.getX(j), ay - pb.getY(j), az - pb.getZ(j))
      if (d < min) min = d
    }
  }
  return min
}

describe('world pack globe meshes', () => {
  it('builds a finite globe mesh for every packed country', () => {
    expect(world.countries.length).toBe(204)
    for (const c of world.countries) {
      const globe = buildGlobeGeometry(c, 1)
      const gp = globe.getAttribute('position')
      expect(gp.count, c.id + ' globe').toBeGreaterThan(3)
      const arr = gp.array
      for (let i = 0; i < arr.length; i++) {
        expect(Number.isFinite(arr[i]), c.id).toBe(true)
      }
    }
  })

  it('keeps sample vertices on the given radius', () => {
    const sample = ['IT', 'RU', 'VA', 'US', 'AU', 'FJ', 'CL']
    for (const id of sample) {
      const geo = buildGlobeGeometry(byId(world, id), 1)
      const pos = geo.getAttribute('position')
      const step = Math.max(1, Math.floor(pos.count / 8))
      for (let i = 0; i < pos.count; i += step) {
        expect(Math.abs(vertexLength(geo, i) - 1), id).toBeLessThanOrEqual(1e-5)
      }
    }
  })

  it('builds tiny 50m extras', () => {
    for (const id of ['VA', 'MC', 'SM', 'AD', 'SG', 'MT']) {
      const geo = buildGlobeGeometry(byId(world, id), 1)
      const pos = geo.getAttribute('position')
      expect(pos.count, id).toBeGreaterThan(3)
      expect(Math.abs(vertexLength(geo, 0) - 1), id).toBeLessThanOrEqual(1e-5)
    }
  })

  it('shares the sphere between land neighbors and leaves seas apart', () => {
    const fr = buildGlobeGeometry(byId(world, 'FR'), 1)
    const de = buildGlobeGeometry(byId(world, 'DE'), 1)
    const us = buildGlobeGeometry(byId(world, 'US'), 1)
    const ca = buildGlobeGeometry(byId(world, 'CA'), 1)
    const au = buildGlobeGeometry(byId(world, 'AU'), 1)
    const nz = buildGlobeGeometry(byId(world, 'NZ'), 1)
    expect(minVertexDistance(fr, de)).toBeLessThan(0.04)
    expect(minVertexDistance(us, ca)).toBeLessThan(0.04)
    expect(minVertexDistance(au, nz)).toBeGreaterThan(0.04)
  })
})

describe('tray pieceFit', () => {
  const europe = continentCohort(world.countries, 'Europe')

  it('sizes Italy smaller than Russia inside the Europe cohort', () => {
    const italy = pieceFit(byId(world, 'IT'), europe)
    const russia = pieceFit(byId(world, 'RU'), europe)
    expect(italy.px).toBeLessThan(russia.px)
    expect(russia.px).toBe(52)
  })

  it('keeps SVG aspect equal to projected bounds', () => {
    const samples: Country[] = [
      byId(world, 'IT'),
      byId(world, 'RU'),
      byId(world, 'CL'),
      byId(world, 'NO'),
      byId(world, 'JP'),
      byId(world, 'VA'),
    ]
    for (const c of samples) {
      const cohort = continentCohort(world.countries, c.continent)
      const b = projectedBounds(c)
      const svg = silhouetteSVG(c, cohort)
      const innerW = svg.width - svg.pad * 2
      const innerH = svg.height - svg.pad * 2
      expect(Math.abs(innerW / innerH - b.w / b.h), c.id).toBeLessThanOrEqual(0.08)
    }
  })
})

describe('familiar pack', () => {
  it('builds globe and table geometry for every pack country', () => {
    for (const c of familiar.countries) {
      const b = projectedBounds(c)
      expect(b.w).toBeGreaterThan(0)
      const globe = buildGlobeGeometry(c, 1)
      const piece = buildPieceGeometry(c)
      const gp = globe.getAttribute('position')
      const pp = piece.getAttribute('position')
      expect(gp.count, c.id + ' globe').toBeGreaterThan(12)
      expect(pp.count, c.id + ' piece').toBeGreaterThan(12)
    }
  })
})
