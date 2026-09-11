#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const FLAG_DIR = path.join(ROOT, 'public', 'flags')

const NE_URLS = [
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
  'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json',
]
const RU_URLS = [
  'https://raw.githubusercontent.com/umpirsky/country-list/master/data/ru_RU/country.json',
  'https://raw.githubusercontent.com/umpirsky/country-list/master/data/ru/country.json',
]
const FLAG_URL = (iso) =>
  `https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/svg/${iso.toLowerCase()}.svg`

function isoOf(props) {
  for (const key of ['ISO_A2', 'ISO_A2_EH', 'WB_A2']) {
    const v = String(props?.[key] ?? '').trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(v) && v !== 'XX') return v
  }
  return ''
}

function walk(coords, visit) {
  if (!Array.isArray(coords) || coords.length === 0) return
  if (typeof coords[0] === 'number') {
    visit(coords[0], coords[1])
    return
  }
  for (const child of coords) walk(child, visit)
}

function bboxOf(geometry) {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  walk(geometry.coordinates, (lon, lat) => {
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  })
  return [minLon, minLat, maxLon, maxLat]
}

function ringCentroid(ring) {
  let ax = 0
  let ay = 0
  let crossSum = 0
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const x0 = ring[i][0]
    const y0 = ring[i][1]
    const x1 = ring[i + 1][0]
    const y1 = ring[i + 1][1]
    const cross = x0 * y1 - x1 * y0
    crossSum += cross
    ax += (x0 + x1) * cross
    ay += (y0 + y1) * cross
  }
  if (crossSum === 0) {
    const [a, b, c, d] = bboxOf({ type: 'Polygon', coordinates: [ring] })
    return { x: (a + c) / 2, y: (b + d) / 2, area: 0 }
  }
  return { x: ax / (3 * crossSum), y: ay / (3 * crossSum), area: Math.abs(crossSum / 2) }
}

function centroidOf(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let ax = 0
  let ay = 0
  let a = 0
  for (const poly of polys) {
    const ring = poly[0]
    if (!ring) continue
    const c = ringCentroid(ring)
    ax += c.x * c.area
    ay += c.y * c.area
    a += c.area
  }
  if (a === 0) {
    const b = bboxOf(geometry)
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]
  }
  return [ax / a, ay / a]
}

async function fetchJson(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) throw new Error(String(res.status))
      return await res.json()
    } catch (e) {
      console.error('fail', url, e.message)
    }
  }
  throw new Error('all urls failed')
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true })
  await mkdir(FLAG_DIR, { recursive: true })
  const geojson = await fetchJson(NE_URLS)
  let ru = {}
  try {
    ru = await fetchJson(RU_URLS)
  } catch {
    ru = {}
  }

  const countries = []
  const seen = new Set()
  for (const f of geojson.features ?? []) {
    const iso = isoOf(f.properties)
    if (!iso || iso === 'AQ' || seen.has(iso)) continue
    if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) continue
    seen.add(iso)
    const nameEn = f.properties.NAME_EN || f.properties.NAME || f.properties.ADMIN || iso
    const nameRu = f.properties.NAME_RU || ru[iso] || ru[iso.toLowerCase()] || nameEn
    countries.push({
      id: iso,
      nameRu,
      nameEn,
      isoA2: iso,
      continent: f.properties.CONTINENT || f.properties.REGION_UN || 'World',
      centroid: centroidOf(f.geometry),
      bbox: bboxOf(f.geometry),
      geometry: f.geometry,
    })
  }
  countries.sort((a, b) => a.continent.localeCompare(b.continent) || a.nameRu.localeCompare(b.nameRu, 'ru'))

  let flags = 0
  for (const c of countries) {
    try {
      const res = await fetch(FLAG_URL(c.id))
      if (!res.ok) continue
      const svg = await res.text()
      if (!svg.includes('<svg')) continue
      await writeFile(path.join(FLAG_DIR, `${c.id.toLowerCase()}.svg`), svg)
      flags += 1
    } catch {
      /* skip */
    }
  }

  const pack = { id: 'world', titleRu: 'Мир', titleEn: 'World', countries }
  await writeFile(path.join(DATA_DIR, 'pack-world.json'), JSON.stringify(pack))
  console.log(`countries ${countries.length}, flags ${flags}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
