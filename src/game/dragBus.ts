type Start = (id: string, clientX: number, clientY: number) => void

let start: Start | null = null

export const dragBus = {
  bind(fn: Start | null) {
    start = fn
  },
  begin(id: string, clientX: number, clientY: number) {
    start?.(id, clientX, clientY)
  },
}
