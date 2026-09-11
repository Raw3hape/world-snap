import { copy } from '../game/copy'

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

export function Boot({ error }: { error: boolean }) {
  return (
    <div className="overlay">
      <p className="lede">{error ? copy.error : copy.loading}</p>
    </div>
  )
}
