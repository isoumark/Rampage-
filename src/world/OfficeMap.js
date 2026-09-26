import * as THREE from 'three'
import { OfficeFurniture } from './OfficeFurniture.js'

const WALL_HEIGHT = 6
const WALL_THICKNESS = 0.34
const MAP_WIDTH = 96
const MAP_DEPTH = 72
const HALF_WIDTH = MAP_WIDTH / 2
const HALF_DEPTH = MAP_DEPTH / 2

export class OfficeMap {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'OfficeMap'
    this.colliders = []
    this.breakableWalls = []
    this.debris = []
    this.emergencyLights = []
    this.elapsed = 0
    this.dust = null
    this.furniture = new OfficeFurniture()
    this.wallMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d8d2, roughness: 0.86 })
    this.outerWallMaterial = new THREE.MeshStandardMaterial({ color: 0x314148, roughness: 0.74 })
    this.trimMaterial = new THREE.MeshStandardMaterial({ color: 0x202a2e, roughness: 0.62, metalness: 0.18 })
    this.floorMaterial = new THREE.MeshStandardMaterial({ color: 0x747d7f, roughness: 0.94, map: this.createGridTexture() })
    scene.add(this.group)
    this.build()
  }

  createGridTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    context.fillStyle = '#808789'
    context.fillRect(0, 0, 256, 256)
    context.strokeStyle = '#6c7476'
    context.lineWidth = 2
    context.strokeRect(1, 1, 254, 254)
    for (let i = 0; i < 1000; i += 1) {
      const shade = 110 + Math.floor(Math.random() * 25)
      context.fillStyle = `rgba(${shade},${shade + 5},${shade + 6},0.13)`
      context.fillRect(Math.random() * 256, Math.random() * 256, 1, 1)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(12, 9)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  build() {
    this.addShell()
    this.addFloorPlan()
    this.addFloorZones()
    this.addDoorsAndSigns()
    this.addWorkAreas()
    this.addConferenceRoom()
    this.addBreakRoom()
    this.addSecurityRoom()
    this.addReception()
    this.addDecor()
    this.addCeilingAndLights()
    this.addAtmosphere()
  }

  addShell() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP_WIDTH, MAP_DEPTH), this.floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.group.add(floor)
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_WIDTH, MAP_DEPTH),
      new THREE.MeshStandardMaterial({ color: 0xc5c8c5, roughness: 0.96, side: THREE.DoubleSide }),
    )
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = WALL_HEIGHT
    this.group.add(ceiling)
    this.addWall(0, -HALF_DEPTH, MAP_WIDTH, WALL_THICKNESS, false)
    this.addWall(0, HALF_DEPTH, MAP_WIDTH, WALL_THICKNESS, false)
    this.addWall(-HALF_WIDTH, 0, WALL_THICKNESS, MAP_DEPTH, false)
    this.addWall(HALF_WIDTH, 0, WALL_THICKNESS, MAP_DEPTH, false)
  }

  addFloorPlan() {
    const wingDoors = [
      { center: -25, width: 5.2 }, { center: -8, width: 5.2 },
      { center: 9, width: 5.2 }, { center: 26, width: 5.2 },
    ]
    this.addVerticalPartition(-10, -HALF_DEPTH, HALF_DEPTH, wingDoors)
    this.addVerticalPartition(10, -HALF_DEPTH, HALF_DEPTH, wingDoors)
    this.addHorizontalPartition(-16, -HALF_WIDTH, -10, [{ center: -29, width: 5.5 }])
    this.addHorizontalPartition(16, -HALF_WIDTH, -10, [{ center: -29, width: 5.5 }])
    this.addHorizontalPartition(-16, 10, HALF_WIDTH, [{ center: 29, width: 5.5 }])
    this.addHorizontalPartition(16, 10, HALF_WIDTH, [{ center: 29, width: 5.5 }])
    this.addGlassDivider(-28, 0, 11)
    this.addGlassDivider(28, 0, 11)
  }

  addVerticalPartition(x, start, end, openings) {
    let cursor = start
    for (const opening of [...openings].sort((a, b) => a.center - b.center)) {
      const edge = opening.center - opening.width / 2
      if (edge > cursor) this.addWall(x, (cursor + edge) / 2, WALL_THICKNESS, edge - cursor, true)
      cursor = opening.center + opening.width / 2
    }
    if (cursor < end) this.addWall(x, (cursor + end) / 2, WALL_THICKNESS, end - cursor, true)
  }

  addHorizontalPartition(z, start, end, openings) {
    let cursor = start
    for (const opening of [...openings].sort((a, b) => a.center - b.center)) {
      const edge = opening.center - opening.width / 2
      if (edge > cursor) this.addWall((cursor + edge) / 2, z, edge - cursor, WALL_THICKNESS, true)
      cursor = opening.center + opening.width / 2
    }
    if (cursor < end) this.addWall((cursor + end) / 2, z, end - cursor, WALL_THICKNESS, true)
  }

  addGlassDivider(x, z, width) {
    const group = new THREE.Group()
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(width, 2.8, 0.08),
      new THREE.MeshPhysicalMaterial({ color: 0x8db9c0, transparent: true, opacity: 0.22, roughness: 0.12 }),
    )
    glass.position.y = 1.75
    group.add(glass)
    for (const postX of [-width / 2, 0, width / 2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.5, 0.13), this.trimMaterial)
      post.position.set(postX, 1.75, 0)
      group.add(post)
    }
    group.position.set(x, 0, z)
    this.group.add(group)
    this.addBoxCollider(x, z, width, 0.14, group)
  }

  addFloorZones() {
    const carpet = new THREE.MeshStandardMaterial({ color: 0x283c43, roughness: 0.98 })
    const tile = new THREE.MeshStandardMaterial({ color: 0xa5aaa6, roughness: 0.76 })
    const zones = [
      [0, 25, 17, 18, tile], [-29, -25.5, 34, 17, carpet], [29, -25.5, 34, 17, carpet],
      [-29, 25.5, 34, 17, carpet], [29, 25.5, 34, 17, carpet],
    ]
    for (const [x, z, width, depth, material] of zones) {
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material)
      zone.rotation.x = -Math.PI / 2
      zone.position.set(x, 0.012, z)
      this.group.add(zone)
    }
    const route = new THREE.Mesh(
      new THREE.PlaneGeometry(0.13, 64),
      new THREE.MeshBasicMaterial({ color: 0x5ed079, transparent: true, opacity: 0.7 }),
    )
    route.rotation.x = -Math.PI / 2
    route.position.y = 0.022
    this.group.add(route)
  }

  addDoorsAndSigns() {
    for (const x of [-10, 10]) for (const z of [-25, -8, 9, 26]) this.addDoorFrame(x, z, Math.PI / 2)
    for (const x of [-29, 29]) for (const z of [-16, 16]) this.addDoorFrame(x, z, 0)
    const signs = [
      [-9.78, -25, 'MEETING', Math.PI / 2], [-9.78, 26, 'WORKSPACE', Math.PI / 2],
      [9.78, -25, 'SECURITY', -Math.PI / 2], [9.78, 26, 'BREAK ROOM', -Math.PI / 2],
      [0, 35.78, 'MAIN LOBBY', Math.PI],
    ]
    for (const [x, z, text, rotation] of signs) this.addSign(x, z, text, rotation)
  }

  addDoorFrame(x, z, rotation) {
    const frame = new THREE.Group()
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.35, 0.22), this.trimMaterial)
      jamb.position.set(side * 2.55, 1.675, 0)
      frame.add(jamb)
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(5.25, 0.18, 0.22), this.trimMaterial)
    header.position.y = 3.26
    frame.add(header)
    frame.position.set(x, 0, z)
    frame.rotation.y = rotation
    this.group.add(frame)
  }

  addSign(x, z, text, rotation) {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 72
    const context = canvas.getContext('2d')
    context.fillStyle = '#172328'
    context.fillRect(0, 0, 320, 72)
    context.fillStyle = '#73e28b'
    context.font = '700 27px Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, 160, 38)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 0.5), new THREE.MeshBasicMaterial({ map: texture }))
    sign.position.set(x, 3.9, z)
    sign.rotation.y = rotation
    this.group.add(sign)
  }

  addWorkAreas() {
    const desks = [
      [-40, 24, 0], [-34, 24, 0], [-24, 24, Math.PI], [-18, 24, Math.PI],
      [-40, 8, 0], [-34, 8, 0], [-24, 8, Math.PI], [-18, 8, Math.PI],
      [18, 8, 0], [24, 8, 0], [34, 8, Math.PI], [40, 8, Math.PI],
    ]
    for (const desk of desks) this.addDesk(...desk)
    for (const [x, z, width] of [[-29, 27, 25], [-29, 11, 25], [29, 11, 25]]) {
      const divider = new THREE.Mesh(new THREE.BoxGeometry(width, 1.15, 0.12), this.outerWallMaterial)
      divider.position.set(x, 0.575, z)
      divider.castShadow = true
      this.group.add(divider)
      this.addBoxCollider(x, z, width, 0.12, divider)
    }
  }

  addDesk(x, z, rotation = 0) {
    const desk = this.furniture.desk()
    desk.position.set(x, 0, z)
    desk.rotation.y = rotation
    this.group.add(desk)
    this.addObjectCollider(desk)
    const offset = new THREE.Vector3(0, 0, 1.15).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
    const chair = this.furniture.chair()
    chair.position.set(x + offset.x, 0, z + offset.z)
    chair.rotation.y = rotation
    this.group.add(chair)
    this.addObjectCollider(chair)
  }

  addConferenceRoom() {
    const table = this.furniture.conferenceTable()
    table.position.set(-29, 0, -25)
    this.group.add(table)
    this.addObjectCollider(table, 0.08)
    const seats = [[-3, 0, -Math.PI / 2], [3, 0, Math.PI / 2], [-1.6, -1.6, 0], [1.6, -1.6, 0], [-1.6, 1.6, Math.PI], [1.6, 1.6, Math.PI]]
    for (const [dx, dz, rotation] of seats) {
      const chair = this.furniture.chair()
      chair.position.set(-29 + dx, 0, -25 + dz)
      chair.rotation.y = rotation
      this.group.add(chair)
      this.addObjectCollider(chair)
    }
    this.addWallScreen(-29, -35.75, 4.2, 1.8)
  }

  addBreakRoom() {
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(14, 1.05, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x5b6669, roughness: 0.7 }),
    )
    counter.position.set(31, 0.525, 34.7)
    counter.castShadow = true
    this.group.add(counter)
    this.addBoxCollider(31, 34.7, 14, 1.2, counter)
    for (const x of [20, 26, 32, 38]) {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.08, 24), this.furniture.wood)
      table.position.set(x, 0.76, 23.5)
      table.castShadow = true
      this.group.add(table)
      this.addBoxCollider(x, 23.5, 2.1, 2.1, table)
    }
    this.addVendingMachine(45.5, 28, -Math.PI / 2)
  }

  addSecurityRoom() {
    for (const x of [19, 25, 31, 37, 43]) {
      const rack = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.8, 1), this.trimMaterial)
      body.position.y = 1.4
      body.castShadow = true
      rack.add(body)
      for (let row = 0; row < 7; row += 1) {
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(0.82, 0.035, 0.02),
          new THREE.MeshBasicMaterial({ color: row % 3 === 0 ? 0xff6a4d : 0x58db87 }),
        )
        light.position.set(0, 0.48 + row * 0.32, 0.511)
        rack.add(light)
      }
      rack.position.set(x, 0, -31.5)
      this.group.add(rack)
      this.addObjectCollider(rack)
    }
    this.addWallScreen(29, -16.22, 5.4, 2.1)
  }

  addReception() {
    const front = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.2, 0.48), this.outerWallMaterial)
    front.position.set(0, 0.6, 19)
    front.castShadow = true
    this.group.add(front)
    this.addBoxCollider(0, 19, 7.5, 0.48, front)
    const returnDesk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 3.1), this.furniture.wood)
    returnDesk.position.set(-2.7, 0.82, 17.7)
    returnDesk.castShadow = true
    this.group.add(returnDesk)
    this.addBoxCollider(-2.7, 17.7, 2.2, 3.1, returnDesk)
  }

  addDecor() {
    for (const [x, z] of [[-44, -32], [44, 32], [-13.5, -13], [13.5, 13], [-44, 32], [44, -11]]) this.addPlant(x, z)
    this.addVendingMachine(-46, 0, Math.PI / 2)
    const material = new THREE.MeshStandardMaterial({ color: 0x33464c, roughness: 0.9 })
    for (const [x, z] of [[-4.5, 29], [4.5, 29], [-4.5, 5], [4.5, 5]]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.48, 0.72), material)
      bench.position.set(x, 0.42, z)
      bench.castShadow = true
      this.group.add(bench)
      this.addObjectCollider(bench)
    }
  }

  addPlant(x, z) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.4, 0.72, 12),
      new THREE.MeshStandardMaterial({ color: 0x222b2d, roughness: 0.92 }),
    )
    pot.position.set(x, 0.36, z)
    this.group.add(pot)
    const leaves = new THREE.MeshStandardMaterial({ color: 0x356947, roughness: 0.9 })
    for (let i = 0; i < 7; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.45, 7), leaves)
      leaf.position.set(x + Math.sin(i * 2.4) * 0.22, 1.25, z + Math.cos(i * 2.4) * 0.22)
      leaf.rotation.z = Math.sin(i) * 0.24
      this.group.add(leaf)
    }
    this.addBoxCollider(x, z, 1, 1, pot)
  }

  addVendingMachine(x, z, rotation) {
    const machine = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.55, 0.82), this.trimMaterial)
    body.position.y = 1.275
    machine.add(body)
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.55), new THREE.MeshBasicMaterial({ color: 0x40a8ba }))
    glow.position.set(0, 1.45, 0.416)
    machine.add(glow)
    machine.position.set(x, 0, z)
    machine.rotation.y = rotation
    this.group.add(machine)
    this.addObjectCollider(machine)
  }

  addWallScreen(x, z, width, height) {
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x142328, emissive: 0x174b58, emissiveIntensity: 1.15 }),
    )
    screen.position.set(x, 3.1, z)
    this.group.add(screen)
  }

  addCeilingAndLights() {
    const rails = new THREE.MeshStandardMaterial({ color: 0x4f5b5e, roughness: 0.55, metalness: 0.42 })
    for (const x of [-32, -16, 0, 16, 32]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 68), rails)
      rail.position.set(x, WALL_HEIGHT - 0.24, 0)
      this.group.add(rail)
    }
    for (const x of [-36, -18, 0, 18, 36]) for (const z of [-27, -9, 9, 27]) this.addLight(x, z)
  }

  addLight(x, z) {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.07, 0.52), new THREE.MeshBasicMaterial({ color: 0xfff8df }))
    fixture.position.set(x, WALL_HEIGHT - 0.09, z)
    this.group.add(fixture)
    const light = new THREE.PointLight(0xfff1d3, 10.5, 14, 2)
    light.position.set(x, WALL_HEIGHT - 0.42, z)
    this.group.add(light)
  }

  addAtmosphere() {
    for (const z of [-30, 30]) {
      const beacon = new THREE.PointLight(0xff3a2d, 0, 14, 2)
      beacon.position.set(0, 5.2, z)
      this.group.add(beacon)
      this.emergencyLights.push(beacon)
    }
    const positions = new Float32Array(120 * 3)
    for (let i = 0; i < 120; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * (MAP_WIDTH - 4)
      positions[i * 3 + 1] = 0.4 + Math.random() * 5
      positions[i * 3 + 2] = (Math.random() - 0.5) * (MAP_DEPTH - 4)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xcbd2ce, size: 0.035, transparent: true, opacity: 0.2 }))
    this.group.add(this.dust)
  }

  addWall(x, z, width, depth, breakable) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, depth), breakable ? this.wallMaterial : this.outerWallMaterial)
    mesh.position.set(x, WALL_HEIGHT / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.18, depth + 0.02), this.trimMaterial)
    baseboard.position.y = -WALL_HEIGHT / 2 + 0.1
    mesh.add(baseboard)
    this.group.add(mesh)
    const wall = this.addBoxCollider(x, z, width, depth, mesh, !breakable)
    wall.breakable = breakable
    if (breakable) this.breakableWalls.push(wall)
  }

  addBoxCollider(x, z, width, depth, mesh, blocksMonster = false) {
    const collider = {
      mesh, blocksMonster, breakable: false, destroyed: false,
      box: new THREE.Box3(
        new THREE.Vector3(x - width / 2, 0, z - depth / 2),
        new THREE.Vector3(x + width / 2, WALL_HEIGHT, z + depth / 2),
      ),
    }
    this.colliders.push(collider)
    return collider
  }

  addObjectCollider(object, padding = 0.04) {
    object.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(object)
    box.min.x -= padding
    box.min.z -= padding
    box.max.x += padding
    box.max.z += padding
    const collider = { mesh: object, blocksMonster: false, breakable: false, destroyed: false, box }
    this.colliders.push(collider)
    return collider
  }

  resolvePlayerMovement(position, previousPosition, radius = 0.42) {
    return this.resolveCircleMovement(position, previousPosition, radius, true)
  }

  resolveMonsterMovement(position, previousPosition, radius = 1.05) {
    return this.resolveCircleMovement(position, previousPosition, radius, false)
  }

  resolveCircleMovement(position, previousPosition, radius, collideWithBreakable) {
    const target = position.clone()
    const displacement = target.clone().sub(previousPosition)
    const steps = Math.min(12, Math.max(1, Math.ceil(displacement.length() / Math.max(radius * 0.65, 0.18))))
    const resolved = previousPosition.clone()
    let collided = false
    for (let step = 1; step <= steps; step += 1) {
      const next = previousPosition.clone().lerp(target, step / steps)
      const tryX = resolved.clone()
      tryX.x = next.x
      if (this.isPositionBlocked(tryX, radius, collideWithBreakable)) collided = true
      else resolved.x = tryX.x
      const tryZ = resolved.clone()
      tryZ.z = next.z
      if (this.isPositionBlocked(tryZ, radius, collideWithBreakable)) collided = true
      else resolved.z = tryZ.z
    }
    position.x = resolved.x
    position.z = resolved.z
    return collided
  }

  isPositionBlocked(position, radius, collideWithBreakable) {
    for (const collider of this.colliders) {
      if (collider.destroyed || (!collideWithBreakable && !collider.blocksMonster)) continue
      const nearestX = THREE.MathUtils.clamp(position.x, collider.box.min.x, collider.box.max.x)
      const nearestZ = THREE.MathUtils.clamp(position.z, collider.box.min.z, collider.box.max.z)
      const dx = position.x - nearestX
      const dz = position.z - nearestZ
      if (dx * dx + dz * dz < radius * radius) return true
    }
    return false
  }

  smashWalls(position, radius = 2.4) {
    let smashed = false
    for (const wall of this.breakableWalls) {
      if (wall.destroyed || wall.box.distanceToPoint(position) > radius) continue
      this.destroyWall(wall, position)
      smashed = true
    }
    return smashed
  }

  destroyWall(wall, impactPoint) {
    wall.destroyed = true
    wall.mesh.visible = false
    const size = new THREE.Vector3()
    wall.box.getSize(size)
    const count = Math.min(14, Math.max(6, Math.ceil(Math.max(size.x, size.z) / 2)))
    for (let i = 0; i < count; i += 1) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, size.x / 5), 1.1, Math.max(0.2, size.z / 5)), this.wallMaterial)
      shard.position.set(wall.mesh.position.x + (Math.random() - 0.5) * size.x, 0.7 + Math.random() * 2.8, wall.mesh.position.z + (Math.random() - 0.5) * size.z)
      shard.rotation.set(Math.random(), Math.random(), Math.random())
      shard.castShadow = true
      this.group.add(shard)
      const direction = shard.position.clone().sub(impactPoint).setY(0.7 + Math.random()).normalize()
      this.debris.push({ mesh: shard, velocity: direction.multiplyScalar(4.5 + Math.random() * 6), spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(7), life: 3.5 })
    }
  }

  update(deltaTime) {
    this.elapsed += deltaTime
    const pulse = Math.max(0, Math.sin(this.elapsed * 2.8))
    for (const light of this.emergencyLights) light.intensity = pulse * 14
    if (this.dust) this.dust.rotation.y += deltaTime * 0.01
    for (let i = this.debris.length - 1; i >= 0; i -= 1) {
      const debris = this.debris[i]
      debris.life -= deltaTime
      debris.velocity.y -= 15 * deltaTime
      debris.mesh.position.addScaledVector(debris.velocity, deltaTime)
      debris.mesh.rotation.x += debris.spin.x * deltaTime
      debris.mesh.rotation.y += debris.spin.y * deltaTime
      if (debris.mesh.position.y < 0.18) {
        debris.mesh.position.y = 0.18
        debris.velocity.multiplyScalar(0.5)
        debris.velocity.y = Math.abs(debris.velocity.y) * 0.22
      }
      if (debris.life <= 0) {
        debris.mesh.removeFromParent()
        debris.mesh.geometry.dispose()
        this.debris.splice(i, 1)
      }
    }
  }

  get cameraBlockers() {
    return this.colliders.filter((collider) => !collider.destroyed).map((collider) => collider.mesh)
  }
}
