import { copy } from '../game/copy'
import { useGame } from '../game/store'
import type { CollectionFile } from '../game/types'

export function Title({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="overlay">
      <div className="title-block">
        <p className="wordmark lg">World Snap</p>
        <p className="lede">{copy.subtitle}</p>
        <button type="button" className="cta" onClick={onEnter}>
          {copy.toTable}
        </button>
      </div>
    </div>
  )
}

export function Complete({ onCollection, onReplay }: { onCollection: () => void; onReplay: () => void }) {
  return (
    <div className="overlay dim">
      <div className="title-block">
        <p className="wordmark lg">{copy.complete}</p>
        <p className="lede">{copy.completeHint}</p>
        <div className="row">
          <button type="button" className="cta" onClick={onCollection}>
            {copy.toCollection}
          </button>
          <button type="button" className="ghost" onClick={onReplay}>
            {copy.replay}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Collection({
  file,
  onClose,
  onReplay,
}: {
  file: CollectionFile | null
  onClose: () => void
  onReplay: () => void
}) {
  const done = useGame((s) => Boolean(s.collection.familiar))
  const placedCount = useGame((s) => s.placed.length)
  const packs = file?.packs ?? [
    { id: 'familiar', titleRu: copy.pack, status: 'playable' as const, pieceCount: 8 },
    { id: 'europe', titleRu: copy.europe, status: 'locked' as const, pieceCount: 12 },
    { id: 'continents', titleRu: copy.continents, status: 'locked' as const, pieceCount: 6 },
    { id: 'states', titleRu: copy.states, status: 'locked' as const, pieceCount: 50 },
  ]

  const titleFor = (id: string, fallback: string) => {
    if (id === 'familiar') return copy.pack
    if (id === 'europe') return copy.europe
    if (id === 'continents') return copy.continents
    if (id === 'states') return copy.states
    return fallback
  }

  return (
    <div className="overlay">
      <div className="collection">
        <div className="collection-head">
          <p className="wordmark">{copy.collection}</p>
          <button type="button" className="ghost" onClick={onClose}>
            {copy.toTable}
          </button>
        </div>
        <ul className="cards">
          {packs.map((p) => {
            const locked = p.status === 'locked'
            const complete = p.id === 'familiar' && done
            return (
              <li key={p.id} className={`card ${locked ? 'locked' : ''} ${complete ? 'done' : ''}`}>
                <p className="card-title">{titleFor(p.id, p.titleRu)}</p>
                <p className="card-meta">{locked ? copy.locked : complete ? copy.complete : copy.count(p.id === 'familiar' ? placedCount : 0, p.pieceCount)}</p>
                {!locked && (
                  <button type="button" className="cta small" onClick={onReplay}>
                    {complete ? copy.replay : copy.toTable}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export function Boot({ error }: { error: boolean }) {
  return (
    <div className="overlay">
      <p className="lede">{error ? copy.error : copy.loading}</p>
    </div>
  )
}
