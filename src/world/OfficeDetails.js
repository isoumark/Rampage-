import * as THREE from 'three'
import { OfficeFurniture } from './OfficeFurniture.js'

export class OfficeDetails {
  constructor({ group, addCollider = () => {}, furniture, width = 96, depth = 72, height = 4.5 }) {
    this.group = group
    this.addCollider = addCollider
    this.furniture = furniture || new OfficeFurniture()
    this.ownsFurniture = !furniture
    this.width = width; this.depth = depth; this.height = height
  }

  box(parent, size, position, material, rounded = false) {
    return this.furniture.box(parent, size, position, material, rounded)
  }

  place(object, x, z, rotation = 0, collide = true) {
    object.position.set(x, 0, z); object.rotation.y = rotation
    this.group.add(object)
    if (collide) this.addCollider(object)
    return object
  }

  build() {
    // OfficeMap builds these details. An older main.js may also call build(); avoid duplicates.
    if (this.group.userData.officeDetailsBuilt) return
    this.group.userData.officeDetailsBuilt = true
    this.addExterior()
    this.addCeilingSystem()
    this.addLobbyClusters()
    this.addRoomProps()
    this.addFinishingTouches()
  }

  addExterior() {
    const f = this.furniture
    const canvas = document.createElement('canvas')
    canvas.width = 1024; canvas.height = 512
    const ctx = canvas.getContext('2d')
    const sky = ctx.createLinearGradient(0, 0, 0, 512)
    sky.addColorStop(0, '#bbceda'); sky.addColorStop(0.64, '#e2e5de'); sky.addColorStop(1, '#b4c0c0')
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, 512)
    let seed = 47
    const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646
    for (let layer = 0; layer < 2; layer += 1) {
      for (let x = -20; x < 1024;) {
        const w = 22 + random() * 55
        const h = 28 + random() * (layer ? 150 : 90)
        const y = 390 - h + layer * 30
        ctx.fillStyle = layer ? '#a3b1b5' : '#c0cbd0'; ctx.fillRect(x, y, w, 512 - y)
        ctx.fillStyle = layer ? '#c6d0ce' : '#d5ddda'
        for (let wx = x + 5; wx < x + w - 5; wx += 8) for (let wy = y + 8; wy < 490; wy += 11) {
          if (random() > 0.18) ctx.fillRect(wx, wy, 3, 5)
        }
        x += w + 4 + random() * 18
      }
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace; f.textures.add(texture)
    const material = f.material({ map: texture, side: THREE.DoubleSide, toneMapped: false }, true)
    for (const side of [-1, 1]) {
      const north = f.plane(this.group, 150, 36, [0, 8, side * (this.depth / 2 + 22)], material)
      north.userData.nonPhysical = true
      const east = f.plane(this.group, 140, 36, [side * (this.width / 2 + 22), 8, 0], material)
      east.rotation.y = Math.PI / 2; east.userData.nonPhysical = true
    }
  }

  addCeilingSystem() {
    const f = this.furniture
    const acoustic = f.material({ color: 0xf1f0e9, map: f.texture('ceiling'), roughness: 1 })
    const grid = f.material({ color: 0xb8bcb7, metalness: 0.25, roughness: 0.7 })
    const lightMaterial = f.material({ color: 0xfffaee, toneMapped: false }, true)
    const panels = new THREE.Group(); panels.name = 'CeilingTiles'
    this.group.add(panels)
    const pitch = 1.2
    for (let x = -this.width / 2 + pitch / 2; x < this.width / 2; x += pitch) {
      for (let z = -this.depth / 2 + pitch / 2; z < this.depth / 2; z += pitch) {
        const tile = this.box(panels, [pitch - 0.02, 0.04, pitch - 0.02], [x, this.height - 0.055, z], acoustic)
        tile.castShadow = false
      }
    }
    for (let x = -this.width / 2; x <= this.width / 2; x += pitch) {
      const bar = this.box(panels, [0.018, 0.023, this.depth], [x, this.height - 0.065, 0], grid)
      bar.castShadow = false
    }
    for (let z = -this.depth / 2; z <= this.depth / 2; z += pitch) {
      const bar = this.box(panels, [this.width, 0.023, 0.018], [0, this.height - 0.065, z], grid)
      bar.castShadow = false
    }
    for (const x of [-42, -34, -26, -18, -10, 0, 10, 18, 26, 34, 42]) {
      for (const z of [-30, -18, -6, 6, 18, 30]) {
        const frame = this.box(this.group, [1.22, 0.065, 0.62], [x, this.height - 0.115, z], f.white)
        frame.castShadow = false
        const diffuser = this.box(this.group, [1.13, 0.012, 0.53], [x, this.height - 0.154, z], lightMaterial)
        diffuser.castShadow = false
      }
    }
    for (const x of [-25, 0, 25]) for (const z of [-28, -14, 0, 14, 28]) {
      const vent = this.box(this.group, [0.65, 0.032, 0.65], [x, this.height - 0.104, z], f.white)
      vent.castShadow = false
      for (let i = -3; i <= 3; i += 1) {
        const slot = this.box(this.group, [0.51, 0.008, 0.02], [x, this.height - 0.124, z + i * 0.07], grid)
        slot.castShadow = false
      }
    }
    for (const z of [-20, 2, 22]) {
      const detector = f.cylinder(this.group, 0.1, 0.075, 0.038, [2.4, this.height - 0.13, z], f.white)
      detector.castShadow = false
    }
  }

