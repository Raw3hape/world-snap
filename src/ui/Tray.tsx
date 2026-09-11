import { useMemo } from 'react'
import { continentRu, copy } from '../game/copy'
import { dragBus } from '../game/dragBus'
import { useGame } from '../game/store'
import type { Country } from '../game/types'
import { continentCohort, silhouetteSVG } from '../geo/countryGeometry'

const TABS = [
  'all',
  'Europe',
  'Asia',
  'Africa',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
] as const

function Silhouette({
  country,
  cohort,
  maxPx,
}: {
  country: Country
  cohort: Country[]
  maxPx?: number
}) {
  const svg = silhouetteSVG(country, cohort, maxPx)
  return (
    <svg
      width={svg.width}
      height={svg.height}
      viewBox={`0 0 ${svg.width} ${svg.height}`}
      aria-hidden
    >
      <path d={svg.d} fillRule="evenodd" />
    </svg>
  )
}

export function Tray({ countries }: { countries: Country[] }) {
  const placed = useGame((s) => s.placed)
  const continent = useGame((s) => s.continent)
  const query = useGame((s) => s.query)
  const setContinent = useGame((s) => s.setContinent)
  const setQuery = useGame((s) => s.setQuery)
  const setDragging = useGame((s) => s.setDragging)
  const phase = useGame((s) => s.phase)
  const draggingId = useGame((s) => s.draggingId)

  const leftover = useMemo(
    () => countries.filter((c) => !placed.includes(c.id)),
    [countries, placed],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leftover.filter((c) => {
      if (continent !== 'all' && c.continent !== continent) return false
      if (!q) return true
      return (
        c.nameRu.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      )
    })
  }, [leftover, continent, query])

  const cohorts = useMemo(() => {
    const map = new Map<string, Country[]>()
    for (const c of countries) {
      const key = c.continent ?? ''
      const list = map.get(key)
      if (list) list.push(c)
      else map.set(key, [c])
    }
    return map
  }, [countries])

  if (phase === 'title') return null

  return (
    <aside className="tray">
      <div className="tray-bar">
        <div className="tabs">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              className={continent === id ? 'tab on' : 'tab'}
              onClick={() => setContinent(id)}
            >
              {continentRu[id] ?? id}
            </button>
          ))}
        </div>
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
        />
      </div>
      <div className="tray-row">
        {visible.map((c) => {
          const cohort = cohorts.get(c.continent ?? '') ?? [c]
          return (
            <button
              key={c.id}
              type="button"
              className="piece"
              data-iso={c.id}
              title={c.nameRu}
              hidden={draggingId === c.id}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                setDragging(c.id)
                dragBus.begin(c.id, e.clientX, e.clientY)
              }}
            >
              <Silhouette country={c} cohort={cohort} />
              <span className="sr-only">{c.nameRu}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

export function DragGhost({ countries }: { countries: Country[] }) {
  const draggingId = useGame((s) => s.draggingId)
  const country = countries.find((c) => c.id === draggingId)
  if (!country) return null
  const cohort = continentCohort(countries, country.continent)
  return (
    <div className="ghost-piece" id="drag-ghost" aria-hidden>
      <Silhouette country={country} cohort={cohort.length ? cohort : [country]} maxPx={72} />
    </div>
  )
}
