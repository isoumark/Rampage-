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

webSockets.on('connection', (socket) => {
  const id = randomUUID().slice(0, 8)
  const player = {
    id,
    name: `SURVIVOR-${Math.floor(100 + Math.random() * 900)}`,
    state: null,
    lastChatAt: 0,
  }
  clients.set(socket, player)
  socket.send(JSON.stringify({
    type: 'welcome',
    id,
    name: player.name,
    players: [...clients.values()].filter((entry) => entry !== player).map(({ id: peerId, name, state }) => ({ id: peerId, name, state })),
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
    }
  })

  socket.on('close', () => {
    clients.delete(socket)
    broadcast({ type: 'player-left', id })
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
