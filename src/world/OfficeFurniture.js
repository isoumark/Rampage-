import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// Shared geometry/materials let OfficeMap instance repeated furniture efficiently.
// Every procedural display and paper surface is deliberately free of text.
export class OfficeFurniture {
  constructor() {
    this.geometries = new Map()
    this.materials = new Set()
    this.textures = new Set()
    this.wood = this.material({ color: 0xf2e5cf, map: this.texture('wood'), roughness: 0.62 })
    this.metal = this.material({ color: 0x484d4d, metalness: 0.65, roughness: 0.38 })
    this.plastic = this.material({ color: 0x202629, roughness: 0.53 })
    this.fabric = this.material({ color: 0x626c69, map: this.texture('weave'), roughness: 0.97 })
    this.panelFabric = this.material({ color: 0xb0b3aa, map: this.texture('weave'), roughness: 0.98 })
    this.paper = this.material({ color: 0xf0eee6, roughness: 0.93 })
    this.white = this.material({ color: 0xdedfd8, roughness: 0.66 })
    this.edge = this.material({ color: 0xaeb3b0, metalness: 0.45, roughness: 0.5 })
    this.black = this.material({ color: 0x101719, roughness: 0.7 })
    this.leaf = this.material({ color: 0x426448, roughness: 0.88, side: THREE.DoubleSide })
    this.leafLight = this.material({ color: 0x6b8152, roughness: 0.92, side: THREE.DoubleSide })
    this.soil = this.material({ color: 0x282721, roughness: 1 })
    this.ceramic = this.material({ color: 0xc7c5bc, roughness: 0.54 })
    this.screen = this.material({ map: this.texture('screen'), toneMapped: false }, true)
    this.keyboardMaterial = this.material({ map: this.texture('keyboard'), roughness: 0.82 })
    this.shadowMaterial = this.material({ map: this.texture('shadow'), transparent: true, depthWrite: false, opacity: 0.32, toneMapped: false }, true)
  }

  material(parameters, basic = false) {
    const material = basic ? new THREE.MeshBasicMaterial(parameters) : new THREE.MeshStandardMaterial(parameters)
    this.materials.add(material)
    return material
  }

  geometry(key, build) {
    if (!this.geometries.has(key)) this.geometries.set(key, build())
    return this.geometries.get(key)
  }

  mesh(parent, geometry, material, position = [0, 0, 0], shadows = true) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.castShadow = shadows
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  box(parent, size, position, material, rounded = false) {
    const key = rounded ? 'rounded:' + size.join(',') : 'box'
    const geometry = this.geometry(key, () => rounded
      ? new RoundedBoxGeometry(...size, 2, Math.min(0.035, Math.min(...size) * 0.16))
      : new THREE.BoxGeometry(1, 1, 1))
    const mesh = this.mesh(parent, geometry, material, position)
    if (!rounded) mesh.scale.set(...size)
    return mesh
  }

  cylinder(parent, top, bottom, height, position, material, segments = 16) {
    return this.mesh(parent, this.geometry('cylinder:' + [top, bottom, height, segments].join(','),
      () => new THREE.CylinderGeometry(top, bottom, height, segments)), material, position)
  }

  plane(parent, width, height, position, material) {
    const mesh = this.mesh(parent, this.geometry('plane', () => new THREE.PlaneGeometry(1, 1)), material, position, false)
    mesh.scale.set(width, height, 1)
    return mesh
  }

