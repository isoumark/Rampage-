import * as THREE from 'three'

const CHASE_SPEED = 5.8
const CHASE_ACCELERATION = 7.5
const MONSTER_RADIUS = 0.85
const ATTACK_RANGE = 2.3
const ATTACK_DAMAGE = 35
const ATTACK_COOLDOWN = 1.15

export class RageMonster {
  constructor({ scene, target, officeMap, loader, modelUrl, onAttack, onSmash }) {
    this.scene = scene
    this.target = target
    this.officeMap = officeMap
    this.loader = loader
    this.modelUrl = modelUrl
    this.onAttack = onAttack
    this.onSmash = onSmash
    this.root = new THREE.Group()
    this.root.name = 'OriginalRageMonster'
    this.spawnPoint = new THREE.Vector3(0, 0, -26)
    this.root.position.copy(this.spawnPoint)
    this.targetDirection = new THREE.Vector3()
    this.velocity = new THREE.Vector3()
    this.desiredVelocity = new THREE.Vector3()
    this.previousPosition = new THREE.Vector3()
    this.targetQuaternion = new THREE.Quaternion()
    this.attackTimer = 0
    this.localDamageTimer = 0
    this.attackAnimationTimer = 0
    this.smashTimer = 0
    this.walkTime = 0
    this.mixer = null
    this.actions = new Map()
    this.activeAction = null
    this.animationState = 'idle'
    this.networkPosition = this.spawnPoint.clone()
    this.networkQuaternion = new THREE.Quaternion()
    this.animatedModel = null
    this.buildPlaceholder()
    scene.add(this.root)
    this.loadModel()
  }

