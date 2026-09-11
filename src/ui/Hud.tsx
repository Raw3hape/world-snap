import { useEffect, useState } from 'react'
import { copy } from '../game/copy'
import { useGame } from '../game/store'

export function Hud({ total }: { total: number }) {
  const phase = useGame((s) => s.phase)
  const placed = useGame((s) => s.placed.length)
  const firstId = useGame((s) => s.firstId)
  const painted = useGame((s) => s.painted)
  const draggingId = useGame((s) => s.draggingId)
  const dragLabel = useGame((s) => s.dragLabel)
  const missAt = useGame((s) => s.missAt)
  const snapAt = useGame((s) => s.snapAt)
  const collectionOpen = useGame((s) => s.collectionOpen)
  const openCollection = useGame((s) => s.openCollection)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!missAt && !snapAt) return
    const id = window.setInterval(() => setNow(Date.now()), 120)
    return () => window.clearInterval(id)
  }, [missAt, snapAt])

  if (phase === 'title' || collectionOpen) return null

  const miss = now - missAt < 1600
  let line = ''
  if (phase === 'complete') line = copy.complete
  else if (phase === 'choose-first' || !firstId) line = copy.choose
  else if (placed === 0 && miss) line = copy.missHint
  else if (placed === 0 && firstId && !painted.includes(firstId) && !draggingId) line = copy.paint
  else if (placed === 0 && draggingId) line = copy.contour
  else if (placed === 0) line = copy.place
  else if (now - snapAt < 900) line = copy.snap
  else if (placed === 1 && !draggingId) line = copy.scatter
  else if (dragLabel) line = dragLabel
  else if (placed < 3) line = copy.hint

  return (
    <header className="hud">
      <div className="hud-left">
        <p className="wordmark">World Snap</p>
        <p className="hint" aria-live="polite">
          {line}
        </p>
      </div>
      <div className="hud-right">
        <button type="button" className="ghost" onClick={() => openCollection(true)}>
          {copy.collection}
        </button>
        <p className="count">{copy.count(placed, total)}</p>
      </div>
    </header>
  )
}
