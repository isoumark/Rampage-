import * as THREE from 'three'
import { OfficeFurniture } from './OfficeFurniture.js'
import { OfficeDetails } from './OfficeDetails.js'

const WIDTH = 96
const DEPTH = 72
const HEIGHT = 4.5
const GRID_SIZE = 6

export class OfficeMap {
  constructor(scene, options = {}) {
    this.scene = scene
    this.options = { lighting: true, shadows: true, ...options }
    this.group = new THREE.Group()
    this.group.name = 'OfficeMap'
    this.colliders = []
    this.breakableWalls = []
    this.debris = []
    this.emergencyLights = []
    this.elapsed = 0
    this.dust = null
    this.alarmActive = false
    this._grid = new Map()
    this._cameraBlockers = []
    this._cameraDirty = true
    this._seed = 1979
    this._disposed = false
    this.furniture = new OfficeFurniture()
    const f = this.furniture
    this.wallMaterial = f.material({ color: 0xe6e3dc, roughness: 0.89 })
    this.outerWallMaterial = f.material({ color: 0xc7c9c3, roughness: 0.85 })
    this.trimMaterial = f.material({ color: 0x626a69, metalness: 0.48, roughness: 0.48 })
    this.floorMaterial = f.material({ color: 0x92988e, map: f.texture('carpet', WIDTH / 1.2, DEPTH / 1.2), roughness: 0.98 })
    this.tileMaterial = f.material({ color: 0xc9c6bb, map: f.texture('stone', 6, 36), roughness: 0.78 })
    this.glassMaterial = f.material({ color: 0xb5cacf, transparent: true, opacity: 0.16, roughness: 0.22, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false })
    this.frostMaterial = f.material({ color: 0xd8e0dc, transparent: true, opacity: 0.48, roughness: 0.94, side: THREE.DoubleSide, depthWrite: false })
    this._proxyMaterial = f.material({ visible: false })
    this._zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
    scene.add(this.group)
    this.build()
  }

  random() {
    this._seed = (this._seed * 16807) % 2147483647
    return (this._seed - 1) / 2147483646
  }

  build() {
    this.addShell()
    this.addFloorPlan()
    this.addWorkAreas()
    this.details = new OfficeDetails({
      group: this.group,
      furniture: this.furniture,
      addCollider: (object, padding) => this.addObjectCollider(object, padding),
      width: WIDTH, depth: DEPTH, height: HEIGHT,
    })
    this.details.build()
    if (this.options.lighting) this.addLighting()
    this.batchStaticGeometry()
    this.group.updateMatrixWorld(true)
  }

