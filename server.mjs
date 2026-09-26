import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createServer as createViteServer } from 'vite'
import { WebSocketServer, WebSocket } from 'ws'

const isProduction = process.argv.includes('--production')
const root = process.cwd()
const distRoot = resolve(root, 'dist')
const clients = new Map()
let monsterHostId = null
let monsterState = null
const MONSTER_MAX_HEALTH = 12000
const BASE_WEAPON_DAMAGE = 32
const CREATOR_FEE_DAMAGE_MULTIPLIER = 1 // Future memecoin integration updates this server-side.
let monsterHealth = MONSTER_MAX_HEALTH
let monsterResetTimer = null

const mimeTypes = {
  '.css': 'text/css',
  '.fbx': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

const vite = isProduction
  ? null
  : await createViteServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'spa' })

function serveProduction(request, response) {
  if (!existsSync(distRoot)) {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ service: 'multiplayer', status: 'ok' }))
    return
  }
  const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const requestedPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '')
  let filePath = resolve(distRoot, requestedPath)
  if (!filePath.startsWith(distRoot) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distRoot, 'index.html')
  }
  response.setHeader('Content-Type', mimeTypes[extname(filePath)] ?? 'application/octet-stream')
  createReadStream(filePath).pipe(response)
}

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', players: clients.size }))
    return
  }
  if (vite) vite.middlewares(request, response, () => {})
  else serveProduction(request, response)
})

const webSockets = new WebSocketServer({ server, path: '/multiplayer', maxPayload: 16 * 1024 })

function broadcast(message, except = null) {
  const payload = JSON.stringify(message)
  for (const socket of webSockets.clients) {
    if (socket !== except && socket.readyState === WebSocket.OPEN) socket.send(payload)
  }
}

function safeState(value) {
  if (!value || !Array.isArray(value.position) || value.position.length !== 3) return null
  if (!value.position.every(Number.isFinite) || !Number.isFinite(value.rotationY)) return null
  return {
    position: [
      Math.max(-49, Math.min(49, value.position[0])),
      Math.max(0, Math.min(6, value.position[1])),
      Math.max(-39, Math.min(39, value.position[2])),
    ],
    rotationY: value.rotationY,
    animation: ['idle', 'walk', 'run'].includes(value.animation) ? value.animation : 'idle',
    spawned: Boolean(value.spawned),
    health: Math.max(0, Math.min(100, Number(value.health) || 0)),
  }
}

function safeMonsterState(value) {
  if (!value || !Array.isArray(value.position) || value.position.length !== 3) return null
  if (!value.position.every(Number.isFinite) || !Number.isFinite(value.rotationY)) return null
  return {
    position: value.position.map((entry, index) => Math.max(index === 1 ? 0 : -55, Math.min(index === 1 ? 6 : 55, entry))),
    rotationY: value.rotationY,
    animation: ['idle', 'run', 'attack'].includes(value.animation) ? value.animation : 'idle',
  }
}

function electMonsterHost() {
  const activePlayer = [...clients.values()].find((entry) => entry.state?.spawned && entry.state.health > 0)
  const nextHostId = activePlayer?.id ?? null
  if (nextHostId === monsterHostId) return
  monsterHostId = nextHostId
  broadcast({ type: 'monster-host', id: monsterHostId, state: monsterState })
}

