import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export class OfficeDetails {
  constructor({ group, addCollider }) {
    this.group = group
    this.addCollider = addCollider
    this.darkMetal = new THREE.MeshStandardMaterial({ color: 0x20282d, metalness: 0.58, roughness: 0.43 })
    this.brushedMetal = new THREE.MeshStandardMaterial({ color: 0x718085, metalness: 0.72, roughness: 0.32 })
    this.walnut = new THREE.MeshStandardMaterial({ color: 0x76513a, roughness: 0.68 })
    this.upholstery = new THREE.MeshStandardMaterial({ color: 0x263d47, roughness: 0.94 })
    this.accent = new THREE.MeshStandardMaterial({ color: 0x32624b, roughness: 0.72 })
    this.rackPanel = new THREE.MeshStandardMaterial({ color: 0x2e3a40, metalness: 0.55, roughness: 0.38 })
    this.archiveBoxLight = new THREE.MeshStandardMaterial({ color: 0x83735d, roughness: 0.9 })
    this.archiveBoxDark = new THREE.MeshStandardMaterial({ color: 0x646d68, roughness: 0.9 })
    this.glass = new THREE.MeshPhysicalMaterial({
      color: 0x8ebbc3,
      transparent: true,
      opacity: 0.25,
      roughness: 0.16,
      metalness: 0.08,
      side: THREE.DoubleSide,
    })
  }

  box(parent, size, position, material, rounded = false) {
    const geometry = rounded
      ? new RoundedBoxGeometry(...size, 2, Math.min(...size) * 0.14)
      : new THREE.BoxGeometry(...size)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  labelMaterial(title, subtitle = '') {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 192
    const context = canvas.getContext('2d')
    context.fillStyle = '#111a1e'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#72e58b'
    context.fillRect(0, 0, 12, canvas.height)
    context.fillStyle = '#e8f1ed'
    context.font = '700 48px Arial'
    context.fillText(title, 42, 82)
    context.fillStyle = '#83a096'
    context.font = '500 24px Arial'
    context.fillText(subtitle, 44, 128)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  }

  build() {
    this.addCeilingSystem()
    this.addWallFinishes()
    this.addLobbyClusters()
    this.addRoomProps()
    this.addSafetyDetails()
    this.addFinishingTouches()
  }

  addCeilingSystem() {
    const tileMaterial = new THREE.MeshStandardMaterial({ color: 0xb8b9b2, roughness: 0.92 })
    const tileDark = new THREE.MeshStandardMaterial({ color: 0x939b9c, roughness: 0.86 })
    for (const x of [-12, -6, 0, 6, 12]) {
      for (let z = -34; z <= 34; z += 8.5) {
        const tile = this.box(this.group, [5.55, 0.1, 7.65], [x, 5.72, z], (Math.abs(z) / 8.5) % 2 ? tileDark : tileMaterial)
        tile.castShadow = false
      }
    }
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x485257, metalness: 0.55, roughness: 0.45 })
    for (const x of [-15, -9, -3, 3, 9, 15]) this.box(this.group, [0.045, 0.06, 75], [x, 5.64, 0], railMaterial)
    for (let z = -38; z <= 38; z += 8.5) this.box(this.group, [30, 0.06, 0.045], [0, 5.64, z], railMaterial)
  }

  addWallFinishes() {
    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x48565a, roughness: 0.74 })
    const wallSections = [-33, -15, 13, 33]
    for (const side of [-1, 1]) {
      for (const z of wallSections) {
        const panel = this.box(this.group, [0.12, 2.5, z === 13 ? 12 : 8], [side * 17.78, 2.25, z], panelMaterial)
        for (let offset = -3.5; offset <= 3.5; offset += 0.7) {
          this.box(panel, [0.055, 2.18, 0.12], [side * 0.09, 0, offset], this.walnut)
        }
      }
    }

    const logoMaterial = this.labelMaterial('NORTHPOINT', 'OPERATIONS CAMPUS  •  LEVEL 01')
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), logoMaterial)
    logo.position.set(0, 3.15, -39.79)
    this.group.add(logo)

    for (const [x, z, title, subtitle, rotation] of [
      [-17.58, -3.5, 'WEST WING', 'MEETING • ADMIN', Math.PI / 2],
      [17.58, -3.5, 'EAST WING', 'SECURITY • ARCHIVES', -Math.PI / 2],
      [-17.58, 27.5, 'EXIT B', 'STAIRS • STREET', Math.PI / 2],
      [17.58, 27.5, 'EXIT C', 'LOBBY • STREET', -Math.PI / 2],
    ]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.05), this.labelMaterial(title, subtitle))
      sign.position.set(x, 3.6, z)
      sign.rotation.y = rotation
      this.group.add(sign)
    }
  }

  addSecurityCheckpoint() {
    const checkpoint = new THREE.Group()
    checkpoint.position.z = 17
    this.group.add(checkpoint)
    for (const x of [-6, -2, 2, 6]) {
      const pedestal = new THREE.Group()
      this.box(pedestal, [0.62, 1.02, 1.8], [x, 0.51, 0], this.darkMetal, true)
      this.box(pedestal, [0.46, 0.025, 0.82], [x, 1.035, -0.15], this.brushedMetal, true)
      const indicator = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), new THREE.MeshBasicMaterial({ color: 0x55ee83 }))
      indicator.rotation.x = -Math.PI / 2
      indicator.position.set(x, 1.06, -0.55)
      pedestal.add(indicator)
      checkpoint.add(pedestal)
      this.addCollider(pedestal, 0.04)
    }
    for (const x of [-4, 0, 4]) {
      const gatePivot = new THREE.Group()
      gatePivot.position.set(x - 0.78, 0, 0.15)
      gatePivot.rotation.y = -0.82
      const gate = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.78, 0.055), this.glass)
      gate.position.set(0.72, 0.82, 0)
      gatePivot.add(gate)
      checkpoint.add(gatePivot)
    }
    const overhead = new THREE.Group()
    this.box(overhead, [13.8, 0.46, 0.24], [0, 4.65, 17], this.darkMetal, true)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.78), this.labelMaterial('SECURITY', 'AUTHORIZED ACCESS'))
    face.position.set(0, 4.65, 17.13)
    overhead.add(face)
    this.group.add(overhead)
  }

  addLobbyClusters() {
    for (const side of [-1, 1]) {
      const lounge = new THREE.Group()
      lounge.position.set(side * 9.5, 0, 7)
      this.group.add(lounge)
      const rug = new THREE.Mesh(
        new THREE.PlaneGeometry(5.3, 5.4),
        new THREE.MeshStandardMaterial({ color: 0x596368, roughness: 1 }),
      )
      rug.rotation.x = -Math.PI / 2
      rug.position.y = 0.025
      lounge.add(rug)
      const sofa = new THREE.Group()
      this.box(sofa, [3.8, 0.46, 1.0], [0, 0.39, 0], this.upholstery, true)
      this.box(sofa, [3.8, 0.72, 0.24], [0, 0.8, 0.39], this.upholstery, true)
      for (const x of [-1.55, 1.55]) {
        this.box(sofa, [0.18, 0.48, 0.92], [x, 0.53, 0], this.upholstery, true)
      }
      sofa.position.z = 1.45
      lounge.add(sofa)
      this.addCollider(sofa)
      const table = new THREE.Group()
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.1, 32), this.walnut)
      top.position.y = 0.43
      top.castShadow = true
      table.add(top)
      this.box(table, [0.16, 0.4, 0.16], [0, 0.2, 0], this.darkMetal)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.07, 24), this.darkMetal)
      base.position.y = 0.035
      table.add(base)
      table.position.z = -0.65
      lounge.add(table)
      this.addCollider(table)
    }
  }

  addRoomProps() {
    this.addKitchenette(-39, 18)
    this.addServerRacks(37, -19)
    this.addArchiveShelves(39, 31)
    this.addCopyStation(-43, -19)
  }

  addKitchenette(x, z) {
    const kitchen = new THREE.Group()
    kitchen.position.set(x, 0, z)
    const cabinet = new THREE.MeshStandardMaterial({ color: 0xced0ca, roughness: 0.7 })
    const counter = new THREE.MeshStandardMaterial({ color: 0x353d40, roughness: 0.45 })
    for (let i = -2; i <= 2; i += 1) {
      this.box(kitchen, [1.35, 0.92, 0.58], [i * 1.37, 0.46, 0], cabinet, true)
      this.box(kitchen, [1.18, 0.62, 0.46], [i * 1.37, 2.05, 0.05], cabinet, true)
      const handle = this.box(kitchen, [0.34, 0.025, 0.03], [i * 1.37, 0.62, -0.305], this.brushedMetal, true)
      handle.castShadow = false
    }
    this.box(kitchen, [7.25, 0.12, 0.76], [0, 0.98, -0.05], counter, true)
    const sink = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.035, 0.48), this.brushedMetal)
    sink.position.set(1.3, 1.05, -0.08)
    kitchen.add(sink)
    const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 8, 16, Math.PI), this.brushedMetal)
    faucet.position.set(1.3, 1.27, 0.08)
    faucet.rotation.x = Math.PI / 2
    kitchen.add(faucet)
    this.group.add(kitchen)
    this.addCollider(kitchen)
  }

  addServerRacks(x, z) {
    const leds = [0x55e57c, 0x5bb9ff, 0xffc35b]
    for (let i = -2; i <= 2; i += 1) {
      const rack = new THREE.Group()
      rack.position.set(x + i * 2.1, 0, z)
      this.box(rack, [1.65, 3.9, 1.1], [0, 1.95, 0], this.darkMetal, true)
      for (let row = 0; row < 7; row += 1) {
        this.box(rack, [1.3, 0.32, 0.035], [0, 0.52 + row * 0.47, -0.566], this.rackPanel)
        for (let led = 0; led < 3; led += 1) {
          const dot = new THREE.Mesh(new THREE.CircleGeometry(0.025, 8), new THREE.MeshBasicMaterial({ color: leds[(row + led) % leds.length] }))
          dot.position.set(-0.48 + led * 0.11, 0.52 + row * 0.47, -0.587)
          rack.add(dot)
        }
      }
      this.group.add(rack)
      this.addCollider(rack)
    }
  }

  addArchiveShelves(x, z) {
    for (const row of [-2.4, 0, 2.4]) {
      const shelf = new THREE.Group()
      shelf.position.set(x, 0, z + row)
      for (const side of [-1, 1]) this.box(shelf, [0.1, 3.4, 0.85], [side * 2.6, 1.7, 0], this.darkMetal)
      for (let y = 0.35; y <= 3.1; y += 0.68) {
        this.box(shelf, [5.25, 0.07, 0.88], [0, y, 0], this.darkMetal)
        for (let boxIndex = -4; boxIndex <= 4; boxIndex += 1) {
          this.box(
            shelf,
            [0.48, 0.48, 0.66],
            [boxIndex * 0.55, y + 0.28, 0],
            boxIndex % 2 ? this.archiveBoxLight : this.archiveBoxDark,
          )
        }
      }
      this.group.add(shelf)
      this.addCollider(shelf)
    }
  }

  addCopyStation(x, z) {
    const station = new THREE.Group()
    station.position.set(x, 0, z)
    this.box(station, [2.2, 1.1, 1.05], [0, 0.55, 0], new THREE.MeshStandardMaterial({ color: 0xc8cbc7, roughness: 0.62 }), true)
    this.box(station, [1.8, 0.2, 1.2], [0, 1.15, -0.05], this.darkMetal, true)
    this.box(station, [0.5, 0.04, 0.28], [0.56, 1.27, -0.32], new THREE.MeshBasicMaterial({ color: 0x5ea7a5 }), true)
    this.box(station, [1.15, 0.35, 0.08], [0, 0.48, -0.56], this.darkMetal, true)
    this.group.add(station)
    this.addCollider(station)
  }

  addSafetyDetails() {
    for (const side of [-1, 1]) {
      for (const z of [-21, 5, 29]) {
        const extinguisher = new THREE.Group()
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.62, 12), new THREE.MeshStandardMaterial({ color: 0xb82f2a, roughness: 0.5 }))
        body.position.y = 1.15
        extinguisher.add(body)
        this.box(extinguisher, [0.17, 0.11, 0.08], [0, 1.5, 0], this.darkMetal, true)
        extinguisher.position.set(side * 17.55, 0, z)
        this.group.add(extinguisher)
      }
    }
    for (const [x, z] of [[-13, -25], [13, -8], [-13, 22]]) {
      const camera = new THREE.Group()
      const body = this.box(camera, [0.42, 0.22, 0.28], [0, 0, 0], this.darkMetal, true)
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), new THREE.MeshBasicMaterial({ color: 0x7ddcff }))
      lens.position.z = 0.145
      body.add(lens)
      camera.position.set(x, 5.15, z)
      camera.rotation.x = 0.35
      this.group.add(camera)
    }
  }

  addFinishingTouches() {
    const floorCanvas = document.createElement('canvas')
    floorCanvas.width = 1024
    floorCanvas.height = 384
    const floorContext = floorCanvas.getContext('2d')
    floorContext.clearRect(0, 0, 1024, 384)
    floorContext.strokeStyle = '#446458'
    floorContext.lineWidth = 12
    floorContext.strokeRect(18, 18, 988, 348)
    floorContext.fillStyle = '#29473b'
    floorContext.fillRect(40, 40, 18, 304)
    floorContext.fillStyle = '#d5dfda'
    floorContext.font = '700 92px Arial'
    floorContext.textAlign = 'center'
    floorContext.fillText('NORTHPOINT', 535, 180)
    floorContext.fillStyle = '#779087'
    floorContext.font = '500 36px Arial'
    floorContext.fillText('SECURITY LOBBY  •  LEVEL 01', 535, 244)
    const floorTexture = new THREE.CanvasTexture(floorCanvas)
    floorTexture.colorSpace = THREE.SRGBColorSpace
    floorTexture.anisotropy = 4
    const floorLogo = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 2.85),
      new THREE.MeshBasicMaterial({ map: floorTexture, transparent: true, opacity: 0.88 }),
    )
    floorLogo.rotation.x = -Math.PI / 2
    floorLogo.position.set(0, 0.035, 24.5)
    this.group.add(floorLogo)

    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4d8, toneMapped: false })
    for (const z of [-29, -15, -1, 13, 27]) {
      const fixture = this.box(this.group, [4.8, 0.08, 0.72], [0, 5.58, z], lightMaterial, true)
      fixture.castShadow = false
      const light = new THREE.PointLight(0xffefd0, 8, 12, 2)
      light.position.set(0, 5.35, z)
      this.group.add(light)
    }

    for (const [x, z] of [[-12, -18], [12, -18], [-12, 18], [12, 18]]) {
      this.box(this.group, [1.5, 0.22, 1.5], [x, 0.11, z], this.darkMetal, true)
      this.box(this.group, [1.42, 0.2, 1.42], [x, 5.87, z], this.brushedMetal, true)
    }

    const artColors = [0x476f66, 0x71584c, 0x3d596b]
    for (const [index, x] of [-12, 12].entries()) {
      const frame = new THREE.Group()
      frame.position.set(x, 3.1, -39.77)
      this.box(frame, [4.1, 1.72, 0.09], [0, 0, 0], this.darkMetal, true)
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(3.8, 1.46),
        new THREE.MeshStandardMaterial({ color: artColors[index], emissive: artColors[index], emissiveIntensity: 0.18, roughness: 0.72 }),
      )
      art.position.z = 0.052
      frame.add(art)
      for (let stripe = -1; stripe <= 1; stripe += 1) {
        const line = this.box(frame, [0.16, 1.15 - Math.abs(stripe) * 0.2, 0.03], [stripe * 0.62, 0, 0.075], this.walnut, true)
        line.rotation.z = stripe * 0.38
      }
      this.group.add(frame)
    }
  }
}
