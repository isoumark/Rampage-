import * as THREE from 'three'

const clamp = THREE.MathUtils.clamp

export class ThirdPersonCamera {
  constructor({ camera, domElement, target, getBlockers }) {
    this.camera = camera
    this.domElement = domElement
    this.target = target
    this.getBlockers = getBlockers
    this.yaw = 0
    this.pitch = 0.28
    this.distance = 7
    this.lookHeight = 1.6
    this.shoulderOffset = 0.72
    this.sensitivity = 0.0025
    this.desiredPosition = new THREE.Vector3()
    this.lookTarget = new THREE.Vector3()
    this.raycaster = new THREE.Raycaster()
    this.cameraDirection = new THREE.Vector3()
    this.shakeStrength = 0
    this.movementAmount = 0
    this.elapsed = 0
    this.right = new THREE.Vector3()
    this.forward = new THREE.Vector3()

    this.onClick = () => this.domElement.requestPointerLock?.()
    this.onMouseMove = (event) => {
      if (document.pointerLockElement !== this.domElement) return
      this.yaw -= event.movementX * this.sensitivity
      this.pitch = clamp(
        this.pitch + event.movementY * this.sensitivity,
        -0.15,
        Math.PI / 2 - 0.12,
      )
    }
    this.onWheel = (event) => {
      this.distance = clamp(this.distance + event.deltaY * 0.01, 3.5, 11)
    }

    this.domElement.addEventListener('click', this.onClick)
    document.addEventListener('mousemove', this.onMouseMove)
    this.domElement.addEventListener('wheel', this.onWheel, { passive: true })

    this.update(1)
    this.camera.position.copy(this.desiredPosition)
  }

  addShake(strength) {
    this.shakeStrength = Math.max(this.shakeStrength, strength)
  }

  update(deltaTime, isSprinting = false, isMoving = false) {
    this.elapsed += deltaTime
    this.lookTarget.copy(this.target.position)
    this.lookTarget.y += this.lookHeight

    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const actionAmount = this.movementAmount * (isSprinting ? 1 : 0.35)
    this.lookTarget.addScaledVector(this.forward, 0.65 * actionAmount)
    this.lookTarget.addScaledVector(this.right, this.shoulderOffset)

    const horizontalDistance = Math.cos(this.pitch) * this.distance
    this.desiredPosition.set(
      this.lookTarget.x + Math.sin(this.yaw) * horizontalDistance,
      this.lookTarget.y + Math.sin(this.pitch) * this.distance,
      this.lookTarget.z + Math.cos(this.yaw) * horizontalDistance,
    )

    this.cameraDirection.copy(this.desiredPosition).sub(this.lookTarget)
    const desiredDistance = this.cameraDirection.length()
    this.cameraDirection.normalize()
    this.raycaster.set(this.lookTarget, this.cameraDirection)
    this.raycaster.far = desiredDistance
    const hits = this.raycaster.intersectObjects(this.getBlockers?.() ?? [], true)
    if (hits[0]) {
      this.desiredPosition.copy(this.lookTarget).addScaledVector(
        this.cameraDirection,
        Math.max(0.65, hits[0].distance - 0.25),
      )
    }

    this.movementAmount = THREE.MathUtils.lerp(
      this.movementAmount,
      isMoving ? (isSprinting ? 1 : 0.45) : 0,
      1 - Math.exp(-8 * deltaTime),
    )
    this.desiredPosition.y += Math.sin(this.elapsed * 11) * 0.028 * this.movementAmount
    this.desiredPosition.x += Math.cos(this.elapsed * 5.5) * 0.018 * this.movementAmount

    if (this.shakeStrength > 0.001) {
      this.desiredPosition.x += (Math.random() - 0.5) * this.shakeStrength
      this.desiredPosition.y += (Math.random() - 0.5) * this.shakeStrength
      this.shakeStrength *= Math.exp(-7 * deltaTime)
    }

    const smoothing = 1 - Math.exp(-10 * deltaTime)
    this.camera.position.lerp(this.desiredPosition, smoothing)
    this.camera.lookAt(this.lookTarget)
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      isSprinting ? 78 : 70,
      1 - Math.exp(-6 * deltaTime),
    )
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.domElement.removeEventListener('click', this.onClick)
    document.removeEventListener('mousemove', this.onMouseMove)
    this.domElement.removeEventListener('wheel', this.onWheel)
  }
}
