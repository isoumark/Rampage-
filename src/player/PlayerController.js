import * as THREE from 'three'
import { InputController } from './InputController.js'
import { retargetAnimation } from './retargetAnimation.js'

const PLAYER_SCALE = 0.01
const WALK_SPEED = 3.5
const RUN_SPEED = 7
const TURN_SPEED = 12
const FADE_DURATION = 0.25
const ACCELERATION = 14
const DECELERATION = 18

export class PlayerController {
  constructor({
    scene,
    loader,
    modelUrl,
    animationUrls,
    onProgress,
    resolveMovement,
    onHealthChanged,
    onRespawn,
  }) {
    this.scene = scene
    this.loader = loader
    this.modelUrl = modelUrl
    this.animationUrls = animationUrls
    this.onProgress = onProgress
    this.resolveMovement = resolveMovement
    this.onHealthChanged = onHealthChanged
    this.onRespawn = onRespawn
    this.root = new THREE.Group()
    this.root.name = 'LocalPlayer'
    this.scene.add(this.root)

    this.input = new InputController()
    this.model = null
    this.mixer = null
    this.actions = new Map()
    this.activeAction = null
    this.animationState = 'idle'
    this.moveDirection = new THREE.Vector3()
    this.velocity = new THREE.Vector3()
    this.targetVelocity = new THREE.Vector3()
    this.targetQuaternion = new THREE.Quaternion()
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ')
    this.loaded = false
    this.spawned = false
    this.currentSpeed = 0
    this.maxHealth = 100
    this.health = this.maxHealth
    this.invulnerability = 0
    this.respawnTimer = 0
    this.spawnPoint = new THREE.Vector3(0, 0, 25)
    this.previousPosition = new THREE.Vector3()
    this.root.position.copy(this.spawnPoint)
  }

  async load() {
    const model = await this.loadFbx(this.modelUrl, (event) => {
      if (event.total && this.onProgress) {
        this.onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })

    this.model = model
    this.model.scale.setScalar(PLAYER_SCALE)
    this.model.updateMatrixWorld(true)
    this.placeModelOnGround()
    this.model.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      child.receiveShadow = true
    })
    this.root.add(this.model)

    this.mixer = new THREE.AnimationMixer(this.model)
    const embeddedClips = model.animations ?? []
    const animationResults = await Promise.all(
      Object.entries(this.animationUrls).map(async ([state, url]) => {
        try {
          const animationFbx = await this.loadFbx(url)
          const sourceClip = animationFbx.animations?.[0]
          const clip = sourceClip ? retargetAnimation(animationFbx, this.model, sourceClip) : null
          if (!clip) throw new Error(`No animation clip was found in ${url}`)
          return [state, clip]
        } catch (error) {
          console.warn(`[Player] Optional ${state} animation unavailable at ${url}.`, error)
          return null
        }
      }),
    )

    for (const result of animationResults) {
      if (result) this.addAction(...result)
    }

    if (!this.actions.has('walk')) this.addAction('walk', this.createLocomotionClip('Walk', 0.9, 0.42))
    if (!this.actions.has('run')) this.addAction('run', this.createLocomotionClip('Run', 0.58, 0.78))

    if (!this.actions.has('idle') && embeddedClips[0]) {
      this.addAction('idle', embeddedClips[0])
      console.info('[Player] Using the animation embedded in player.fbx as Idle.')
    }

