/// <reference types="vite/client" />

interface Window {
  __worldSnap?: typeof import('./game/store').useGame
  __ws?: import('./test/bridge').WsBridge
}