webSockets.on('connection', (socket) => {
  const id = randomUUID().slice(0, 8)
  const player = {
    id,
    name: `SURVIVOR-${Math.floor(100 + Math.random() * 900)}`,
    state: null,
    lastChatAt: 0,
    lastShotAt: 0,
  }
  clients.set(socket, player)
  socket.send(JSON.stringify({
    type: 'welcome',
    id,
    name: player.name,
    players: [...clients.values()].filter((entry) => entry !== player).map(({ id: peerId, name, state }) => ({ id: peerId, name, state })),
    monsterHostId,
    monsterState,
    monsterHealth,
    monsterMaxHealth: MONSTER_MAX_HEALTH,
  }))
  broadcast({ type: 'player-joined', player: { id, name: player.name, state: null } }, socket)

  socket.on('message', (buffer) => {
    let message
    try {
      message = JSON.parse(buffer.toString())
    } catch {
      return
    }
    if (message?.type === 'state') {
      const state = safeState(message.state)
      if (!state) return
      player.state = state
      broadcast({ type: 'state', id, name: player.name, state }, socket)
      if (!monsterHostId || player.id === monsterHostId && (!state.spawned || state.health <= 0)) electMonsterHost()
      return
    }
    if (message?.type === 'chat') {
      const now = Date.now()
      if (now - player.lastChatAt < 350) return
      player.lastChatAt = now
      const text = String(message.text ?? '').trim().slice(0, 180)
      const room = ['LOBBY', 'SURVIVORS'].includes(message.room) ? message.room : 'LOBBY'
      if (!text) return
      broadcast({ type: 'chat', room, author: player.name, text })
      return
    }
    if (message?.type === 'monster-state' && player.id === monsterHostId) {
      const state = safeMonsterState(message.state)
      if (!state) return
      monsterState = state
      broadcast({ type: 'monster-state', state }, socket)
      return
    }
    if (message?.type === 'monster-hit') {
      const now = Date.now()
      if (!player.state?.spawned || player.state.health <= 0 || now - player.lastShotAt < 90 || monsterHealth <= 0) return
      player.lastShotAt = now
      const origin = message.origin
      const direction = message.direction
      if (!Array.isArray(origin) || !Array.isArray(direction) || origin.length !== 3 || direction.length !== 3) return
      if (![...origin, ...direction].every(Number.isFinite) || !monsterState?.position) return
      const playerPosition = player.state.position
      const originDistance = Math.hypot(origin[0] - playerPosition[0], origin[1] - playerPosition[1], origin[2] - playerPosition[2])
      const directionLength = Math.hypot(...direction)
      if (originDistance > 4 || directionLength < 0.9 || directionLength > 1.1) return
      const toMonster = monsterState.position.map((value, index) => value - origin[index])
      const alongRay = toMonster.reduce((sum, value, index) => sum + value * direction[index], 0)
      if (alongRay < 0 || alongRay > 90) return
      const missDistance = Math.hypot(...toMonster.map((value, index) => value - direction[index] * alongRay))
      if (missDistance > 2.25) return
      const damage = Math.round(BASE_WEAPON_DAMAGE * CREATOR_FEE_DAMAGE_MULTIPLIER)
      monsterHealth = Math.max(0, monsterHealth - damage)
      broadcast({ type: 'monster-health', health: monsterHealth, maxHealth: MONSTER_MAX_HEALTH, damage, attackerId: id })
      if (monsterHealth === 0 && !monsterResetTimer) {
        broadcast({ type: 'monster-defeated', attackerId: id })
        monsterResetTimer = setTimeout(() => {
          monsterHealth = MONSTER_MAX_HEALTH
          monsterState = { position: [0, 0, -26], rotationY: 0, animation: 'run' }
          monsterResetTimer = null
          broadcast({ type: 'monster-reset', state: monsterState, health: monsterHealth, maxHealth: MONSTER_MAX_HEALTH })
        }, 8000)
      }
    }
  })

  socket.on('close', () => {
    clients.delete(socket)
    broadcast({ type: 'player-left', id })
    if (id === monsterHostId) {
      monsterHostId = null
      electMonsterHost()
    }
  })
})

function listen(port) {
  const onError = (error) => {
    server.off('listening', onListening)
    if (error.code === 'EADDRINUSE' && port < 5190) {
      listen(port + 1)
      return
    }
    throw error
  }
  const onListening = () => {
    server.off('error', onError)
    console.log(`Survive The Rampage multiplayer server: http://127.0.0.1:${port}`)
  }
  server.once('error', onError)
  server.once('listening', onListening)
  server.listen(port, '0.0.0.0')
}

listen(Number(process.env.PORT) || 5173)