  addLobbyClusters() {
    const f = this.furniture
    const rugMaterial = f.material({ color: 0x8f9282, map: f.texture('carpet', 7, 7), roughness: 1 })
    for (const x of [-37, -23, -10]) {
      const rug = f.plane(this.group, 8.6, 8.2, [x, 0.016, 30.3], rugMaterial)
      rug.rotation.x = -Math.PI / 2
      this.place(f.sofa(), x, 32.3)
      this.place(f.sofa(), x, 28.1, Math.PI)
      this.place(f.roundTable(0.85, 0.43), x, 30.2)
      this.place(f.plant(1.15), x + 3.4, 33.9)
    }

    const desk = new THREE.Group(); desk.name = 'ReceptionDesk'
    this.box(desk, [5.2, 1.0, 1.15], [0, 0.5, 0], f.white, true)
    this.box(desk, [5.32, 0.07, 1.24], [0, 1.035, 0], f.wood, true)
    for (let i = 0; i < 29; i += 1) {
      this.box(desk, [0.10, 0.86, 0.035], [-2.42 + i * 0.172, 0.51, 0.594], f.wood)
    }
    const terminal = new THREE.Group(); terminal.position.set(-0.7, 0.26, -0.1); terminal.rotation.y = Math.PI
    f.monitor(terminal, 0, 0); desk.add(terminal)
    this.place(desk, 7.8, 30.8)
    this.place(f.chair(), 7.0, 29.2, Math.PI)
    this.place(f.plant(1.2), 10.4, 34.2)

    const backdrop = new THREE.Group()
    this.box(backdrop, [9.2, 2.7, 0.13], [0, 2.22, 0], f.wood)
    for (let i = -13; i <= 13; i += 1) this.box(backdrop, [0.024, 2.7, 0.026], [i * 0.32, 2.22, 0.08], f.metal)
    this.place(backdrop, 6.8, 35.7, 0, false)
  }

  meetingCluster(x, z) {
    const f = this.furniture
    this.place(f.conferenceTable(), x, z)
    for (const dx of [-2.65, -0.9, 0.9, 2.65]) for (const side of [-1, 1]) {
      this.place(f.chair(), x + dx, z + side * 1.65, side > 0 ? 0 : Math.PI)
    }
    this.place(f.chair(), x - 4.25, z, -Math.PI / 2)
    this.place(f.chair(), x + 4.25, z, Math.PI / 2)
  }

  addRoomProps() {
    const f = this.furniture
    for (const x of [-37, -19]) this.meetingCluster(x, -30.5)
    for (const x of [23, 40]) this.meetingCluster(x, 30.5)
    this.addKitchenette(29, -34.8)
    for (const x of [14, 23, 32, 41]) {
      this.place(f.roundTable(0.78), x, -28.5)
      for (const side of [-1, 1]) this.place(f.chair(), x + side * 1.32, -28.5, side < 0 ? -Math.PI / 2 : Math.PI / 2)
    }
    for (const side of [-1, 1]) for (const z of [-12, 12]) this.addCopyStation(side * 44.8, z, side < 0 ? Math.PI / 2 : -Math.PI / 2)
    for (const side of [-1, 1]) this.addStorage(side * 5.5, -32)
    for (const [x, z] of [[-45, -33], [-10, -33], [45, -32], [45, 33], [14, 33]]) this.place(f.plant(1.35), x, z)
  }