  texture(kind, repeatX = 1, repeatY = 1) {
    const canvas = document.createElement('canvas')
    canvas.width = kind === 'screen' ? 512 : 256
    canvas.height = kind === 'screen' ? 288 : 256
    const ctx = canvas.getContext('2d')
    let seed = 29
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    if (kind === 'screen') {
      ctx.fillStyle = '#253338'; ctx.fillRect(0, 0, 512, 288)
      ctx.fillStyle = '#36474c'; ctx.fillRect(0, 0, 512, 22)
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = ['#d5998a', '#c9bd87', '#91ad9f'][i]
        ctx.beginPath(); ctx.arc(12 + i * 12, 11, 3, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = '#304045'; ctx.fillRect(10, 32, 78, 246)
      for (let i = 0; i < 8; i += 1) {
        ctx.fillStyle = i === 2 ? '#738f8d' : '#465e64'
        ctx.fillRect(20, 45 + i * 26, 11, 11)
        ctx.fillRect(39, 49 + i * 26, 36, 3)
      }
      ctx.fillStyle = '#d4d9d5'; ctx.fillRect(100, 33, 400, 245)
      ctx.fillStyle = '#b6c3be'; ctx.fillRect(113, 45, 374, 32)
      ctx.fillStyle = '#e4e7e1'; ctx.fillRect(113, 89, 224, 110)
      ctx.strokeStyle = '#c4cdc7'; ctx.lineWidth = 1
      for (let i = 0; i < 7; i += 1) {
        ctx.beginPath(); ctx.moveTo(120, 104 + i * 12); ctx.lineTo(328, 104 + i * 12); ctx.stroke()
      }
      ctx.strokeStyle = '#527c79'; ctx.lineWidth = 3; ctx.beginPath()
      for (let i = 0; i < 12; i += 1) {
        const x = 121 + i * 18; const y = 174 - i * 4 - Math.sin(i * 1.4) * 11
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = ['#6e8d89', '#92a6a0', '#b3bfae'][i % 3]
        ctx.fillRect(349 + i * 26, 185 - (i % 3) * 23, 17, 14 + (i % 3) * 23)
      }
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 6; col += 1) {
          ctx.fillStyle = (row + col) % 2 ? '#bccac3' : '#cbd4cc'
          ctx.fillRect(113 + col * 63, 213 + row * 13, 59, 9)
        }
      }
    } else if (kind === 'keyboard') {
      ctx.fillStyle = '#20282c'; ctx.fillRect(0, 0, 256, 256)
      ctx.fillStyle = '#596164'
      for (let row = 0; row < 5; row += 1) for (let col = 0; col < 14; col += 1) {
        ctx.fillRect(8 + col * 17.2, 14 + row * 39, 13, 29)
      }
      ctx.fillRect(70, 215, 115, 24)
    } else if (kind === 'shadow') {
      const gradient = ctx.createRadialGradient(128, 128, 12, 128, 128, 124)
      gradient.addColorStop(0, 'rgba(19,24,24,0.8)')
      gradient.addColorStop(0.5, 'rgba(19,24,24,0.3)')
      gradient.addColorStop(1, 'rgba(19,24,24,0)')
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256)
    } else if (kind === 'wood') {
      ctx.fillStyle = '#bd9e79'; ctx.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 420; i += 1) {
        const y = random() * 256
        ctx.strokeStyle = random() > 0.5 ? 'rgba(83,58,34,0.07)' : 'rgba(244,220,179,0.13)'
        ctx.lineWidth = 0.4 + random() * 1.2
        ctx.beginPath(); ctx.moveTo(0, y)
        ctx.bezierCurveTo(90, y + random() * 6, 170, y - random() * 6, 256, y)
        ctx.stroke()
      }
    } else {
      const base = kind === 'ceiling' ? 235 : kind === 'stone' ? 222 : 211
      const pixels = ctx.createImageData(256, 256)
      for (let y = 0; y < 256; y += 1) for (let x = 0; x < 256; x += 1) {
        const i = (y * 256 + x) * 4
        const weave = kind === 'weave' || kind === 'carpet' ? ((x % 3 === 0 ? -7 : 0) + (y % 3 === 0 ? 5 : 0)) : 0
        const v = base + (random() - 0.5) * (kind === 'stone' ? 9 : 26) + weave
        pixels.data[i] = v; pixels.data[i + 1] = v; pixels.data[i + 2] = v - 2; pixels.data[i + 3] = 255
      }
      ctx.putImageData(pixels, 0, 0)
      if (kind === 'carpet' || kind === 'stone') {
        ctx.strokeStyle = 'rgba(70,75,71,0.13)'; ctx.lineWidth = 1
        ctx.strokeRect(0.5, 0.5, 255, 255)
      }
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    if (repeatX !== 1 || repeatY !== 1 || kind === 'weave') {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(repeatX, repeatY)
    }
    this.textures.add(texture)
    return texture
  }

  contactShadow(parent, width, depth, x = 0, z = 0) {
    const shadow = this.plane(parent, width, depth, [x, 0.014, z], this.shadowMaterial)
    shadow.rotation.x = -Math.PI / 2
    shadow.userData.nonPhysical = true
    shadow.userData.forceBatch = true
    return shadow
  }

  chair() {
    const chair = new THREE.Group()
    chair.name = 'TaskChair'
    this.box(chair, [0.58, 0.11, 0.57], [0, 0.49, 0], this.fabric, true)
    const back = this.box(chair, [0.56, 0.62, 0.075], [0, 0.85, 0.255], this.fabric, true)
    back.rotation.x = -0.1
    this.box(chair, [0.11, 0.47, 0.05], [0, 0.59, 0.31], this.plastic, true)
    this.cylinder(chair, 0.035, 0.045, 0.33, [0, 0.27, 0], this.edge)
    for (const side of [-1, 1]) {
      this.box(chair, [0.04, 0.22, 0.04], [side * 0.335, 0.6, 0.05], this.plastic)
      this.box(chair, [0.085, 0.05, 0.34], [side * 0.335, 0.73, 0], this.plastic, true)
    }
    for (let i = 0; i < 5; i += 1) {
      const leg = new THREE.Group(); leg.rotation.y = i * Math.PI * 2 / 5
      this.box(leg, [0.045, 0.045, 0.35], [0, 0.115, 0.15], this.metal, true)
      const wheel = this.cylinder(leg, 0.057, 0.057, 0.072, [0, 0.065, 0.32], this.plastic, 10)
      wheel.rotation.z = Math.PI / 2
      chair.add(leg)
    }
    this.contactShadow(chair, 1.05, 1.05)
    return chair
  }

  monitor(parent, x, z, variant = 0) {
    this.box(parent, [0.27, 0.02, 0.2], [x, 0.81, z + 0.04], this.plastic, true)
    this.box(parent, [0.048, 0.22, 0.045], [x, 0.92, z], this.metal)
    this.box(parent, [0.72, 0.435, 0.045], [x, 1.185, z], this.plastic, true)
    this.plane(parent, 0.681, 0.382, [x, 1.188, z + 0.024], this.screen)
    this.box(parent, [0.008, 0.005, 0.004], [x + 0.29, 0.982, z + 0.026], this.white)
  }

  desk(variant = 0) {
    const desk = new THREE.Group(); desk.name = 'Workstation'
    this.box(desk, [2.4, 0.055, 0.98], [0, 0.7725, 0], this.wood, true)
    for (const x of [-1.07, 1.07]) {
      this.box(desk, [0.055, 0.73, 0.055], [x, 0.365, -0.36], this.metal)
      this.box(desk, [0.055, 0.73, 0.055], [x, 0.365, 0.36], this.metal)
      this.box(desk, [0.055, 0.055, 0.78], [x, 0.7, 0], this.metal)
    }
    this.box(desk, [2.1, 0.26, 0.045], [0, 0.51, -0.37], this.white)
    this.box(desk, [0.45, 0.57, 0.57], [0.77, 0.3, -0.09], this.white, true)
    for (const y of [0.22, 0.42, 0.57]) {
      this.box(desk, [0.41, 0.008, 0.008], [0.77, y, 0.2], this.edge)
      this.box(desk, [0.14, 0.012, 0.025], [0.77, y - 0.045, 0.215], this.metal)
    }
    if (variant % 3 === 0) {
      this.monitor(desk, -0.38, -0.27); this.monitor(desk, 0.37, -0.27)
    } else this.monitor(desk, -0.08, -0.26)
    this.box(desk, [0.53, 0.021, 0.185], [-0.1, 0.811, 0.2], this.plastic, true)
    const keys = this.plane(desk, 0.5, 0.17, [-0.1, 0.823, 0.2], this.keyboardMaterial)
    keys.rotation.x = -Math.PI / 2
    this.box(desk, [0.23, 0.004, 0.25], [0.4, 0.803, 0.2], this.fabric)
    this.box(desk, [0.065, 0.027, 0.105], [0.4, 0.818, 0.2], this.plastic, true)
    if (variant % 4 !== 0) {
      this.box(desk, [0.22, 0.011, 0.29], [-0.87, 0.808, 0.16], this.paper)
      this.box(desk, [0.008, 0.008, 0.16], [-0.78, 0.819, 0.15], this.metal)
    }
    if (variant % 3 === 1) this.cylinder(desk, 0.042, 0.036, 0.092, [0.89, 0.848, 0.25], this.ceramic, 16)
    if (variant % 5 === 0) {
      this.cylinder(desk, 0.06, 0.045, 0.11, [-0.91, 0.855, -0.23], this.ceramic)
      const plant = this.plant(0.14); plant.position.set(-0.91, 0.8, -0.23); desk.add(plant)
    }
    this.contactShadow(desk, 2.8, 1.65)
    return desk
  }

  cubiclePanel(width, height = 1.52, thickness = 0.085) {
    const panel = new THREE.Group(); panel.name = 'FabricPartition'
    this.box(panel, [width, height - 0.12, thickness], [0, height / 2 + 0.025, 0], this.panelFabric)
    this.box(panel, [width + 0.012, 0.038, thickness + 0.017], [0, height - 0.016, 0], this.edge, true)
    this.box(panel, [width, 0.065, thickness + 0.012], [0, 0.073, 0], this.edge)
    for (const x of [-width / 2, width / 2]) this.box(panel, [0.026, height, thickness + 0.015], [x, height / 2, 0], this.edge)
    return panel
  }

  conferenceTable() {
    const table = new THREE.Group(); table.name = 'ConferenceTable'
    this.box(table, [7.2, 0.085, 2.0], [0, 0.7775, 0], this.wood, true)
    for (const x of [-2.2, 2.2]) {
      this.box(table, [0.1, 0.71, 1.02], [x, 0.355, 0], this.metal)
      this.box(table, [0.62, 0.04, 1.35], [x, 0.04, 0], this.metal, true)
    }
    for (const x of [-1.3, 1.3]) this.box(table, [0.32, 0.012, 0.15], [x, 0.827, 0], this.plastic, true)
    this.contactShadow(table, 8, 2.8)
    return table
  }

  sofa() {
    const sofa = new THREE.Group(); sofa.name = 'LoungeSofa'
    this.box(sofa, [2.75, 0.22, 0.96], [0, 0.32, 0], this.fabric, true)
    this.box(sofa, [2.74, 0.57, 0.22], [0, 0.68, 0.42], this.fabric, true)
    for (const x of [-1.3, 1.3]) this.box(sofa, [0.18, 0.5, 0.95], [x, 0.53, 0], this.fabric, true)
    for (const x of [-0.82, 0, 0.82]) this.box(sofa, [0.79, 0.12, 0.75], [x, 0.48, -0.035], this.fabric, true)
    for (const x of [-1.08, 1.08]) for (const z of [-0.31, 0.31]) this.box(sofa, [0.04, 0.19, 0.04], [x, 0.1, z], this.metal)
    this.contactShadow(sofa, 3.3, 1.6)
    return sofa
  }

  roundTable(radius = 0.9, height = 0.75) {
    const table = new THREE.Group()
    this.cylinder(table, radius, radius, 0.055, [0, height, 0], this.wood, 32)
    this.cylinder(table, 0.055, 0.07, height - 0.045, [0, height / 2, 0], this.metal)
    this.cylinder(table, radius * 0.45, radius * 0.48, 0.04, [0, 0.025, 0], this.metal, 24)
    this.contactShadow(table, radius * 2.5, radius * 2.5)
    return table
  }

  plant(scale = 1) {
    const plant = new THREE.Group(); plant.name = 'Plant'
    this.cylinder(plant, 0.34, 0.26, 0.56, [0, 0.28, 0], this.ceramic, 24)
    this.cylinder(plant, 0.32, 0.32, 0.025, [0, 0.563, 0], this.soil, 20)
    const leafGeometry = this.geometry('leaf', () => {
      const vertices = []
      const point = (t, side) => [Math.sin(t * Math.PI) * side * 0.85, t * 2 - 1, Math.sin(t * Math.PI) * (side === 0 ? 0.17 : 0.03)]
      for (let strip = 0; strip < 6; strip += 1) {
        const a = strip / 6, b = (strip + 1) / 6
        for (const side of [-1, 1]) vertices.push(...point(a, 0), ...point(a, side), ...point(b, side), ...point(a, 0), ...point(b, side), ...point(b, 0))
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geometry.computeVertexNormals()
      return geometry
    })
    const stemGeometry = this.geometry('plantStem', () => new THREE.CylinderGeometry(0.008, 0.011, 1, 6))
    for (let i = 0; i < 18; i += 1) {
      const angle = i * 2.399963
      const y = 0.78 + (i % 6) * 0.15
      const reach = 0.16 + (i % 4) * 0.075
      const leaf = this.mesh(plant, leafGeometry, i % 3 ? this.leaf : this.leafLight,
        [Math.sin(angle) * reach, y, Math.cos(angle) * reach])
      leaf.scale.set(0.17, 0.3, 0.28)
      leaf.rotation.set(0.15 + (i % 3) * 0.13, angle, Math.sin(angle) * 0.9)
      const tip = new THREE.Vector3(0, -0.88, 0).multiply(leaf.scale).applyQuaternion(leaf.quaternion).add(leaf.position)
      const base = new THREE.Vector3(0, Math.max(0.56, y - 0.42), 0)
      const direction = tip.clone().sub(base)
      const stem = this.mesh(plant, stemGeometry, this.leaf, base.clone().add(tip).multiplyScalar(0.5).toArray())
      stem.scale.y = direction.length()
      stem.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, direction.normalize())
    }
    this.cylinder(plant, 0.013, 0.022, 0.9, [0, 0.97, 0], this.leaf, 6)
    plant.scale.setScalar(scale)
    return plant
  }

  dispose() {
    for (const geometry of this.geometries.values()) geometry.dispose()
    for (const material of this.materials) material.dispose()
    for (const texture of this.textures) texture.dispose()
    this.geometries.clear(); this.materials.clear(); this.textures.clear()
  }
}
