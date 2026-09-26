export class SoundManager {
  constructor() {
    this.context = null
    this.master = null
    this.footstepTimer = 0
    this.heartbeatTimer = 0
    this.enabled = true
    this.unlock = () => this.ensureContext()
    window.addEventListener('pointerdown', this.unlock, { once: true })
  }

  ensureContext() {
    if (!this.context) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = 0.28
      this.master.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') this.context.resume()
  }

  tone(frequency, duration, volume, type = 'sine', slideTo = frequency) {
    if (!this.context || !this.enabled) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    oscillator.connect(gain).connect(this.master)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }

  update(deltaTime, playerSpeed, danger) {
    if (!this.context) return
    this.footstepTimer -= deltaTime
    this.heartbeatTimer -= deltaTime
    if (playerSpeed > 0.8 && this.footstepTimer <= 0) {
      this.tone(95, 0.08, 0.13, 'triangle', 55)
      this.footstepTimer = playerSpeed > 4.2 ? 0.28 : 0.43
    }
    if (danger && this.heartbeatTimer <= 0) {
      this.tone(62, 0.13, 0.16, 'sine', 48)
      this.heartbeatTimer = 0.62
    }
  }

  smash() {
    this.tone(105, 0.42, 0.55, 'sawtooth', 28)
  }

  hit() {
    this.tone(180, 0.2, 0.38, 'square', 65)
  }

  gunshot() {
    this.tone(145, 0.09, 0.34, 'square', 42)
    this.tone(760, 0.035, 0.11, 'sawtooth', 170)
  }
}
