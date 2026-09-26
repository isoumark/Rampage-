import * as THREE from 'three'

const MAGAZINE_SIZE = 30
const FIRE_INTERVAL = 0.105
const RELOAD_DURATION = 1.65

export function createWorldRifle() {
  const rifle = new THREE.Group()
  rifle.name = 'TacticalRifle'
  const dark = new THREE.MeshStandardMaterial({ color: 0x171c20, roughness: 0.45, metalness: 0.68 })
  const metal = new THREE.MeshStandardMaterial({ color: 0x4b565c, roughness: 0.34, metalness: 0.84 })
  const add = (size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    mesh.position.set(...position)
    mesh.castShadow = true
    rifle.add(mesh)
  }
  add([0.13, 0.15, 0.65], [0, 0, -0.1], dark)
  add([0.09, 0.09, 0.7], [0, 0.02, -0.72], metal)
  add([0.12, 0.3, 0.18], [0, -0.2, -0.25], dark)
  add([0.2, 0.2, 0.32], [0, 0, 0.38], dark)
  return rifle
}

export class GunController {
  constructor({ camera, scene, domElement, player, network, onAmmoChanged, onShot }) {
    this.camera = camera
    this.scene = scene
    this.domElement = domElement
    this.player = player
    this.network = network
    this.onAmmoChanged = onAmmoChanged
    this.onShot = onShot
    this.ammo = MAGAZINE_SIZE
    this.reserve = 180
    this.fireCooldown = 0
    this.reloadTimer = 0
    this.recoil = 0
    this.swayTime = 0
    this.muzzleTimer = 0
    this.firing = false
    this.tracers = []
    this.root = new THREE.Group()
    this.root.name = 'LocalRifleViewmodel'
    this.root.position.set(0.72, -0.58, -1.25)
    this.camera.add(this.root)
    this.buildRifle()
    this.worldRifle = createWorldRifle()
    this.worldRifle.position.set(0.38, 1.18, 0.28)
    this.worldRifle.rotation.set(-0.1, 0, -0.08)
    this.player.root.add(this.worldRifle)
    this.root.visible = false

    this.onMouseDown = (event) => {
      if (event.button !== 0 || document.pointerLockElement !== this.domElement) return
      this.firing = true
      this.fire()
    }
    this.onMouseUp = (event) => { if (event.button === 0) this.firing = false }
    this.onPointerLockChange = () => { if (document.pointerLockElement !== this.domElement) this.firing = false }
    this.onKeyDown = (event) => {
      if (event.code === 'KeyR' && !(event.target instanceof HTMLInputElement)) this.reload()
    }
    document.addEventListener('mousedown', this.onMouseDown)
    document.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    window.addEventListener('keydown', this.onKeyDown)
    this.emitAmmo()
  }

