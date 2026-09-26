import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { PlayerController } from './player/PlayerController.js'
import { ThirdPersonCamera } from './player/ThirdPersonCamera.js'
import { OfficeMap } from './world/OfficeMap.js'
import { RageMonster } from './monster/RageMonster.js'
import { GameHud } from './ui/GameHud.js'
import { SoundManager } from './audio/SoundManager.js'
import { ChatRooms } from './chat/ChatRooms.js'
import { MultiplayerClient } from './multiplayer/MultiplayerClient.js'
import { GunController } from './combat/GunController.js'
import './style.css'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x11181c)
scene.fog = new THREE.FogExp2(0x11181c, 0.018)

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000)
scene.add(camera)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.18
document.querySelector('#app').appendChild(renderer.domElement)

const statusElement = document.querySelector('#loading-status')
const setStatus = (message, isError = false) => {
  statusElement.textContent = message
  statusElement.classList.toggle('error', isError)
}

scene.add(new THREE.HemisphereLight(0xd9edff, 0x182026, 1.75))
scene.add(new THREE.AmbientLight(0x8ca0aa, 0.48))

const sun = new THREE.DirectionalLight(0xffffff, 3)
sun.position.set(-12, 18, 8)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -52
sun.shadow.camera.right = 52
sun.shadow.camera.top = 45
sun.shadow.camera.bottom = -45
sun.shadow.bias = -0.0004
scene.add(sun)

const officeMap = new OfficeMap(scene)
const hud = new GameHud()
const sounds = new SoundManager()

const player = new PlayerController({
  scene,
  modelLoader: new GLTFLoader(),
  animationLoader: new FBXLoader(),
  modelUrl: '/models/player.glb',
  modelScale: 1,
  animationUrls: {
    walk: '/models/animations/walk.fbx',
    run: '/models/animations/run.fbx',
  },
  onProgress: (percent) => setStatus(`Loading player… ${percent}%`),
  resolveMovement: (position, previousPosition) => {
    return officeMap.resolvePlayerMovement(position, previousPosition)
  },
  onHealthChanged: (health, maxHealth) => hud.setHealth(health, maxHealth),
  onRespawn: () => {},
})

const multiplayer = new MultiplayerClient({ scene, localPlayer: player })
new ChatRooms({ network: multiplayer, canvas: renderer.domElement })

const thirdPersonCamera = new ThirdPersonCamera({
  camera,
  domElement: renderer.domElement,
  target: player.root,
  getBlockers: () => officeMap.cameraBlockers,
})

const monster = new RageMonster({
  scene,
  target: player.root,
  officeMap,
  loader: new GLTFLoader(),
  modelUrl: '/models/giant-mutant.glb',
  onAttack: (damage) => {
    if (player.takeDamage(damage)) {
      thirdPersonCamera.addShake(0.65)
      sounds.hit()
    }
  },
  onSmash: () => {
    thirdPersonCamera.addShake(0.9)
    sounds.smash()
  },
})
multiplayer.attachMonster(monster)
multiplayer.onMonsterHealth((health, maxHealth) => hud.setMonsterHealth(health, maxHealth))

const gun = new GunController({
  camera,
  scene,
  domElement: renderer.domElement,
  player,
  network: multiplayer,
  onAmmoChanged: (ammo, reserve, reloading) => hud.setAmmo(ammo, reserve, reloading),
  onShot: () => {
    thirdPersonCamera.addShake(0.06)
    sounds.gunshot()
  },
})

hud.setHealth(player.health, player.maxHealth)

player
  .load()
  .then(() => {
    multiplayer.setReady()
    setStatus('SYSTEM READY')
    document.querySelector('#spawn-button').disabled = false
  })
  .catch((error) => {
    console.error('[Player] Could not load the character model.', error)
    setStatus('Player model failed to load. Check the console.', true)
  })

document.querySelector('#spawn-button').addEventListener('click', () => {
  if (!player.spawn()) return
  if (multiplayer.isMonsterHost) monster.reset()
  document.body.classList.add('spawned')
})

const timer = new THREE.Timer()
timer.connect(document)

function animate() {
  requestAnimationFrame(animate)
  timer.update()
  const deltaTime = Math.min(timer.getDelta(), 0.05)
  player.update(deltaTime, thirdPersonCamera.yaw)
  if (multiplayer.isMonsterHost) {
    const target = multiplayer.getNearestActiveTarget(monster.root.position)
    monster.setTarget(target ?? player.root)
    monster.update(deltaTime, Boolean(target) && multiplayer.monsterAlive)
  }
  else monster.updateRemote(deltaTime)
  monster.updateLocalDamage(deltaTime, player)
  gun.update(deltaTime)
  officeMap.update(deltaTime)
  multiplayer.update(deltaTime)
  const monsterDistance = player.root.position.distanceTo(monster.root.position)
  const danger = player.spawned && player.isAlive && monsterDistance < 14
  hud.setDanger(danger)
  const isMoving = player.currentSpeed > 0.15
  sounds.update(deltaTime, player.currentSpeed, danger)
  thirdPersonCamera.update(deltaTime, player.isSprinting, isMoving)
  renderer.render(scene, camera)
}

animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

window.addEventListener('beforeunload', () => {
  timer.dispose()
  player.dispose()
  multiplayer.dispose()
  gun.dispose()
  hud.dispose()
  thirdPersonCamera.dispose()
})
