import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export class OfficeFurniture {
  constructor() {
    this.wood = new THREE.MeshStandardMaterial({ color: 0xb69470, roughness: 0.65 })
    this.metal = new THREE.MeshStandardMaterial({ color: 0x333c42, metalness: 0.65, roughness: 0.4 })
    this.plastic = new THREE.MeshStandardMaterial({ color: 0x171d24, roughness: 0.65 })
    this.fabric = new THREE.MeshStandardMaterial({ color: 0x334754, roughness: 0.95 })
    this.paper = new THREE.MeshStandardMaterial({ color: 0xdce0db, roughness: 0.9 })
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 288
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#111e2a'; ctx.fillRect(0, 0, 512, 288)
    ctx.fillStyle = '#294452'; ctx.fillRect(0, 0, 512, 28)
    ctx.fillStyle = '#81b9bd'; ctx.font = '14px monospace'; ctx.fillText('NORTH / OFFICE NETWORK', 18, 19)
    ctx.fillStyle = '#203544'; ctx.fillRect(12, 42, 105, 222)
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i === 0 ? '#4c8c91' : '#49606d'; ctx.fillRect(22, 56 + i * 26, 75, 7)
    }
    ctx.fillStyle = '#34566a'; ctx.fillRect(134, 45, 358, 90)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = '#80aaa9'; ctx.fillRect(148, 154 + i * 12, 170 + (i % 3) * 51, 4)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    this.screen = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  }

  box(parent, size, position, material, rounded = false) {
    const geometry = rounded
      ? new RoundedBoxGeometry(...size, 2, Math.min(...size) * 0.18)
      : new THREE.BoxGeometry(...size)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.castShadow = true; mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  chair() {
    const chair = new THREE.Group()
    this.box(chair, [0.56, 0.12, 0.55], [0, 0.48, 0], this.fabric, true)
    this.box(chair, [0.55, 0.58, 0.1], [0, 0.83, 0.24], this.fabric, true)
    this.box(chair, [0.09, 0.35, 0.09], [0, 0.245, 0], this.metal)
    for (const side of [-1, 1]) {
      this.box(chair, [0.055, 0.21, 0.06], [side * 0.32, 0.6, 0.08], this.metal)
      this.box(chair, [0.09, 0.06, 0.38], [side * 0.32, 0.72, 0], this.plastic, true)
    }
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Group()
      spoke.rotation.y = i * Math.PI * 2 / 5
      this.box(spoke, [0.06, 0.06, 0.35], [0, 0.12, 0.16], this.metal)
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.07, 10), this.plastic)
      wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 0.055, 0.32)
      spoke.add(wheel); chair.add(spoke)
    }
    return chair
  }

  desk() {
    const desk = new THREE.Group()
    desk.name = 'Workstation'
    this.box(desk, [1.8, 0.07, 0.85], [0, 0.76, 0], this.wood, true)
    for (const x of [-0.77, 0.77]) {
      for (const z of [-0.32, 0.32]) this.box(desk, [0.055, 0.725, 0.055], [x, 0.3625, z], this.metal)
      this.box(desk, [0.055, 0.06, 0.7], [x, 0.65, 0], this.metal)
    }
    this.box(desk, [1.52, 0.07, 0.055], [0, 0.57, -0.32], this.metal)
    this.box(desk, [0.3, 0.025, 0.2], [0, 0.8075, -0.17], this.plastic, true)
    this.box(desk, [0.05, 0.2, 0.055], [0, 0.91, -0.2], this.metal)
    this.box(desk, [0.66, 0.4, 0.045], [0, 1.17, -0.21], this.plastic, true)
    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.615, 0.346), this.screen)
    display.position.set(0, 1.178, -0.186); desk.add(display)
    this.box(desk, [0.46, 0.025, 0.16], [-0.05, 0.808, 0.2], this.plastic, true)
    for (let row = 0; row < 3; row++) {
      this.box(desk, [0.4, 0.003, 0.008], [-0.05, 0.822, 0.155 + row * 0.04], this.metal)
    }
    this.box(desk, [0.2, 0.004, 0.23], [0.42, 0.797, 0.18], this.fabric)
    this.box(desk, [0.06, 0.03, 0.1], [0.42, 0.815, 0.18], this.plastic, true)
    this.box(desk, [0.22, 0.43, 0.39], [0.6, 0.245, -0.05], this.plastic, true)
    this.box(desk, [0.22, 0.007, 0.28], [-0.62, 0.8, 0.15], this.paper)
    return desk
  }

  conferenceTable() {
    const table = new THREE.Group()
    table.name = 'ConferenceTable'
    this.box(table, [4.8, 0.09, 1.6], [0, 0.76, 0], this.wood, true)
    for (const x of [-1.55, 1.55]) {
      this.box(table, [0.12, 0.7, 0.85], [x, 0.35, 0], this.metal)
      this.box(table, [0.5, 0.05, 1.15], [x, 0.025, 0], this.metal, true)
    }
    this.box(table, [0.5, 0.025, 0.14], [0, 0.818, 0], this.plastic, true)
    return table
  }
}
