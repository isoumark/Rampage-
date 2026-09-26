import * as THREE from 'three'
import { alignWeaponMount, findWeaponHand } from './WeaponPose.js'

const MAGAZINE_SIZE = 30
const FIRE_INTERVAL = 0.105
const RELOAD_DURATION = 1.65

export class GunController {
  constructor({ loader, modelUrl, camera, scene, domElement, player, network, onAmmoChanged, onShot }) {
    this.loader = loader
    this.modelUrl = modelUrl
    this.scene = scene
    this.camera = camera
    this.domElement = domElement
    this.player = player
    this.network = network
    this.onAmmoChanged = onAmmoChanged
    this.onShot = onShot
    this.ammo = MAGAZINE_SIZE
    this.reserve = 180
    this.fireCooldown = 0
    this.reloadTimer = 0
    this.reloadCloseStarted = false
    this.recoil = 0
    this.swayTime = 0
    this.muzzleTimer = 0
    this.chargeCloseTimer = 0
    this.firing = false
    this.tracers = []
    this.weaponMount = new THREE.Group()
    this.weaponMount.name = 'LocalAssaultRifleMount'
    this.player.root.add(this.weaponMount)
    this.handBone = null
    this.handPosition = new THREE.Vector3()
    this.weaponModel = null
    this.weaponMixer = null
    this.weaponActions = new Map()
    this.loadWeapon()

    this.muzzleLight = new THREE.PointLight(0xffa83d, 0, 4)
    this.muzzleLight.position.set(0, 0.03, 1.02)
    this.weaponMount.add(this.muzzleLight)

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

  async loadWeapon() {
    try {
      const gltf = await this.loader.loadAsync(this.modelUrl)
      const model = gltf.scene
      model.name = 'StandardAssaultRifle'
      model.traverse((child) => {
        if (!child.isMesh) return
        child.castShadow = true
        child.receiveShadow = true
      })
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      const scale = 0.9 / Math.max(size.z, size.x, 0.001)
      model.scale.setScalar(scale)
      model.updateMatrixWorld(true)
      const scaledBounds = new THREE.Box3().setFromObject(model)
      const center = scaledBounds.getCenter(new THREE.Vector3())
      model.position.sub(center)
      model.position.z += 0.05
      this.weaponMount.add(model)
      this.weaponModel = model
      this.weaponMixer = new THREE.AnimationMixer(model)
      for (const clip of gltf.animations) this.weaponActions.set(clip.name.toLowerCase(), this.weaponMixer.clipAction(clip))
      this.network.setWeaponTemplate(model)
      console.info(`[Gun] Loaded CC0 Standard Assault Rifle. Animations: ${gltf.animations.map((clip) => clip.name).join(', ')}`)
    } catch (error) {
      console.warn('[Gun] Assault rifle model failed to load. Shooting remains available without a weapon mesh.', error)
    }
  }

  playWeaponClip(name, timeScale = 1) {
    const action = this.weaponActions.get(name)
    if (!action) return
    action.reset()
    action.enabled = true
    action.clampWhenFinished = true
    action.setLoop(THREE.LoopOnce, 1)
    action.setEffectiveTimeScale(timeScale)
    action.play()
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
    this.playWeaponClip('charge-open', 7)
    this.chargeCloseTimer = 0.055

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
    this.reloadCloseStarted = false
    this.playWeaponClip('magazine-open', 1.15)
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
    this.weaponMixer?.update(deltaTime)
    this.weaponMount.visible = this.player.spawned && this.player.isAlive
    this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime)
    if (this.chargeCloseTimer > 0) {
      this.chargeCloseTimer -= deltaTime
      if (this.chargeCloseTimer <= 0) this.playWeaponClip('charge-close', 8)
    }
    if (this.firing) this.fire()
    this.swayTime += deltaTime
    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 16, deltaTime)
    this.muzzleTimer = Math.max(0, this.muzzleTimer - deltaTime)
    this.muzzleLight.intensity = this.muzzleTimer > 0 ? 3.4 : 0

    const movement = Math.min(1, this.player.currentSpeed / 7)
    if (!this.handBone && this.player.model) this.handBone = findWeaponHand(this.player.model)
    const attached = alignWeaponMount(this.player.root, this.handBone, this.weaponMount, this.handPosition)
    if (!attached) this.weaponMount.position.set(0.34, 1.12, 0.2)
    this.weaponMount.position.x += 0.025 + Math.sin(this.swayTime * 8) * 0.004 * movement
    this.weaponMount.position.y += 0.025 + Math.abs(Math.cos(this.swayTime * 8)) * 0.003 * movement
    this.weaponMount.position.z += 0.18 - this.recoil * 0.025
    this.weaponMount.rotation.x = -0.085 + this.recoil * 0.075
    this.weaponMount.rotation.y = -0.035
    this.weaponMount.rotation.z = -0.035 + Math.sin(this.swayTime * 4) * 0.006 * movement

    if (this.reloadTimer > 0) {
      const previous = this.reloadTimer
      this.reloadTimer = Math.max(0, this.reloadTimer - deltaTime)
      const progress = 1 - this.reloadTimer / RELOAD_DURATION
      this.weaponMount.rotation.z -= Math.sin(progress * Math.PI) * 0.38
      this.weaponMount.position.y -= Math.sin(progress * Math.PI) * 0.12
      if (!this.reloadCloseStarted && progress > 0.55) {
        this.reloadCloseStarted = true
        this.playWeaponClip('magazine-close', 1.2)
      }
      if (previous > 0 && this.reloadTimer === 0) this.finishReload()
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
    this.weaponMixer?.stopAllAction()
    this.weaponMount.removeFromParent()
  }
}