    this.setAnimation('idle')
    this.loaded = true
    this.root.visible = this.spawned
    console.info(`[Player] Character loaded successfully. Animations: ${[...this.actions.keys()].join(', ')}`)
  }

  loadFbx(url, onProgress) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, onProgress, reject)
    })
  }

  placeModelOnGround() {
    const bounds = new THREE.Box3().setFromObject(this.model)
    if (!bounds.isEmpty() && Number.isFinite(bounds.min.y)) {
      this.model.position.y -= bounds.min.y
    }
  }

  addAction(name, clip) {
    const action = this.mixer.clipAction(clip)
    action.enabled = true
    this.actions.set(name, action)
  }

  createLocomotionClip(name, duration, stride) {
    const findBone = (...tokens) => {
      let match = null
      this.model.traverse((child) => {
        if (match || !child.isBone) return
        const normalized = child.name.toLowerCase().replace(/[^a-z]/g, '')
        if (tokens.some((token) => normalized.includes(token))) match = child
      })
      return match
    }

    const bones = [
      [findBone('leftupleg', 'leftthigh'), stride],
      [findBone('rightupleg', 'rightthigh'), -stride],
      [findBone('leftarm', 'leftupperarm'), -stride * 0.72],
      [findBone('rightarm', 'rightupperarm'), stride * 0.72],
    ]
    const times = [0, duration * 0.25, duration * 0.5, duration * 0.75, duration]
    const tracks = []
    for (const [bone, amplitude] of bones) {
      if (!bone) continue
      const values = []
      for (const phase of [0, 1, 0, -1, 0]) {
        const rotation = bone.quaternion.clone().multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(amplitude * phase, 0, 0)),
        )
        values.push(rotation.x, rotation.y, rotation.z, rotation.w)
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values))
    }
    console.info(`[Player] Generated ${name} animation for ${tracks.length} Mixamo bones.`)
    return new THREE.AnimationClip(name, duration, tracks)
  }


  setAnimation(name) {
    const nextAction = this.actions.get(name) ?? this.actions.get('idle')
    if (!nextAction || nextAction === this.activeAction) return

    nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(FADE_DURATION).play()
    this.activeAction?.fadeOut(FADE_DURATION)
    this.activeAction = nextAction
    this.animationState = this.actions.has(name) ? name : 'idle'
  }

  update(deltaTime, cameraYaw) {
    this.mixer?.update(deltaTime)
    if (!this.loaded || !this.spawned) return

    this.invulnerability = Math.max(0, this.invulnerability - deltaTime)
    if (!this.isAlive) {
      this.respawnTimer -= deltaTime
      if (this.respawnTimer <= 0) this.respawn()
      return
    }

    const { x, z } = this.input.movement
    this.moveDirection.set(x, 0, z)
    const hasInput = this.moveDirection.lengthSq() > 0
    if (hasInput) this.moveDirection.normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, cameraYaw)
    const targetSpeed = hasInput ? (this.input.sprinting ? RUN_SPEED : WALK_SPEED) : 0
    this.targetVelocity.copy(this.moveDirection).multiplyScalar(targetSpeed)
    const response = hasInput ? ACCELERATION : DECELERATION
    this.velocity.lerp(this.targetVelocity, 1 - Math.exp(-response * deltaTime))
    this.currentSpeed = this.velocity.length()

    this.previousPosition.copy(this.root.position)
    this.root.position.addScaledVector(this.velocity, deltaTime)
    this.root.position.y = 0
    this.resolveMovement?.(this.root.position, this.previousPosition)
    this.velocity.copy(this.root.position).sub(this.previousPosition).divideScalar(Math.max(deltaTime, 0.0001))
    this.currentSpeed = this.velocity.length()

    if (this.currentSpeed > 0.08) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z)
      this.euler.set(0, targetYaw, 0)
      this.targetQuaternion.setFromEuler(this.euler)
      this.root.quaternion.slerp(this.targetQuaternion, 1 - Math.exp(-TURN_SPEED * deltaTime))
    }

    if (this.currentSpeed < 0.15) this.setAnimation('idle')
    else if (this.currentSpeed > WALK_SPEED + 0.6) this.setAnimation('run')
    else this.setAnimation('walk')
    if (this.currentSpeed > 0.15) {
      this.activeAction?.setEffectiveTimeScale(THREE.MathUtils.clamp(this.currentSpeed / (this.isSprinting ? RUN_SPEED : WALK_SPEED), 0.35, 1.2))
    }
  }

  spawn() {
    if (!this.loaded) return false
    this.spawned = true
    this.root.visible = true
    this.root.position.copy(this.spawnPoint)
    this.velocity.set(0, 0, 0)
    this.setAnimation('idle')
    return true
  }

  takeDamage(amount) {
    if (!this.spawned || !this.isAlive || this.invulnerability > 0) return false
    this.health = Math.max(0, this.health - amount)
    this.invulnerability = 0.45
    this.onHealthChanged?.(this.health, this.maxHealth)
    if (this.health <= 0) {
      this.respawnTimer = 3
      this.model.visible = false
    }
    return true
  }

  respawn() {
    this.health = this.maxHealth
    this.root.position.copy(this.spawnPoint)
    this.model.visible = true
    this.invulnerability = 2
    this.onHealthChanged?.(this.health, this.maxHealth)
    this.onRespawn?.()
  }

  get isAlive() {
    return this.health > 0
  }

  get isSprinting() {
    return this.spawned && this.isAlive && this.currentSpeed > WALK_SPEED + 0.6
  }

  dispose() {
    this.input.dispose()
    this.mixer?.stopAllAction()
  }
}