  addShell() {
    const f = this.furniture
    const floor = f.plane(this.group, WIDTH, DEPTH, [0, 0, 0], this.floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.name = 'CarpetFloor'
    const aisle = f.plane(this.group, 10.8, DEPTH - 0.3, [0, 0.007, 0], this.tileMaterial)
    aisle.rotation.x = -Math.PI / 2
    for (const x of [-5.42, 5.42]) {
      const seam = f.box(this.group, [0.028, 0.012, DEPTH - 0.3], [x, 0.009, 0], f.edge)
      seam.castShadow = false
    }
    const ceiling = f.box(this.group, [WIDTH, 0.1, DEPTH], [0, HEIGHT + 0.07, 0], this.wallMaterial)
    ceiling.castShadow = false
    ceiling.name = 'CeilingSlab'

    // Continuous outer collision envelopes; windows never become walk-through gaps.
    for (const side of [-1, 1]) {
      this.addWindowWall(0, side * DEPTH / 2, WIDTH, 0)
      this.addWindowWall(side * WIDTH / 2, 0, DEPTH, Math.PI / 2)
    }
    for (const x of [-44, -25, -7, 7, 25, 44]) for (const z of [-22.5, -4.5, 13.5, 30]) {
      const column = new THREE.Group(); column.name = 'StructuralColumn'
      f.box(column, [0.65, HEIGHT, 0.65], [0, HEIGHT / 2, 0], this.wallMaterial)
      f.box(column, [0.68, 0.13, 0.68], [0, 0.065, 0], this.trimMaterial)
      column.position.set(x, 0, z)
      this.group.add(column)
      // Columns block players, but the Rampage can tear through them.
      // The perimeter collision envelope remains the permanent boundary.
      this.registerCollider(column, { breakable: true })
    }
  }

  addWindowWall(x, z, width, rotation) {
    const f = this.furniture
    const wall = new THREE.Group(); wall.name = 'PerimeterWindowWall'
    f.box(wall, [width, 0.98, 0.34], [0, 0.49, 0], this.outerWallMaterial)
    f.box(wall, [width, 0.46, 0.34], [0, HEIGHT - 0.23, 0], this.wallMaterial)
    f.box(wall, [width, 0.075, 0.48], [0, 1.01, 0], f.white)
    f.box(wall, [width, 0.14, 0.36], [0, 0.07, 0], this.trimMaterial)
    const count = Math.round(width / 4)
    const pitch = width / count
    for (let i = 0; i < count; i += 1) {
      const px = -width / 2 + (i + 0.5) * pitch
      f.plane(wall, pitch - 0.075, 3.0, [px, 2.53, 0], this.glassMaterial)
      f.box(wall, [0.07, 3.02, 0.14], [px - pitch / 2, 2.53, 0], this.trimMaterial)
      const blind = f.box(wall, [pitch - 0.08, 0.14 + (i % 3) * 0.13, 0.06], [px, 3.9 - (i % 3) * 0.065, 0.1], f.white)
      blind.castShadow = false
    }
    f.box(wall, [width, 0.045, 0.12], [0, 3.08, 0], this.trimMaterial)
    wall.position.set(x, 0, z); wall.rotation.y = rotation
    this.group.add(wall)
    const horizontal = Math.abs(Math.sin(rotation)) < 0.5
    this.addBoxCollider(x, z, horizontal ? width : 0.34, horizontal ? 0.34 : width, wall, true)
  }

  addFloorPlan() {
    // Main entrance and the central route stay clear at x=0, including z=+/-30.
    this.addHorizontalPartition(-25, -47.8, -8, [{ center: -28, width: 4.2 }])
    this.addHorizontalPartition(-25, 8, 47.8, [{ center: 28, width: 4.2 }])
    this.addHorizontalPartition(25, 12, 47.8, [{ center: 28, width: 4.2 }])
    this.addGlassDivider(-8, -30.5, 10.8, Math.PI / 2)
    this.addGlassDivider(8, -30.5, 10.8, Math.PI / 2)
    this.addGlassDivider(12, 30.5, 10.8, Math.PI / 2)
    for (const z of [-24.1, 24.1]) {
      const strip = this.furniture.plane(this.group, 95, 0.045, [0, 0.011, z], this.trimMaterial)
      strip.rotation.x = -Math.PI / 2
    }
  }

  addHorizontalPartition(z, start, end, openings) {
    let cursor = start
    for (const opening of [...openings].sort((a, b) => a.center - b.center)) {
      const edge = opening.center - opening.width / 2
      if (edge > cursor) this.addGlassDivider((cursor + edge) / 2, z, edge - cursor)
      cursor = opening.center + opening.width / 2
    }
    if (cursor < end) this.addGlassDivider((cursor + end) / 2, z, end - cursor)
  }

  addGlassDivider(x, z, width, rotation = 0) {
    const f = this.furniture
    const wall = new THREE.Group(); wall.name = 'GlazedPartition'
    const pieces = Math.ceil(width / 2.5)
    const pitch = width / pieces
    for (let i = 0; i < pieces; i += 1) {
      const px = -width / 2 + (i + 0.5) * pitch
      f.plane(wall, pitch - 0.035, 3.25, [px, 1.765, 0], this.glassMaterial)
      f.plane(wall, pitch - 0.035, 0.24, [px, 1.32, 0.005], this.frostMaterial)
      f.box(wall, [0.032, 3.42, 0.07], [px - pitch / 2, 1.71, 0], this.trimMaterial)
    }
    f.box(wall, [width, 0.08, 0.085], [0, 0.075, 0], this.trimMaterial)
    f.box(wall, [width, 0.08, 0.085], [0, 3.44, 0], this.trimMaterial)
    wall.position.set(x, 0, z); wall.rotation.y = rotation
    this.group.add(wall)
    this.registerCollider(wall, { breakable: true })
  }

  addWorkAreas() {
    let deskIndex = 0
    for (const x of [-34, -16, 16, 34]) for (const z of [-18, -9, 0, 9, 18]) {
      for (let station = 0; station < 4; station += 1) {
        const px = x - 4.5 + station * 3
        const spine = this.furniture.cubiclePanel(3)
        spine.position.set(px, 0, z); this.group.add(spine)
        this.registerCollider(spine, { breakable: true })
        for (const side of [-1, 1]) {
          this.addDesk(px, z + side * 0.66, side > 0 ? 0 : Math.PI, deskIndex++)
        }
      }
      for (let divider = 0; divider <= 4; divider += 1) {
        const side = this.furniture.cubiclePanel(5.8)
        side.position.set(x - 6 + divider * 3, 0, z)
        side.rotation.y = Math.PI / 2
        this.group.add(side)
        this.registerCollider(side, { breakable: true })
      }
    }
    this.workstationCount = deskIndex
  }

  addDesk(x, z, rotation = 0, variant = 0) {
    const desk = this.furniture.desk(variant)
    desk.position.set(x, 0, z); desk.rotation.y = rotation
    this.group.add(desk); this.addObjectCollider(desk)
    const offset = new THREE.Vector3(0, 0, 1.15).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotation)
    const chair = this.furniture.chair()
    chair.position.set(x + offset.x, 0, z + offset.z)
    chair.rotation.y = rotation + ((variant % 5) - 2) * 0.06
    this.group.add(chair); this.addObjectCollider(chair)
  }

