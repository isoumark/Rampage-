import * as THREE from 'three'
import { OfficeFurniture } from './OfficeFurniture.js'
import { OfficeDetails } from './OfficeDetails.js'

const WALL_HEIGHT = 6
const WALL_THICKNESS = 0.35
const MAP_WIDTH = 100
const MAP_DEPTH = 80

export class OfficeMap {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'OfficeMap'
    this.colliders = []
    this.breakableWalls = []
    this.debris = []
    this.elapsed = 0
    this.emergencyLights = []
    this.furniture = new OfficeFurniture()
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8d5cc,
      roughness: 0.86,
      map: this.createSurfaceTexture('#d8d5cc', '#c8c6bf', 9, 7),
    })
    this.trimMaterial = new THREE.MeshStandardMaterial({ color: 0x30363b, roughness: 0.7 })
    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x879092,
      roughness: 0.92,
      map: this.createSurfaceTexture('#92999a', '#687174', 16, 12),
    })
    scene.add(this.group)
    this.build()
  }

  createSurfaceTexture(baseColor, lineColor, repeatX, repeatY) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    context.fillStyle = baseColor
    context.fillRect(0, 0, 256, 256)
    const image = context.getImageData(0, 0, 256, 256)
    for (let i = 0; i < image.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 12
      image.data[i] = THREE.MathUtils.clamp(image.data[i] + noise, 0, 255)
      image.data[i + 1] = THREE.MathUtils.clamp(image.data[i + 1] + noise, 0, 255)
      image.data[i + 2] = THREE.MathUtils.clamp(image.data[i + 2] + noise, 0, 255)
    }
    context.putImageData(image, 0, 0)
    context.strokeStyle = lineColor
    context.globalAlpha = 0.24
    context.lineWidth = 2
    for (let p = 0; p <= 256; p += 64) {
      context.beginPath()
      context.moveTo(p, 0)
      context.lineTo(p, 256)
      context.stroke()
      context.beginPath()
      context.moveTo(0, p)
      context.lineTo(256, p)
      context.stroke()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  build() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP_WIDTH, MAP_DEPTH), this.floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.group.add(floor)

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_WIDTH, MAP_DEPTH),
      new THREE.MeshStandardMaterial({ color: 0x4b5254, roughness: 0.94, side: THREE.DoubleSide }),
    )
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = WALL_HEIGHT
    ceiling.receiveShadow = true
    this.group.add(ceiling)

    this.addWall(0, -40, MAP_WIDTH, WALL_THICKNESS, false)
    this.addWall(0, 40, MAP_WIDTH, WALL_THICKNESS, false)
    this.addWall(-50, 0, WALL_THICKNESS, MAP_DEPTH, false)
    this.addWall(50, 0, WALL_THICKNESS, MAP_DEPTH, false)

    // Two office wings, a central corridor, cubicle clusters, and smashable shortcuts.
    const walls = [
      [-34, -24, 32, WALL_THICKNESS], [-34, 1, 32, WALL_THICKNESS], [-34, 25, 32, WALL_THICKNESS],
      [34, -24, 32, WALL_THICKNESS], [34, 1, 32, WALL_THICKNESS], [34, 25, 32, WALL_THICKNESS],
      [-18, -33, WALL_THICKNESS, 14], [-18, -15, WALL_THICKNESS, 14],
      [-18, 13, WALL_THICKNESS, 20], [-18, 33, WALL_THICKNESS, 14],
      [18, -33, WALL_THICKNESS, 14], [18, -15, WALL_THICKNESS, 14],
      [18, 13, WALL_THICKNESS, 20], [18, 33, WALL_THICKNESS, 14],
      [-39, -11, WALL_THICKNESS, 12], [-28, -11, WALL_THICKNESS, 12],
      [-39, 13, WALL_THICKNESS, 12], [-28, 13, WALL_THICKNESS, 12],
      [28, -11, WALL_THICKNESS, 12], [39, -11, WALL_THICKNESS, 12],
      [28, 13, WALL_THICKNESS, 12], [39, 13, WALL_THICKNESS, 12],
    ]
    walls.forEach((wall) => this.addWall(...wall, true))

    for (const x of [-44, -36, -24, 24, 36, 44]) {
      for (const z of [-33, 31]) this.addDesk(x, z)
    }
    for (const x of [-44, -34, -23]) this.addDesk(x, 11)
    for (const x of [23, 34, 44]) this.addDesk(x, -12)

    for (const x of [-38, -13, 13, 38]) {
      for (const z of [-31, -10, 11, 32]) this.addLight(x, z)
    }

    this.addReception()
    this.addConferenceRoom(-34, -11)
    this.addConferenceRoom(34, 13)
    this.addLounge()
    for (const [x, z] of [[-12, -18], [12, -18], [-12, 18], [12, 18]]) this.addPillar(x, z)
    this.addArchitecturalDetails()
    this.addEnvironmentalDetails()
    new OfficeDetails({
      group: this.group,
      addCollider: (object, padding = 0) => this.addStaticCollider(object, padding),
    }).build()
  }

  addStaticCollider(mesh, padding = 0, blocksMonster = false) {
    mesh.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(mesh).expandByScalar(padding)
    this.colliders.push({ mesh, breakable: false, destroyed: false, blocksMonster, box })
  }

  addReception() {
    const group = new THREE.Group()
    const counterMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4549, roughness: 0.62, metalness: 0.15 })
    const front = new THREE.Mesh(new THREE.BoxGeometry(10, 1.35, 0.8), counterMaterial)
    front.position.y = 0.68
    front.castShadow = true
    group.add(front)
    const returnPiece = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.35, 3.5), counterMaterial)
    returnPiece.position.set(-4.6, 0.68, 1.35)
    returnPiece.castShadow = true
    group.add(returnPiece)
    group.position.set(0, 0, 31.5)
    this.group.add(group)
    this.addStaticCollider(group)
  }

  addConferenceRoom(x, z) {
    const table = this.furniture.conferenceTable()
    table.position.set(x, 0, z)
    this.group.add(table)
    for (const offsetX of [-1.6, 0, 1.6]) {
      for (const side of [-1, 1]) {
        const chair = this.furniture.chair()
        chair.position.set(x + offsetX, 0, z + side * 1.22)
        chair.rotation.y = side < 0 ? Math.PI : 0
        this.group.add(chair)
        this.addStaticCollider(chair)
      }
    }
    this.addStaticCollider(table, 0.08)
  }

  addLounge() {
    const sofaMaterial = new THREE.MeshStandardMaterial({ color: 0x33464d, roughness: 0.88 })
    for (const [x, z, rotation] of [[-9, -30, 0], [9, -30, 0], [0, -35, Math.PI / 2]]) {
      const sofa = new THREE.Group()
      const seat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 1.5), sofaMaterial)
      seat.position.y = 0.55
      seat.castShadow = true
      sofa.add(seat)
      const back = new THREE.Mesh(new THREE.BoxGeometry(5, 1.25, 0.45), sofaMaterial)
      back.position.set(0, 1.15, -0.6)
      back.castShadow = true
      sofa.add(back)
      sofa.position.set(x, 0, z)
      sofa.rotation.y = rotation
      this.group.add(sofa)
      this.addStaticCollider(sofa)
    }
  }

  addPillar(x, z) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, WALL_HEIGHT, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x677174, roughness: 0.82 }),
    )
    pillar.position.set(x, WALL_HEIGHT / 2, z)
    pillar.castShadow = true
    pillar.receiveShadow = true
    this.group.add(pillar)
    this.addStaticCollider(pillar)
  }

  addArchitecturalDetails() {
    const carpetMaterial = new THREE.MeshStandardMaterial({ color: 0x283b42, roughness: 0.98 })
    const carpetZones = [
      [-34, -31, 28, 12], [-34, 13, 28, 20], [34, -31, 28, 12], [34, 13, 28, 20],
      [0, 31.5, 20, 12],
    ]
    for (const [x, z, width, depth] of carpetZones) {
      const carpet = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), carpetMaterial)
      carpet.rotation.x = -Math.PI / 2
      carpet.position.set(x, 0.012, z)
      carpet.receiveShadow = true
      this.group.add(carpet)
    }

    const stripeMaterial = new THREE.MeshStandardMaterial({
      color: 0x335f4b,
      emissive: 0x183b2a,
      emissiveIntensity: 0.45,
      roughness: 0.78,
    })
    for (const x of [-13.5, 13.5]) {
      const wayfindingStripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 72), stripeMaterial)
      wayfindingStripe.rotation.x = -Math.PI / 2
      wayfindingStripe.position.set(x, 0.018, 0)
      this.group.add(wayfindingStripe)
    }

    const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x242d31, roughness: 0.72, metalness: 0.22 })
    for (const z of [-30, -18, -6, 6, 18, 30]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 0.24, 0.32), beamMaterial)
      beam.position.set(0, WALL_HEIGHT - 0.22, z)
      beam.castShadow = true
      this.group.add(beam)
    }

    const ductMaterial = new THREE.MeshStandardMaterial({ color: 0x738083, roughness: 0.5, metalness: 0.62 })
    for (const x of [-15.5, 15.5]) {
      const duct = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 67), ductMaterial)
      duct.position.set(x, WALL_HEIGHT - 0.58, 0)
      duct.castShadow = true
      this.group.add(duct)
    }

    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1f292d, roughness: 0.58, metalness: 0.3 })
    const doorOpenings = [
      [-18, -24, Math.PI / 2], [-18, 1, Math.PI / 2], [-18, 25, Math.PI / 2],
      [18, -24, Math.PI / 2], [18, 1, Math.PI / 2], [18, 25, Math.PI / 2],
    ]
    for (const [x, z, rotation] of doorOpenings) {
      const frame = new THREE.Group()
      for (const side of [-1, 1]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.25, 0.32), frameMaterial)
        jamb.position.set(side * 1.35, 1.63, 0)
        frame.add(jamb)
      }
      const header = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.22, 0.32), frameMaterial)
      header.position.y = 3.15
      frame.add(header)
      frame.position.set(x, 0, z)
      frame.rotation.y = rotation
      this.group.add(frame)
    }

    const signFaces = [
      [-17.72, -24, 'MEETING'], [-17.72, 1, 'OPERATIONS'], [-17.72, 25, 'OFFICES'],
      [17.72, -24, 'LOUNGE'], [17.72, 1, 'SECURITY'], [17.72, 25, 'ARCHIVES'],
    ]
    for (const [x, z, label] of signFaces) {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const context = canvas.getContext('2d')
      context.fillStyle = '#172126'
      context.fillRect(0, 0, 256, 64)
      context.fillStyle = '#78ee8a'
      context.font = '700 27px monospace'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(label, 128, 33)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.85, 0.46),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
      )
      sign.position.set(x, 3.8, z)
      sign.rotation.y = Math.PI / 2
      this.group.add(sign)
    }

    const directoryCanvas = document.createElement('canvas')
    directoryCanvas.width = 320
    directoryCanvas.height = 480
    const directoryContext = directoryCanvas.getContext('2d')
    directoryContext.fillStyle = '#142026'
    directoryContext.fillRect(0, 0, 320, 480)
    directoryContext.fillStyle = '#71e48b'
    directoryContext.font = '700 25px Arial'
    directoryContext.fillText('LEVEL 01', 24, 48)
    directoryContext.fillStyle = '#b8cac2'
    directoryContext.font = '17px Arial'
    directoryContext.fillText('YOU ARE HERE', 24, 82)
    directoryContext.strokeStyle = '#55726a'
    directoryContext.lineWidth = 6
    directoryContext.strokeRect(28, 110, 264, 210)
    directoryContext.strokeRect(68, 150, 72, 120)
    directoryContext.strokeRect(180, 150, 72, 120)
    directoryContext.fillStyle = '#71e48b'
    directoryContext.beginPath()
    directoryContext.arc(160, 285, 9, 0, Math.PI * 2)
    directoryContext.fill()
    directoryContext.fillStyle = '#8da59b'
    directoryContext.font = '15px Arial'
    directoryContext.fillText('LOBBY  •  SECURITY', 24, 370)
    directoryContext.fillText('OFFICES  •  MEETING', 24, 400)
    directoryContext.fillText('EXIT  →', 24, 430)
    const directoryTexture = new THREE.CanvasTexture(directoryCanvas)
    directoryTexture.colorSpace = THREE.SRGBColorSpace
    const directoryMaterial = new THREE.MeshStandardMaterial({ color: 0x172126, roughness: 0.42, metalness: 0.48 })
    const directoryScreen = new THREE.MeshBasicMaterial({ map: directoryTexture, toneMapped: false })
    for (const x of [-12.5]) {
      const kiosk = new THREE.Group()
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.48, 2.15, 0.18), directoryMaterial)
      housing.position.y = 1.72
      housing.castShadow = true
      kiosk.add(housing)
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 1.92), directoryScreen)
      screen.position.set(0, 1.72, 0.096)
      kiosk.add(screen)
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.18), directoryMaterial)
      post.position.y = 0.52
      kiosk.add(post)
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.14, 0.72), this.trimMaterial)
      base.position.y = 0.07
      kiosk.add(base)
      kiosk.position.set(x, 0, 21.5)
      this.group.add(kiosk)
      this.addStaticCollider(kiosk, 0.05)
    }
  }

  addEnvironmentalDetails() {
    const signMaterial = new THREE.MeshBasicMaterial({ color: 0x4cff72 })
    for (const [x, z, rotation] of [[-9.7, -16, Math.PI / 2], [9.7, 15, -Math.PI / 2]]) {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 0.08), signMaterial)
      sign.position.set(x, 3.35, z)
      sign.rotation.y = rotation
      this.group.add(sign)
    }

    const planterMaterial = new THREE.MeshStandardMaterial({ color: 0x252a2b, roughness: 0.9 })
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x315d3b, roughness: 0.95 })
    for (const [x, z] of [[-46, -36], [46, -36], [-46, 36], [46, 36], [-14, 0], [14, 0]]) {
      const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.48, 0.8, 8), planterMaterial)
      planter.position.set(x, 0.4, z)
      planter.castShadow = true
      this.group.add(planter)
      for (let i = 0; i < 5; i += 1) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.45, 7), leafMaterial)
        leaf.position.set(x + (i - 2) * 0.13, 1.3, z + Math.sin(i) * 0.16)
        leaf.rotation.z = (i - 2) * 0.13
        leaf.castShadow = true
        this.group.add(leaf)
      }
    }

    const vendingBody = new THREE.MeshStandardMaterial({ color: 0x172126, metalness: 0.25, roughness: 0.48 })
    const vendingGlow = new THREE.MeshStandardMaterial({
      color: 0x1c4b57,
      emissive: 0x1b7185,
      emissiveIntensity: 1.8,
      roughness: 0.32,
    })
    for (const [x, z, rotation] of [[-47.8, -18, Math.PI / 2], [47.8, 18, -Math.PI / 2]]) {
      const machine = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.5, 0.75), vendingBody)
      body.position.y = 1.25
      body.castShadow = true
      machine.add(body)
      const display = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.18, 0.03), vendingGlow)
      display.position.set(0, 1.52, 0.39)
      machine.add(display)
      machine.position.set(x, 0, z)
      machine.rotation.y = rotation
      this.group.add(machine)
      this.addStaticCollider(machine)
    }

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8ec7d4,
      transparent: true,
      opacity: 0.22,
      roughness: 0.12,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })
    for (const [x, z] of [[-34, -23.76], [34, 24.76]]) {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 0.08), glassMaterial)
      glass.position.set(x, 2.2, z)
      this.group.add(glass)
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(glass.geometry),
        new THREE.LineBasicMaterial({ color: 0x27383e, transparent: true, opacity: 0.8 }),
      )
      glass.add(frame)
    }

    const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x545d5f, roughness: 0.88 })
    for (const [x, z, scale] of [[-45, 17, 1], [45, -8, 0.8], [-43, -18, 0.7], [43, 30, 0.9]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), crateMaterial)
      crate.position.set(x, 0.6 * scale, z)
      crate.scale.setScalar(scale)
      crate.rotation.y = Math.random() * Math.PI
      crate.castShadow = true
      crate.receiveShadow = true
      this.group.add(crate)
      this.addStaticCollider(crate)
    }

    for (const z of [-29, 29]) {
      const beacon = new THREE.PointLight(0xff2c22, 0, 13, 2)
      beacon.position.set(0, 4.8, z)
      this.group.add(beacon)
      this.emergencyLights.push(beacon)
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.35, 10),
        new THREE.MeshBasicMaterial({ color: 0xff392d }),
      )
      housing.position.copy(beacon.position)
      this.group.add(housing)
    }

    const particleCount = 180
    const positions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 96
      positions[i * 3 + 1] = 0.3 + Math.random() * 5.2
      positions[i * 3 + 2] = (Math.random() - 0.5) * 76
    }
    const dustGeometry = new THREE.BufferGeometry()
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({ color: 0xbfc9c4, size: 0.035, transparent: true, opacity: 0.28 }),
    )
    this.group.add(this.dust)
  }

  addWall(x, z, width, depth, breakable) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, depth), this.wallMaterial)
    mesh.position.set(x, WALL_HEIGHT / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    const baseboard = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.03, 0.2, depth + 0.03),
      this.trimMaterial,
    )
    baseboard.position.y = -WALL_HEIGHT / 2 + 0.12
    mesh.add(baseboard)
    this.group.add(mesh)

    const wall = {
      mesh,
      breakable,
      blocksMonster: !breakable,
      destroyed: false,
      box: new THREE.Box3().setFromObject(mesh),
    }
    this.colliders.push(wall)
    if (breakable) this.breakableWalls.push(wall)
  }

  addDesk(x, z) {
    const desk = this.furniture.desk()
    desk.position.set(x, 0, z)
    this.group.add(desk)
    this.addStaticCollider(desk)
    const chair = this.furniture.chair()
    chair.position.set(x, 0, z + 0.92)
    this.group.add(chair)
    this.addStaticCollider(chair)
  }

  addLight(x, z) {
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.08, 0.55),
      new THREE.MeshBasicMaterial({ color: 0xfff7dc }),
    )
    fixture.position.set(x, WALL_HEIGHT - 0.08, z)
    this.group.add(fixture)
    const light = new THREE.PointLight(0xfff3d0, 17, 15, 2)
    light.position.set(x, WALL_HEIGHT - 0.35, z)
    this.group.add(light)
  }

  resolvePlayerMovement(position, previousPosition, radius = 0.42) {
    return this.resolveCircleMovement(position, previousPosition, radius, true)
  }

  resolveMonsterMovement(position, previousPosition, radius = 1.05) {
    return this.resolveCircleMovement(position, previousPosition, radius, false)
  }

  resolveCircleMovement(position, previousPosition, radius, collideWithBreakable) {
    let collided = false
    for (const collider of this.colliders) {
      if (collider.destroyed) continue
      if (!collideWithBreakable && !collider.blocksMonster) continue
      const box = collider.box
      const nearestX = THREE.MathUtils.clamp(position.x, box.min.x, box.max.x)
      const nearestZ = THREE.MathUtils.clamp(position.z, box.min.z, box.max.z)
      const dx = position.x - nearestX
      const dz = position.z - nearestZ
      if (dx * dx + dz * dz < radius * radius) {
        collided = true
        const tryX = new THREE.Vector3(previousPosition.x, position.y, position.z)
        const xNearest = THREE.MathUtils.clamp(tryX.x, box.min.x, box.max.x)
        const xZNearest = THREE.MathUtils.clamp(tryX.z, box.min.z, box.max.z)
        if ((tryX.x - xNearest) ** 2 + (tryX.z - xZNearest) ** 2 >= radius * radius) {
          position.x = previousPosition.x
          continue
        }
        const tryZ = new THREE.Vector3(position.x, position.y, previousPosition.z)
        const zXNearest = THREE.MathUtils.clamp(tryZ.x, box.min.x, box.max.x)
        const zNearest = THREE.MathUtils.clamp(tryZ.z, box.min.z, box.max.z)
        if ((tryZ.x - zXNearest) ** 2 + (tryZ.z - zNearest) ** 2 >= radius * radius) {
          position.z = previousPosition.z
          continue
        }
        position.copy(previousPosition)
      }
    }
    return collided
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
    const shardCount = 12
    for (let i = 0; i < shardCount; i += 1) {
      const shard = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.max(0.22, size.x / 4),
          WALL_HEIGHT / 4,
          Math.max(0.22, size.z / 4),
        ),
        this.wallMaterial,
      )
      shard.position.set(
        wall.mesh.position.x + (Math.random() - 0.5) * size.x,
        0.5 + Math.random() * 3,
        wall.mesh.position.z + (Math.random() - 0.5) * size.z,
      )
      shard.rotation.set(Math.random(), Math.random(), Math.random())
      shard.castShadow = true
      this.group.add(shard)
      const direction = shard.position.clone().sub(impactPoint).setY(0.8 + Math.random()).normalize()
      this.debris.push({
        mesh: shard,
        velocity: direction.multiplyScalar(5 + Math.random() * 7),
        spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(8),
        life: 4,
      })
    }
  }

  update(deltaTime) {
    this.elapsed += deltaTime
    const pulse = Math.max(0, Math.sin(this.elapsed * 2.8))
    for (const light of this.emergencyLights) light.intensity = pulse * 18
    if (this.dust) this.dust.rotation.y += deltaTime * 0.012
    for (let i = this.debris.length - 1; i >= 0; i -= 1) {
      const debris = this.debris[i]
      debris.life -= deltaTime
      debris.velocity.y -= 15 * deltaTime
      debris.mesh.position.addScaledVector(debris.velocity, deltaTime)
      debris.mesh.rotation.x += debris.spin.x * deltaTime
      debris.mesh.rotation.y += debris.spin.y * deltaTime
      if (debris.mesh.position.y < 0.18) {
        debris.mesh.position.y = 0.18
        debris.velocity.multiplyScalar(0.55)
        debris.velocity.y = Math.abs(debris.velocity.y) * 0.25
      }
      if (debris.life <= 0) {
        debris.mesh.removeFromParent()
        debris.mesh.geometry.dispose()
        this.debris.splice(i, 1)
      }
    }
  }

  get cameraBlockers() {
    return this.colliders.filter((wall) => !wall.destroyed).map((wall) => wall.mesh)
  }
}
