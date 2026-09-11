import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Pack } from '../game/types'
import { buildGlobeGeometry, buildPieceGeometry, projectedBounds } from './countryGeometry'

const pack = JSON.parse(
  readFileSync(new URL('../../public/data/pack-familiar.json', import.meta.url), 'utf8'),
) as Pack

describe('country meshes', () => {
  it('builds globe and table geometry for every pack country', () => {
    for (const c of pack.countries) {
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
