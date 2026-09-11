import { useEffect, useState } from 'react'
import { copy } from '../game/copy'
import { useGame } from '../game/store'

export function Hud({ total }: { total: number }) {
  const phase = useGame((s) => s.phase)
  const placed = useGame((s) => s.placed.length)
  const missAt = useGame((s) => s.missAt)
  const snapAt = useGame((s) => s.snapAt)
  const replay = useGame((s) => s.replay)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!missAt && !snapAt) return
    const id = window.setInterval(() => setNow(Date.now()), 120)
    return () => window.clearInterval(id)
  }, [missAt, snapAt])

  if (phase === 'title') return null

  const miss = now - missAt < 1400
  let line = ''
  if (miss) line = copy.miss
  if (now - snapAt < 800) line = copy.snap
  if (phase === 'complete') line = copy.complete

  return (
    <header className="hud">
      <div className="hud-left">
        <p className="wordmark">World Snap</p>
        <p className="hint" aria-live="polite">
          {line}
        </p>
      </div>
      <div className="hud-right">
        <p className="count">{copy.count(placed, total)}</p>
        {phase === 'complete' && (
          <button type="button" className="ghost" onClick={replay}>
            {copy.replay}
          </button>
        )}
      </div>
    </header>
  )
}