  buildRifle() {
    const dark = new THREE.MeshStandardMaterial({ color: 0x171c20, roughness: 0.42, metalness: 0.7 })
    const metal = new THREE.MeshStandardMaterial({ color: 0x465158, roughness: 0.35, metalness: 0.82 })
    const accent = new THREE.MeshStandardMaterial({ color: 0x739d45, roughness: 0.58 })
    const box = (size, position, material, parent = this.root) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
      mesh.position.set(...position)
      mesh.castShadow = true
      parent.add(mesh)
      return mesh
    }
    box([0.18, 0.2, 0.8], [0, 0, -0.18], dark)
    box([0.14, 0.14, 0.82], [0, 0.02, -0.92], metal)
    box([0.24, 0.11, 0.32], [0, 0.14, -0.22], accent)
    box([0.15, 0.38, 0.22], [0, -0.25, -0.16], dark).rotation.x = -0.25
    this.magazine = box([0.16, 0.42, 0.24], [0, -0.27, -0.46], metal)
    box([0.28, 0.28, 0.42], [0, -0.01, 0.42], dark)
    this.muzzle = new THREE.Object3D()
    this.muzzle.position.set(0, 0.02, -1.38)
    this.root.add(this.muzzle)
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0 }),
    )
    this.flash.position.copy(this.muzzle.position)
    this.root.add(this.flash)
    this.flashLight = new THREE.PointLight(0xffa83d, 0, 5)
    this.flashLight.position.copy(this.muzzle.position)
    this.root.add(this.flashLight)
  }

  fire() {
    if (!this.player.spawned || !this.player.isAlive || this.reloadTimer > 0 || this.fireCooldown > 0) return
    if (this.ammo <= 0) {
      this.reload()
      return
    }
    this.ammo -= 1
    this.fireCooldown = FIRE_INTERVAL
    this.recoil = Math.min(1, this.recoil + 0.82)
    this.muzzleTimer = 0.055
    this.emitAmmo()
    this.onShot?.()

    const cameraOrigin = new THREE.Vector3()
    const cameraDirection = new THREE.Vector3()
    this.camera.getWorldPosition(cameraOrigin)
    this.camera.getWorldDirection(cameraDirection)
    const origin = this.player.root.position.clone().add(new THREE.Vector3(0, 1.45, 0))
    const aimPoint = cameraOrigin.addScaledVector(cameraDirection, 90)
    const direction = aimPoint.sub(origin).normalize()
    this.network.sendMonsterHit(origin, direction)
    this.addTracer(origin, direction)
  }

  addTracer(origin, direction) {
    const end = origin.clone().addScaledVector(direction, 55)
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end])
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0.8 }))
    this.scene.add(line)
    this.tracers.push({ line, life: 0.06 })
  }

  reload() {
    if (this.reloadTimer > 0 || this.ammo >= MAGAZINE_SIZE || this.reserve <= 0) return
    this.reloadTimer = RELOAD_DURATION
    this.emitAmmo()
  }

  finishReload() {
    const amount = Math.min(MAGAZINE_SIZE - this.ammo, this.reserve)
    this.ammo += amount
    this.reserve -= amount
    this.emitAmmo()
  }

  emitAmmo() {
    this.onAmmoChanged?.(this.ammo, this.reserve, this.reloadTimer > 0)
  }

  update(deltaTime) {
    this.root.visible = this.player.spawned && this.player.isAlive
    this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime)
    if (this.firing) this.fire()
    this.swayTime += deltaTime
    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 15, deltaTime)
    this.muzzleTimer = Math.max(0, this.muzzleTimer - deltaTime)
    this.flash.material.opacity = this.muzzleTimer > 0 ? 1 : 0
    this.flash.scale.setScalar(0.7 + Math.random() * 0.8)
    this.flashLight.intensity = this.muzzleTimer > 0 ? 3.5 : 0

    const movement = Math.min(1, this.player.currentSpeed / 7)
    this.root.position.x = 0.72 + Math.sin(this.swayTime * 8) * 0.012 * movement
    this.root.position.y = -0.58 + Math.abs(Math.cos(this.swayTime * 8)) * 0.012 * movement - this.recoil * 0.035
    this.root.rotation.x = this.recoil * 0.1
    this.root.rotation.z = Math.sin(this.swayTime * 4) * 0.008 * movement
    this.worldRifle.rotation.x = -0.1 + this.recoil * 0.14

    if (this.reloadTimer > 0) {
      const previous = this.reloadTimer
      this.reloadTimer = Math.max(0, this.reloadTimer - deltaTime)
      const progress = 1 - this.reloadTimer / RELOAD_DURATION
      this.root.rotation.z += Math.sin(progress * Math.PI) * 0.55
      this.root.position.y -= Math.sin(progress * Math.PI) * 0.22
      this.magazine.position.y = -0.27 - Math.sin(progress * Math.PI) * 0.35
      if (previous > 0 && this.reloadTimer === 0) this.finishReload()
    } else {
      this.magazine.position.y = -0.27
    }

    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      const tracer = this.tracers[i]
      tracer.life -= deltaTime
      tracer.line.material.opacity = Math.max(0, tracer.life / 0.06)
      if (tracer.life <= 0) {
        tracer.line.geometry.dispose()
        tracer.line.material.dispose()
        tracer.line.removeFromParent()
        this.tracers.splice(i, 1)
      }
    }
  }

  dispose() {
    document.removeEventListener('mousedown', this.onMouseDown)
    document.removeEventListener('mouseup', this.onMouseUp)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    window.removeEventListener('keydown', this.onKeyDown)
    for (const tracer of this.tracers) {
      tracer.line.geometry.dispose()
      tracer.line.material.dispose()
      tracer.line.removeFromParent()
    }
    this.root.removeFromParent()
    this.worldRifle.removeFromParent()
  }
}
