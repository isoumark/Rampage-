export class InputController {
  constructor() {
    this.keys = new Set()
    this.onKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      this.keys.add(event.code)
    }
    this.onKeyUp = (event) => this.keys.delete(event.code)
    this.onBlur = () => this.keys.clear()

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  get movement() {
    return {
      x: Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')),
      z: Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW')),
    }
  }

  get sprinting() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }
}
