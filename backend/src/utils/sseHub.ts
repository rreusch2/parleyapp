import type { Response } from 'express'

// Simple in-memory SSE hub to route tool events to connected users
// NOTE: This is per-process memory. For horizontal scale, replace with Redis pub/sub.

type Client = {
  id: string
  res: Response
}

const clients: Map<string, Map<string, Client>> = new Map() // userId -> clientId -> client

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function addClient(userId: string, res: Response): string {
  const id = genId()
  let userMap = clients.get(userId)
  if (!userMap) {
    userMap = new Map()
    clients.set(userId, userMap)
  }
  userMap.set(id, { id, res })

  // Heartbeat to keep connection alive
  const keepAlive = setInterval(() => {
    try {
      res.write(`:keepalive ${Date.now()}\n\n`)
    } catch {
      // ignore; client removal occurs on error/close from caller
    }
  }, 15000)

  // Attach cleanup on close
  res.on('close', () => {
    clearInterval(keepAlive)
    removeClient(userId, id)
  })
  res.on('finish', () => {
    clearInterval(keepAlive)
    removeClient(userId, id)
  })

  return id
}

export function removeClient(userId: string, clientId: string) {
  const userMap = clients.get(userId)
  if (!userMap) return
  userMap.delete(clientId)
  if (userMap.size === 0) clients.delete(userId)
}

export function broadcast(userId: string, data: any) {
  const userMap = clients.get(userId)
  if (!userMap) return 0
  const payload = `data: ${JSON.stringify(data)}\n\n`
  let count = 0
  for (const { res } of userMap.values()) {
    try {
      res.write(payload)
      count++
    } catch {
      // ignore write errors, cleanup will be triggered via close
    }
  }
  return count
}

export function broadcastAll(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  let count = 0
  for (const userMap of clients.values()) {
    for (const { res } of userMap.values()) {
      try {
        res.write(payload)
        count++
      } catch {}
    }
  }
  return count
}