  addWall(x, z, width, depth, breakable = true) {
    const wall = new THREE.Group()
    this.furniture.box(wall, [width, HEIGHT, depth], [0, HEIGHT / 2, 0], this.wallMaterial)
    this.furniture.box(wall, [width + 0.02, 0.12, depth + 0.02], [0, 0.06, 0], this.trimMaterial)
    wall.position.set(x, 0, z); this.group.add(wall)
    return this.registerCollider(wall, { breakable, blocksMonster: !breakable })
  }

  addLighting() {
    // One shadow map; the repeated ceiling fixtures are emissive geometry.
    const hemi = new THREE.HemisphereLight(0xe6eff8, 0xb5b8b5, 1.15)
    this.group.add(hemi)
    const fill = new THREE.AmbientLight(0xf4f3eb, 0.55)
    this.group.add(fill)
    const sun = new THREE.DirectionalLight(0xfff2db, 1.7)
    sun.position.set(-38, 25, -27)
    sun.target.position.set(6, 0, 4)
    sun.castShadow = this.options.shadows
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -62; sun.shadow.camera.right = 62
    sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 140
    sun.shadow.normalBias = 0.025; sun.shadow.bias = -0.00015
    this.group.add(sun, sun.target)
    for (const x of [-32, 0, 32]) for (const z of [-22, 0, 22]) {
      const light = new THREE.SpotLight(0xfff7e8, 46, 34, Math.PI * 0.42, 1, 2)
      light.position.set(x, 4.13, z)
      light.target.position.set(x, 0, z)
      this.group.add(light, light.target)
    }
    for (const z of [-29, 29]) {
      const beacon = new THREE.PointLight(0xff3427, 0, 15, 2)
      beacon.position.set(0, 3.7, z)
      this.group.add(beacon); this.emergencyLights.push(beacon)
    }
  }

  setAlarm(active) { this.alarmActive = Boolean(active) }

