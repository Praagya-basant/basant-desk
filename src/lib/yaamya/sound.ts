// Tiny WebAudio feedback tones for the Wood Inward keypad — ported verbatim
// from the standalone Yaamya app. Kept because the entry flow is used on a
// tablet at the yard where audible confirmation of each tap/save matters.
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  if (!ctx) ctx = new AudioCtx()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone({
  freq,
  duration = 0.08,
  type = 'sine',
  gain = 0.14,
  startDelay = 0,
}: {
  freq: number
  duration?: number
  type?: OscillatorType
  gain?: number
  startDelay?: number
}) {
  const audioCtx = getCtx()
  if (!audioCtx) return

  const osc = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()
  osc.type = type
  osc.frequency.value = freq

  const startTime = audioCtx.currentTime + startDelay
  gainNode.gain.setValueAtTime(0, startTime)
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.005)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  osc.connect(gainNode)
  gainNode.connect(audioCtx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.03)
}

export function playDigitClick() {
  tone({ freq: 920, duration: 0.045, type: 'sine', gain: 0.1 })
}

export function playBackspaceClick() {
  tone({ freq: 320, duration: 0.06, type: 'triangle', gain: 0.09 })
}

export function playClearClick() {
  tone({ freq: 340, duration: 0.1, type: 'square', gain: 0.08 })
  tone({ freq: 220, duration: 0.12, type: 'square', gain: 0.08, startDelay: 0.06 })
}

export function playSaveSuccess() {
  tone({ freq: 1046.5, duration: 0.09, type: 'sine', gain: 0.15 })
  tone({ freq: 1568, duration: 0.14, type: 'sine', gain: 0.15, startDelay: 0.1 })
}

export function playEndTruckComplete() {
  tone({ freq: 523.25, duration: 0.16, type: 'sine', gain: 0.14 })
  tone({ freq: 659.25, duration: 0.16, type: 'sine', gain: 0.14, startDelay: 0.14 })
  tone({ freq: 783.99, duration: 0.35, type: 'sine', gain: 0.14, startDelay: 0.28 })
}