  addKitchenette(x, z) {
    const f = this.furniture
    const kitchen = new THREE.Group(); kitchen.name = 'KitchenCabinets'
    const counter = f.material({ color: 0xb7b6ad, map: f.texture('stone'), roughness: 0.45 })
    for (let i = -5; i <= 5; i += 1) {
      this.box(kitchen, [1.18, 0.86, 0.63], [i * 1.2, 0.45, 0], f.white, true)
      this.box(kitchen, [1.16, 0.67, 0.035], [i * 1.2, 0.48, 0.337], f.white)
      this.box(kitchen, [0.25, 0.02, 0.032], [i * 1.2, 0.73, 0.366], f.edge, true)
      this.box(kitchen, [1.18, 0.67, 0.38], [i * 1.2, 2.08, -0.1], f.wood, true)
      this.box(kitchen, [0.24, 0.02, 0.025], [i * 1.2, 1.84, 0.104], f.edge)
    }
    this.box(kitchen, [13.35, 0.065, 0.76], [0, 0.918, 0.02], counter, true)
    this.box(kitchen, [13.25, 0.74, 0.035], [0, 1.32, -0.326], f.white)
    this.box(kitchen, [0.85, 0.013, 0.47], [1.2, 0.958, 0.08], f.edge, true)
    this.box(kitchen, [0.66, 0.008, 0.33], [1.2, 0.967, 0.08], f.metal, true)
    f.cylinder(kitchen, 0.016, 0.019, 0.23, [1.2, 1.065, -0.2], f.edge, 10)
    this.box(kitchen, [0.032, 0.026, 0.22], [1.2, 1.19, -0.09], f.edge, true)
    const coffee = this.box(kitchen, [0.42, 0.46, 0.37], [-3.7, 1.18, 0.02], f.plastic, true)
    this.box(coffee, [0.31, 0.10, 0.02], [0, 0.08, 0.19], f.edge)
    this.box(kitchen, [0.67, 0.036, 0.4], [-3.7, 0.973, 0.06], f.metal, true)
    for (const mx of [-2.8, -2.5]) f.cylinder(kitchen, 0.048, 0.041, 0.10, [mx, 1.006, 0.1], f.ceramic)
    this.place(kitchen, x, z)
    const fridge = new THREE.Group()
    this.box(fridge, [0.88, 1.88, 0.78], [0, 0.94, 0], f.edge, true)
    this.box(fridge, [0.84, 0.01, 0.015], [0, 0.69, 0.4], f.plastic)
    for (const y of [0.39, 1.19]) this.box(fridge, [0.026, 0.29, 0.035], [-0.3, y, 0.417], f.metal, true)
    this.place(fridge, x + 8.1, z)
  }

  addCopyStation(x, z, rotation = 0) {
    const f = this.furniture
    const station = new THREE.Group(); station.name = 'Copier'
    this.box(station, [1.15, 0.91, 0.81], [0, 0.465, 0], f.white, true)
    this.box(station, [1.08, 0.17, 0.86], [0, 1.01, 0], f.plastic, true)
    this.box(station, [0.72, 0.075, 0.53], [-0.13, 1.135, -0.06], f.white, true)
    for (const y of [0.23, 0.42, 0.63]) {
      this.box(station, [1.03, 0.008, 0.01], [0, y, 0.414], f.edge)
      this.box(station, [0.16, 0.014, 0.023], [0.1, y - 0.06, 0.429], f.metal)
    }
    const screen = f.plane(station, 0.21, 0.12, [0.32, 1.109, 0.29], f.screen)
    screen.rotation.x = -Math.PI / 2
    this.box(station, [0.36, 0.035, 0.54], [-0.68, 0.74, 0], f.plastic)
    this.box(station, [0.21, 0.035, 0.29], [-0.68, 0.775, 0], f.paper)
    this.place(station, x, z, rotation)
  }

  addStorage(x, z) {
    const f = this.furniture
    const storage = new THREE.Group()
    for (const dx of [-0.8, 0, 0.8]) {
      this.box(storage, [0.79, 1.66, 0.53], [dx, 0.85, 0], f.white, true)
      this.box(storage, [0.013, 1.59, 0.02], [dx, 0.85, 0.276], f.edge)
      for (const side of [-1, 1]) this.box(storage, [0.018, 0.2, 0.028], [dx + side * 0.055, 0.93, 0.292], f.metal)
    }
    this.place(storage, x, z)
  }

  addFinishingTouches() {
    const f = this.furniture
    for (const x of [-6.35, 6.35]) {
      for (const z of [-18, -9, 9, 18]) this.place(f.plant(1.1), x, z)
      const planter = new THREE.Group()
      this.box(planter, [0.85, 0.6, 2.4], [0, 0.3, 0], f.white, true)
      this.box(planter, [0.76, 0.025, 2.3], [0, 0.61, 0], f.soil)
      for (const z of [-0.75, 0, 0.75]) {
        const plant = f.plant(0.72); plant.position.set(0, 0.25, z); planter.add(plant)
      }
      this.place(planter, x, 0)
    }
    // Abstract geometric artwork, never logos, room labels or lettering.
    const art = new THREE.Group()
    this.box(art, [2.6, 1.6, 0.075], [0, 2.15, 0], f.metal, true)
    this.box(art, [2.46, 1.46, 0.018], [0, 2.15, 0.051], f.paper)
    const colors = [0x728a7a, 0xb39978, 0x526572]
    for (let i = 0; i < 3; i += 1) {
      const material = f.material({ color: colors[i], roughness: 0.95 })
      const disc = f.mesh(art, f.geometry('artCircle', () => new THREE.CircleGeometry(0.39, 32)), material, [-0.73 + i * 0.72, 2.2 + (i % 2) * 0.2, 0.066])
      disc.castShadow = false
    }
    this.place(art, 6.8, 35.58, Math.PI, false)
  }

  dispose() {
    if (this.ownsFurniture) this.furniture.dispose()
  }
}
