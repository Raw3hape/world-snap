let ctx: AudioContext | null = null

function audio() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function unlockAudio() {
  try {
    audio()
  } catch {
    /* autoplay policy */
  }
}

function envGain(t: AudioContext, duration: number, peak: number, attack = 0.008) {
  const g = t.createGain()
  g.gain.setValueAtTime(0.0001, t.currentTime)
  g.gain.exponentialRampToValueAtTime(peak, t.currentTime + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t.currentTime + duration)
  return g
}

function noiseBuffer(t: AudioContext, seconds: number) {
  const n = Math.floor(t.sampleRate * seconds)
  const buf = t.createBuffer(1, n, t.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
  return buf
}

export function playPickup(muted: boolean) {
  if (muted) return
  const t = audio()
  const o = t.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(420, t.currentTime)
  o.frequency.exponentialRampToValueAtTime(620, t.currentTime + 0.07)
  const g = envGain(t, 0.09, 0.04)
  o.connect(g).connect(t.destination)
  o.start()
  o.stop(t.currentTime + 0.1)
}

export function playSnap(muted: boolean) {
  if (muted) return
  const t = audio()
  const now = t.currentTime

  const click = t.createOscillator()
  click.type = 'sine'
  click.frequency.setValueAtTime(2100, now)
  click.frequency.exponentialRampToValueAtTime(900, now + 0.07)
  const clickG = envGain(t, 0.08, 0.09, 0.002)
  click.connect(clickG).connect(t.destination)
  click.start(now)
  click.stop(now + 0.09)

  const ring = t.createOscillator()
  ring.type = 'triangle'
  ring.frequency.setValueAtTime(3400, now)
  ring.frequency.exponentialRampToValueAtTime(1600, now + 0.05)
  const ringG = envGain(t, 0.06, 0.035, 0.001)
  ring.connect(ringG).connect(t.destination)
  ring.start(now)
  ring.stop(now + 0.07)

  const src = t.createBufferSource()
  src.buffer = noiseBuffer(t, 0.05)
  const bp = t.createBiquadFilter()
  bp.type = 'highpass'
  bp.frequency.value = 1800
  const nG = envGain(t, 0.045, 0.05, 0.001)
  src.connect(bp).connect(nG).connect(t.destination)
  src.start(now)
}

export function playPaint(muted: boolean) {
  if (muted) return
  const t = audio()
  const src = t.createBufferSource()
  src.buffer = noiseBuffer(t, 0.35)
  const lp = t.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(2400, t.currentTime)
  lp.frequency.exponentialRampToValueAtTime(420, t.currentTime + 0.32)
  const g = envGain(t, 0.34, 0.045, 0.02)
  src.connect(lp).connect(g).connect(t.destination)
  src.start()
}

export function playMiss(muted: boolean) {
  if (muted) return
  const t = audio()
  const o = t.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(180, t.currentTime)
  o.frequency.exponentialRampToValueAtTime(90, t.currentTime + 0.14)
  const g = envGain(t, 0.16, 0.06, 0.004)
  o.connect(g).connect(t.destination)
  o.start()
  o.stop(t.currentTime + 0.18)

  const src = t.createBufferSource()
  src.buffer = noiseBuffer(t, 0.12)
  const lp = t.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 500
  const nG = envGain(t, 0.12, 0.03, 0.004)
  src.connect(lp).connect(nG).connect(t.destination)
  src.start()
}

export function playComplete(muted: boolean) {
  if (muted) return
  const t = audio()
  const freqs = [392, 494, 587]
  freqs.forEach((f, i) => {
    const o = t.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = envGain(t, 0.7, 0.03, 0.02)
    o.connect(g).connect(t.destination)
    o.start(t.currentTime + i * 0.08)
    o.stop(t.currentTime + 0.75)
  })
}

export function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}
