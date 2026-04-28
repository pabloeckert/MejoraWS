// dashboard/src/lib/use-sse.ts
// React hook for Server-Sent Events (SSE) real-time connection

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type SSEEventType =
  | 'message:new'
  | 'message:status'
  | 'contact:update'
  | 'deal:update'
  | 'deal:stage'
  | 'campaign:update'
  | 'campaign:progress'
  | 'status:update'
  | 'system:alert'

interface SSEMessage {
  event: SSEEventType
  data: any
  timestamp: string
}

interface UseSSEOptions {
  onMessage?: (msg: SSEMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  autoReconnect?: boolean
  reconnectIntervalMs?: number
}

/**
 * Hook to connect to the SSE stream from the API.
 * Provides real-time updates for dashboard without polling.
 *
 * Usage:
 *   const { connected, lastEvent } = useSSE({
 *     onMessage: (msg) => { if (msg.event === 'message:new') refreshMessages() }
 *   })
 */
export function useSSE(options: UseSSEOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    reconnectIntervalMs = 5000,
  } = options

  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<SSEMessage | null>(null)
  const [reconnectCount, setReconnectCount] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const onMessageRef = useRef(onMessage)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)

  // Keep refs current
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onConnectRef.current = onConnect }, [onConnect])
  useEffect(() => { onDisconnectRef.current = onDisconnect }, [onDisconnect])

  const connect = useCallback(() => {
    // Cleanup existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    if (!token) return // Don't connect without auth

    const url = `${API_BASE}/api/v1/events/stream`
    const es = new EventSource(url, {
      withCredentials: false,
    })

    es.addEventListener('connected', (e) => {
      setConnected(true)
      setReconnectCount(0)
      onConnectRef.current?.()
    })

    // Listen for all known event types
    const eventTypes: SSEEventType[] = [
      'message:new', 'message:status', 'contact:update',
      'deal:update', 'deal:stage', 'campaign:update',
      'campaign:progress', 'status:update', 'system:alert',
    ]

    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const msg: SSEMessage = {
            event: eventType,
            data: JSON.parse(e.data),
            timestamp: new Date().toISOString(),
          }
          setLastEvent(msg)
          onMessageRef.current?.(msg)
        } catch (err) {
          console.error(`SSE parse error for ${eventType}:`, err)
        }
      })
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      onDisconnectRef.current?.()

      // Auto-reconnect with backoff
      if (autoReconnect) {
        const delay = Math.min(reconnectIntervalMs * (reconnectCount + 1), 30000)
        setTimeout(() => {
          setReconnectCount((c) => c + 1)
          connect()
        }, delay)
      }
    }

    eventSourceRef.current = es
  }, [autoReconnect, reconnectIntervalMs, reconnectCount])

  useEffect(() => {
    connect()

    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reconnect = useCallback(() => {
    setReconnectCount(0)
    connect()
  }, [connect])

  return { connected, lastEvent, reconnectCount, reconnect }
}