  objectBounds(object, padding = 0) {
    object.updateWorldMatrix(true, true)
    const box = new THREE.Box3()
    object.traverse((child) => {
      if (!child.isMesh || child.userData.nonPhysical) return
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
      box.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld))
    })
    box.min.x -= padding; box.max.x += padding
    box.min.z -= padding; box.max.z += padding
    return box
  }

  registerCollider(object, { breakable = false, blocksMonster = false, padding = 0.015, box } = {}) {
    const bounds = box || this.objectBounds(object, padding)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const proxy = this.furniture.box(this.group, [Math.max(size.x, 0.01), Math.max(size.y, 0.01), Math.max(size.z, 0.01)], center.toArray(), this._proxyMaterial)
    proxy.name = 'CollisionProxy'
    proxy.castShadow = false; proxy.receiveShadow = false
    proxy.userData.noBatch = true
    const collider = { mesh: proxy, box: bounds, blocksMonster, breakable, destroyed: false, instances: [], visuals: [] }
    object.traverse((child) => { if (child.isMesh) child.userData.colliderOwner = collider })
    this.colliders.push(collider)
    if (breakable) this.breakableWalls.push(collider)
    this._cameraDirty = true
    for (let gx = Math.floor(bounds.min.x / GRID_SIZE); gx <= Math.floor(bounds.max.x / GRID_SIZE); gx += 1) {
      for (let gz = Math.floor(bounds.min.z / GRID_SIZE); gz <= Math.floor(bounds.max.z / GRID_SIZE); gz += 1) {
        const key = gx + ',' + gz
        if (!this._grid.has(key)) this._grid.set(key, [])
        this._grid.get(key).push(collider)
      }
    }
    return collider
  }

  addObjectCollider(object, padding = 0.015) { return this.registerCollider(object, { padding }) }

  addBoxCollider(x, z, width, depth, mesh, blocksMonster = false) {
    const box = new THREE.Box3(new THREE.Vector3(x - width / 2, 0, z - depth / 2), new THREE.Vector3(x + width / 2, HEIGHT, z + depth / 2))
    return this.registerCollider(mesh, { box, blocksMonster })
  }

  batchStaticGeometry() {
    this.group.updateMatrixWorld(true)
    const buckets = new Map()
    const inverseRoot = this.group.matrixWorld.clone().invert()
    this.group.traverse((mesh) => {
      if (!mesh.isMesh || mesh.userData.noBatch || mesh.isInstancedMesh) return
      if (mesh.material.transparent && !mesh.userData.forceBatch) {
        if (mesh.userData.colliderOwner) mesh.userData.colliderOwner.visuals.push(mesh)
        return
      }
      const key = mesh.geometry.uuid + ':' + mesh.material.uuid + ':' + mesh.castShadow + ':' + mesh.receiveShadow
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push({ mesh, matrix: new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld) })
    })
    for (const entries of buckets.values()) {
      const source = entries[0].mesh
      const batch = new THREE.InstancedMesh(source.geometry, source.material, entries.length)
      batch.name = 'OfficeInstances'
      batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      entries.forEach(({ mesh, matrix }, index) => {
        batch.setMatrixAt(index, matrix)
        const owner = mesh.userData.colliderOwner
        if (owner) owner.instances.push({ batch, index })
        mesh.removeFromParent()
      })
      batch.instanceMatrix.needsUpdate = true
      batch.computeBoundingBox(); batch.computeBoundingSphere()
      this.group.add(batch)
    }
  }

  *nearbyColliders(position, radius) {
    const visited = new Set()
    for (let gx = Math.floor((position.x - radius) / GRID_SIZE); gx <= Math.floor((position.x + radius) / GRID_SIZE); gx += 1) {
      for (let gz = Math.floor((position.z - radius) / GRID_SIZE); gz <= Math.floor((position.z + radius) / GRID_SIZE); gz += 1) {
        for (const collider of this._grid.get(gx + ',' + gz) || []) {
          if (!visited.has(collider)) { visited.add(collider); yield collider }
        }
      }
    }
  }

  resolvePlayerMovement(position, previousPosition, radius = 0.42) {
    return this.resolveCircleMovement(position, previousPosition, radius, true)
  }

  resolveMonsterMovement(position, previousPosition, radius = 1.05) {
    return this.resolveCircleMovement(position, previousPosition, radius, false)
  }

  resolveCircleMovement(position, previousPosition, radius, collideWithBreakable) {
    const target = position.clone()
    const resolved = previousPosition.clone()
    const distance = Math.hypot(target.x - resolved.x, target.z - resolved.z)
    const steps = Math.max(1, Math.ceil(distance / Math.max(radius * 0.5, 0.08)))
    const trial = resolved.clone()
    let collided = false
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps
      trial.copy(resolved); trial.x = THREE.MathUtils.lerp(previousPosition.x, target.x, t)
      if (this.isPositionBlocked(trial, radius, collideWithBreakable)) collided = true
      else resolved.x = trial.x
      trial.copy(resolved); trial.z = THREE.MathUtils.lerp(previousPosition.z, target.z, t)
      if (this.isPositionBlocked(trial, radius, collideWithBreakable)) collided = true
      else resolved.z = trial.z
    }
    position.x = resolved.x; position.z = resolved.z
    return collided
  }

  isPositionBlocked(position, radius, collideWithBreakable = true) {
    // Bounds also protect callers making large movements beyond the spatial grid.
    if (Math.abs(position.x) + radius > WIDTH / 2 - 0.17 || Math.abs(position.z) + radius > DEPTH / 2 - 0.17) return true
    for (const collider of this.nearbyColliders(position, radius)) {
      if (collider.destroyed || (!collideWithBreakable && !collider.blocksMonster)) continue
      const nearestX = THREE.MathUtils.clamp(position.x, collider.box.min.x, collider.box.max.x)
      const nearestZ = THREE.MathUtils.clamp(position.z, collider.box.min.z, collider.box.max.z)
      if ((position.x - nearestX) ** 2 + (position.z - nearestZ) ** 2 < radius ** 2) return true
    }
    return false
  }

  smashWalls(position, radius = 2.4) {
    let smashed = false
    for (const obstacle of this.nearbyColliders(position, radius)) {
      // The perimeter shell survives. Interior columns, glass, cubicles,
      // furniture, props, and counters become destructible cover.
      if (obstacle.blocksMonster || obstacle.destroyed || obstacle.box.distanceToPoint(position) > radius) continue
      this.destroyWall(obstacle, position); smashed = true
    }
    return smashed
  }

  destroyWall(wall, impactPoint) {
    if (wall.destroyed) return
    wall.destroyed = true; wall.mesh.visible = false
    for (const { batch, index } of wall.instances) {
      batch.setMatrixAt(index, this._zeroMatrix)
      batch.instanceMatrix.needsUpdate = true
    }
    for (const visual of wall.visuals) visual.visible = false
    this._cameraDirty = true
    const size = wall.box.getSize(new THREE.Vector3())
    const center = wall.box.getCenter(new THREE.Vector3())
    const count = Math.min(10, Math.max(4, Math.ceil(Math.max(size.x, size.z))))
    for (let i = 0; i < count && this.debris.length < 80; i += 1) {
      const dimensions = new THREE.Vector3(Math.min(0.7, Math.max(0.08, size.x / 5)), 0.2 + this.random() * 0.32, Math.min(0.7, Math.max(0.08, size.z / 5)))
      const shard = this.furniture.box(this.group, dimensions.toArray(), [center.x + (this.random() - 0.5) * size.x, 0.5 + this.random() * Math.min(size.y, 2), center.z + (this.random() - 0.5) * size.z], this.furniture.panelFabric)
      shard.rotation.set(this.random() * 3, this.random() * 3, this.random() * 3)
      const velocity = shard.position.clone().sub(impactPoint).setY(0.7 + this.random()).normalize().multiplyScalar(2.5 + this.random() * 4)
      this.debris.push({ mesh: shard, velocity, spin: new THREE.Vector3(this.random() - 0.5, this.random() - 0.5, this.random() - 0.5).multiplyScalar(9), life: 3.5, dimensions })
    }
  }

  update(deltaTime) {
    if (this._disposed) return
    const dt = Math.min(Math.max(Number.isFinite(deltaTime) ? deltaTime : 0, 0), 0.05)
    this.elapsed += dt
    const pulse = this.alarmActive ? Math.max(0, Math.sin(this.elapsed * 3.4)) * 22 : 0
    for (const light of this.emergencyLights) light.intensity = pulse
    for (let i = this.debris.length - 1; i >= 0; i -= 1) {
      const debris = this.debris[i]
      debris.life -= dt
      debris.velocity.y -= 9.8 * dt
      debris.mesh.position.addScaledVector(debris.velocity, dt)
      debris.mesh.rotation.x += debris.spin.x * dt
      debris.mesh.rotation.y += debris.spin.y * dt
      debris.mesh.rotation.z += debris.spin.z * dt
      if (debris.mesh.position.y < 0.1) {
        debris.mesh.position.y = 0.1
        debris.velocity.y = Math.abs(debris.velocity.y) * 0.18
        debris.velocity.x *= 0.9; debris.velocity.z *= 0.9
      }
      if (debris.life < 0.6) debris.mesh.scale.copy(debris.dimensions).multiplyScalar(Math.max(0, debris.life / 0.6))
      if (debris.life <= 0) { debris.mesh.removeFromParent(); this.debris.splice(i, 1) }
    }
  }

  get cameraBlockers() {
    if (this._cameraDirty) {
      this._cameraBlockers = this.colliders.filter((c) => !c.destroyed).map((c) => c.mesh)
      this._cameraDirty = false
    }
    return this._cameraBlockers
  }

  dispose() {
    if (this._disposed) return
    this.group.traverse((object) => {
      if (object.isInstancedMesh) object.dispose()
      if (object.isLight && object.shadow) object.shadow.dispose()
    })
    this.group.removeFromParent()
    this.furniture.dispose()
    this.colliders.length = 0; this.breakableWalls.length = 0; this.debris.length = 0
    this.emergencyLights.length = 0; this._cameraBlockers.length = 0; this._grid.clear()
    this._disposed = true
  }
}