  async loadModel() {
    try {
      const gltf = await this.loader.loadAsync(this.modelUrl)
      const model = gltf.scene
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      const targetHeight = 3.75
      model.scale.setScalar(targetHeight / Math.max(size.y, 0.001))
      model.updateMatrixWorld(true)
      const scaledBounds = new THREE.Box3().setFromObject(model)
      model.position.y -= scaledBounds.min.y
      model.traverse((child) => {
        if (!child.isMesh) return
        child.castShadow = true
        child.receiveShadow = true
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        child.material = materials.map((sourceMaterial) => {
          const material = sourceMaterial.clone()
          if (material.color) {
            material.color.lerp(new THREE.Color(0x3b9b49), 0.58)
          }
          if (material.emissive) {
            material.emissive.set(0x123d19)
            material.emissiveIntensity = 0.72
          }
          material.roughness = 0.72
          return material
        })
        if (child.material.length === 1) child.material = child.material[0]
      })

      this.placeholder.visible = false
      this.animatedModel = model
      this.root.add(model)
      this.normalizeRootMotion(gltf.animations, model)
      this.mixer = new THREE.AnimationMixer(model)
      for (const clip of gltf.animations) {
        this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip))
      }
      this.setAnimation('idle')
      console.info(
        `[RageMonster] CC0 Giant Mutant loaded. Animations: ${gltf.animations
          .map((clip) => clip.name)
          .join(', ')}`,
      )
    } catch (error) {
      console.warn('[RageMonster] Model failed to load; keeping the procedural fallback.', error)
    }
  }

  normalizeRootMotion(clips, model) {
    const hips = model.getObjectByName('mixamorigHips')
    if (!hips) return
    for (const clip of clips) {
      const track = clip.tracks.find((candidate) => candidate.name === 'mixamorigHips.position')
      if (!track) continue
      const firstX = track.values[0]
      const firstY = track.values[1]
      const firstZ = track.values[2]
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = hips.position.x + (track.values[i] - firstX) * 0.05
        track.values[i + 1] = hips.position.y + (track.values[i + 1] - firstY)
        track.values[i + 2] = hips.position.z + (track.values[i + 2] - firstZ) * 0.05
      }
    }
  }

  findAction(...names) {
    for (const name of names) {
      const exact = this.actions.get(name.toLowerCase())
      if (exact) return exact
      const partial = [...this.actions.entries()].find(([key]) => key.includes(name.toLowerCase()))
      if (partial) return partial[1]
    }
    return null
  }

  setAnimation(name, restart = false) {
    this.animationState = name
    const choices = {
      idle: ['idle'],
      run: ['run', 'running'],
      attack: ['right punch', 'rightpunch', 'punch'],
    }
    const nextAction = this.findAction(...(choices[name] ?? [name]))
    if (!nextAction || (!restart && nextAction === this.activeAction)) return
    if (restart) nextAction.reset()
    nextAction.enabled = true
    nextAction.setEffectiveWeight(1).fadeIn(0.16).play()
    if (this.activeAction && this.activeAction !== nextAction) this.activeAction.fadeOut(0.16)
    this.activeAction = nextAction
  }

  reset() {
    this.root.position.copy(this.spawnPoint)
    this.root.position.y = 0
    this.velocity.set(0, 0, 0)
    this.attackTimer = 1.5
    this.attackAnimationTimer = 0
    this.smashTimer = 0
    this.setAnimation('run')
  }

  setTarget(target) {
    if (target) this.target = target
  }

  buildPlaceholder() {
    this.placeholder = new THREE.Group()
    this.placeholder.scale.setScalar(0.76)
    this.root.add(this.placeholder)
    const skin = new THREE.MeshStandardMaterial({ color: 0x358f3e, roughness: 0.78 })
    const darkSkin = new THREE.MeshStandardMaterial({ color: 0x22602b, roughness: 0.85 })
    const clothes = new THREE.MeshStandardMaterial({ color: 0x272433, roughness: 0.9 })
    const eye = new THREE.MeshBasicMaterial({ color: 0xffd54a })

    const addPart = (geometry, material, position, parent = this.placeholder) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(position)
      mesh.castShadow = true
      mesh.receiveShadow = true
      parent.add(mesh)
      return mesh
    }

    addPart(new THREE.SphereGeometry(1.35, 18, 14), skin, new THREE.Vector3(0, 3.7, 0))
    addPart(new THREE.SphereGeometry(0.82, 16, 12), darkSkin, new THREE.Vector3(0, 5.2, -0.05))
    addPart(new THREE.BoxGeometry(2.7, 1.2, 1.45), clothes, new THREE.Vector3(0, 2.5, 0))
    this.leftArm = new THREE.Group()
    this.leftArm.position.set(-1.2, 4.1, 0)
    this.placeholder.add(this.leftArm)
    addPart(new THREE.CapsuleGeometry(0.48, 2.1, 6, 10), skin, new THREE.Vector3(0, -1.15, 0), this.leftArm)
    addPart(new THREE.SphereGeometry(0.68, 12, 10), darkSkin, new THREE.Vector3(0, -2.35, 0), this.leftArm)
    this.rightArm = this.leftArm.clone()
    this.rightArm.position.x = 1.2
    this.placeholder.add(this.rightArm)
    this.leftLeg = new THREE.Group()
    this.leftLeg.position.set(-0.62, 2.2, 0)
    this.placeholder.add(this.leftLeg)
    addPart(new THREE.CapsuleGeometry(0.52, 1.55, 6, 10), darkSkin, new THREE.Vector3(0, -1.25, 0), this.leftLeg)
    this.rightLeg = this.leftLeg.clone()
    this.rightLeg.position.x = 0.62
    this.placeholder.add(this.rightLeg)
    for (const x of [-0.28, 0.28]) {
      addPart(new THREE.SphereGeometry(0.1, 10, 8), eye, new THREE.Vector3(x, 5.4, 0.72))
    }
  }

  update(deltaTime, playerAlive) {
    this.mixer?.update(deltaTime)
    this.attackTimer -= deltaTime
    this.attackAnimationTimer -= deltaTime
    this.smashTimer -= deltaTime
    this.walkTime += deltaTime
    if (!playerAlive) {
      this.velocity.multiplyScalar(Math.exp(-8 * deltaTime))
      this.setAnimation('idle')
      return
    }

    this.targetDirection.copy(this.target.position).sub(this.root.position)
    this.targetDirection.y = 0
    const distance = this.targetDirection.length()
    if (distance > 0.01) this.targetDirection.normalize()

    if (distance > ATTACK_RANGE) {
      this.desiredVelocity.copy(this.targetDirection).multiplyScalar(CHASE_SPEED)
      this.velocity.lerp(this.desiredVelocity, 1 - Math.exp(-CHASE_ACCELERATION * deltaTime))

      this.previousPosition.copy(this.root.position)
      const predictedPosition = this.root.position.clone().addScaledVector(this.velocity, deltaTime)
      const smashed = this.officeMap.smashWalls(predictedPosition, MONSTER_RADIUS + 1.35)
      if (smashed && this.smashTimer <= 0) {
        this.smashTimer = 0.45
        this.onSmash?.(this.root.position)
      }
      this.root.position.copy(predictedPosition)
      const collided = this.officeMap.resolveMonsterMovement(
        this.root.position,
        this.previousPosition,
        MONSTER_RADIUS,
      )
      if (collided) this.velocity.multiplyScalar(0.38)
      this.root.position.y = 0
      if (this.attackAnimationTimer <= 0) this.setAnimation('run')
    } else if (this.attackAnimationTimer <= 0) {
      this.velocity.multiplyScalar(Math.exp(-10 * deltaTime))
      this.setAnimation('idle')
    }

    const targetYaw = Math.atan2(this.targetDirection.x, this.targetDirection.z)
    this.targetQuaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, targetYaw)
    this.root.quaternion.slerp(this.targetQuaternion, 1 - Math.exp(-7 * deltaTime))

    if (this.placeholder.visible) {
      const stride = Math.sin(this.walkTime * 8) * 0.42
      this.leftLeg.rotation.x = stride
      this.rightLeg.rotation.x = -stride
      this.leftArm.rotation.x = -stride * 0.75
      this.rightArm.rotation.x = stride * 0.75
    }

    if (this.activeAction && this.activeAction === this.findAction('run', 'running')) {
      this.activeAction.setEffectiveTimeScale(THREE.MathUtils.clamp(this.velocity.length() / 5.2, 0.72, 1.18))
    }

    if (distance <= ATTACK_RANGE && this.attackTimer <= 0) {
      this.attackTimer = ATTACK_COOLDOWN
      this.attackAnimationTimer = 0.55
      this.setAnimation('attack', true)
      if (this.placeholder.visible) this.rightArm.rotation.x = -2.3
    }
  }

  getNetworkState() {
    return { position: this.root.position.toArray(), rotationY: this.root.rotation.y, animation: this.animationState }
  }

  applyNetworkState(state, immediate = false) {
    if (!state) return
    this.networkPosition.fromArray(state.position)
    this.networkQuaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, state.rotationY)
    this.setAnimation(state.animation)
    if (immediate) {
      this.root.position.copy(this.networkPosition)
      this.root.quaternion.copy(this.networkQuaternion)
    }
  }

  updateRemote(deltaTime) {
    this.mixer?.update(deltaTime)
    this.root.position.lerp(this.networkPosition, 1 - Math.exp(-14 * deltaTime))
    this.root.quaternion.slerp(this.networkQuaternion, 1 - Math.exp(-14 * deltaTime))
    this.officeMap.smashWalls(this.root.position, MONSTER_RADIUS + 1.15)
  }

  updateLocalDamage(deltaTime, localPlayer) {
    this.localDamageTimer -= deltaTime
    if (!localPlayer?.spawned || !localPlayer.isAlive || this.localDamageTimer > 0) return
    if (localPlayer.root.position.distanceTo(this.root.position) > ATTACK_RANGE) return
    this.localDamageTimer = ATTACK_COOLDOWN
    this.onAttack?.(ATTACK_DAMAGE)
  }

}
