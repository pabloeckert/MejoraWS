// src/api/routes/events.ts
// Server-Sent Events (SSE) for real-time dashboard updates
// No extra dependencies — uses native Express + HTTP

import { Router, Request, Response } from 'express'
import { Orchestrator } from '../../brain/orchestrator'
import { childLogger } from '../../utils/logger'

const log = childLogger('sse')

interface SSEClient {
  id: string
  res: Response
}

const clients: Map<string, SSEClient> = new Map()
let clientIdCounter = 0

/**
 * Broadcast an event to all connected SSE clients
 */
export function broadcast(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const [id, client] of clients) {
    try {
      client.res.write(payload)
    } catch {
      clients.delete(id)
      log.debug({ clientId: id }, 'SSE client disconnected (write failed)')
    }
  }
}

/**
 * Emit specific event types with structured data
 */
export const SSEEvents = {
  messageNew(msg: any) {
    broadcast('message:new', msg)
  },
  messageStatus(data: { id: string; status: string }) {
    broadcast('message:status', data)
  },
  contactUpdate(contact: any) {
    broadcast('contact:update', contact)
  },
  dealUpdate(deal: any) {
    broadcast('deal:update', deal)
  },
  dealStageChange(data: { id: string; from: string; to: string }) {
    broadcast('deal:stage', data)
  },
  campaignUpdate(campaign: any) {
    broadcast('campaign:update', campaign)
  },
  campaignProgress(data: { id: string; sent: number; total: number }) {
    broadcast('campaign:progress', data)
  },
  statusUpdate(status: any) {
    broadcast('status:update', status)
  },
  systemAlert(data: { level: string; message: string }) {
    broadcast('system:alert', data)
  },
}

export function eventsRouter(orchestrator: Orchestrator): Router {
  const router = Router()

  router.get('/stream', (req: Request, res: Response) => {
    const clientId = `sse-${++clientIdCounter}`

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    })

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, time: new Date().toISOString() })}\n\n`)

    // Register client
    clients.set(clientId, { id: clientId, res })
    log.info({ clientId, total: clients.size }, 'SSE client connected')

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`)
      } catch {
        clearInterval(heartbeat)
        clients.delete(clientId)
      }
    }, 30_000)

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(heartbeat)
      clients.delete(clientId)
      log.info({ clientId, total: clients.size }, 'SSE client disconnected')
    })
  })

  // Endpoint to check SSE status
  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      data: {
        connectedClients: clients.size,
        events: ['message:new', 'message:status', 'contact:update', 'deal:update', 'deal:stage', 'campaign:update', 'campaign:progress', 'status:update', 'system:alert'],
      },
    })
  })

  return router
}
