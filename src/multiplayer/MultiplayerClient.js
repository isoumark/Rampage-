import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'

const SEND_INTERVAL = 1 / 15

function getMultiplayerUrl() {
  const configuredUrl = import.meta.env.VITE_MULTIPLAYER_URL?.trim()
  if (configuredUrl) return configuredUrl.replace(/\/$/, '')
  if (location.hostname.endsWith('.vercel.app')) {
    return 'wss://survive-the-rampage-multiplayer.onrender.com'
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}`
}

export class MultiplayerClient {
  constructor({ scene, localPlayer }) {
    this.scene = scene
    this.localPlayer = localPlayer
    this.socket = null
    this.localId = null
    this.localName = 'CONNECTING'
    this.ready = false
    this.disposed = false
    this.sendTimer = 0
    this.peers = new Map()
    this.pendingPlayers = new Map()
    this.chatListeners = new Set()
    this.statusListeners = new Set()
    this.reconnectTimer = null
    this.lastStatus = 'CONNECTING'
    this.monster = null
    this.monsterHostId = null
    this.connect()
  }

  connect() {
    if (this.disposed) return
    this.socket = new WebSocket(`${getMultiplayerUrl()}/multiplayer`)
    this.socket.addEventListener('open', () => this.emitStatus('ONLINE'))
    this.socket.addEventListener('message', (event) => this.receive(JSON.parse(event.data)))
    this.socket.addEventListener('close', () => {
      this.emitStatus('RECONNECTING')
      this.reconnectTimer = window.setTimeout(() => this.connect(), 1500)
    })
    this.socket.addEventListener('error', () => this.socket?.close())
  }

  setReady() {
    this.ready = true
    for (const player of this.pendingPlayers.values()) this.ensurePeer(player)
    this.pendingPlayers.clear()
  }

  receive(message) {
    if (message.type === 'welcome') {
      this.localId = message.id
      this.localName = message.name
      this.monsterHostId = message.monsterHostId
      this.monster?.applyNetworkState(message.monsterState, true)
      for (const player of message.players ?? []) this.addOrQueuePeer(player)
      this.emitStatus('ONLINE')
      return
    }
    if (message.type === 'player-joined') {
      this.addOrQueuePeer(message.player)
      return
    }
    if (message.type === 'player-left') {
      this.removePeer(message.id)
      return
    }
    if (message.type === 'state') {
      const peer = this.peers.get(message.id)
      if (peer) this.applyState(peer, message.state)
      else this.addOrQueuePeer({ id: message.id, name: message.name ?? 'SURVIVOR', state: message.state })
      return
    }
    if (message.type === 'chat') {
      for (const listener of this.chatListeners) listener(message)
    }
    if (message.type === 'monster-host') {
      this.monsterHostId = message.id
      this.monster?.applyNetworkState(message.state, true)
      return
    }
    if (message.type === 'monster-state') this.monster?.applyNetworkState(message.state)
  }

  attachMonster(monster) {
    this.monster = monster
  }

  get isMonsterHost() {
    return Boolean(this.localId && this.localId === this.monsterHostId)
  }

  addOrQueuePeer(player) {
    if (!player?.id || player.id === this.localId) return
    if (!this.ready) {
      this.pendingPlayers.set(player.id, player)
      return
    }
    this.ensurePeer(player)
  }

  ensurePeer(player) {
    let peer = this.peers.get(player.id)
    if (peer) {
      if (player.name && player.name !== peer.name) {
        peer.name = player.name
        peer.nameplate.material.map.dispose()
        peer.nameplate.material.dispose()
        peer.nameplate.removeFromParent()
        peer.nameplate = this.createNameplate(player.name)
        peer.nameplate.position.y = 2.25
        peer.root.add(peer.nameplate)
      }
      if (player.state) this.applyState(peer, player.state)
      return peer
    }
    const root = new THREE.Group()
    root.name = `RemotePlayer-${player.id}`
    const model = SkeletonUtils.clone(this.localPlayer.model)
    model.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      child.receiveShadow = true
    })
    root.add(model)
    const mixer = new THREE.AnimationMixer(model)
    const actions = new Map()
    for (const [name, localAction] of this.localPlayer.actions) {
      actions.set(name, mixer.clipAction(localAction.getClip()))
    }
    const nameplate = this.createNameplate(player.name)
    nameplate.position.y = 2.25
    root.add(nameplate)
    root.visible = false
    this.scene.add(root)
    peer = {
      id: player.id,
      name: player.name,
      root,
      nameplate,
      mixer,
      actions,
      activeAction: null,
      targetPosition: new THREE.Vector3(),
      targetQuaternion: new THREE.Quaternion(),
    }
    this.peers.set(player.id, peer)
    this.setPeerAnimation(peer, 'idle')
    if (player.state) this.applyState(peer, player.state, true)
    return peer
  }

  createNameplate(name) {
    const canvas = document.createElement('canvas')
    canvas.width = 384
    canvas.height = 72
    const context = canvas.getContext('2d')
    context.fillStyle = '#78e98d'
    context.font = '700 28px monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineWidth = 7
    context.strokeStyle = 'rgba(0, 0, 0, .9)'
    context.strokeText(String(name).slice(0, 24), canvas.width / 2, canvas.height / 2)
    context.fillText(String(name).slice(0, 24), canvas.width / 2, canvas.height / 2)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
    sprite.scale.set(2.4, 0.45, 1)
    return sprite
  }

  applyState(peer, state, immediate = false) {
    if (!state) return
    peer.targetPosition.fromArray(state.position)
    peer.targetQuaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, state.rotationY)
    peer.root.visible = state.spawned
    this.setPeerAnimation(peer, state.animation)
    if (immediate) {
      peer.root.position.copy(peer.targetPosition)
      peer.root.quaternion.copy(peer.targetQuaternion)
    }
  }

  setPeerAnimation(peer, name) {
    const action = peer.actions.get(name) ?? peer.actions.get('idle')
    if (!action || action === peer.activeAction) return
    action.reset().fadeIn(0.18).play()
    peer.activeAction?.fadeOut(0.18)
    peer.activeAction = action
  }

  update(deltaTime) {
    for (const peer of this.peers.values()) {
      peer.mixer.update(deltaTime)
      peer.root.position.lerp(peer.targetPosition, 1 - Math.exp(-14 * deltaTime))
      peer.root.quaternion.slerp(peer.targetQuaternion, 1 - Math.exp(-14 * deltaTime))
    }
    this.sendTimer += deltaTime
    if (!this.ready || this.sendTimer < SEND_INTERVAL || this.socket?.readyState !== WebSocket.OPEN) return
    this.sendTimer = 0
    this.send({
      type: 'state',
      state: {
        position: this.localPlayer.root.position.toArray(),
        rotationY: this.localPlayer.root.rotation.y,
        animation: this.localPlayer.animationState ?? 'idle',
        spawned: this.localPlayer.spawned && this.localPlayer.isAlive,
        health: this.localPlayer.health,
      },
    })
    if (this.isMonsterHost && this.monster) this.send({ type: 'monster-state', state: this.monster.getNetworkState() })
  }

  sendChat(room, text) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.send({ type: 'chat', room, text })
    return true
  }

  send(message) {
    this.socket?.send(JSON.stringify(message))
  }

  onChat(listener) {
    this.chatListeners.add(listener)
    return () => this.chatListeners.delete(listener)
  }

  onStatus(listener) {
    this.statusListeners.add(listener)
    listener(this.lastStatus)
    return () => this.statusListeners.delete(listener)
  }

  emitStatus(status) {
    if (status === this.lastStatus) return
    this.lastStatus = status
    for (const listener of this.statusListeners) listener(status)
  }

  removePeer(id) {
    this.pendingPlayers.delete(id)
    const peer = this.peers.get(id)
    if (!peer) return
    peer.mixer.stopAllAction()
    peer.root.removeFromParent()
    this.peers.delete(id)
  }

  dispose() {
    this.disposed = true
    clearTimeout(this.reconnectTimer)
    this.socket?.close()
    for (const id of [...this.peers.keys()]) this.removePeer(id)
  }
}
