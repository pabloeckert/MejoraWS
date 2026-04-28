// dashboard/src/lib/sse-context.tsx
// Global SSE context — provides real-time events to all dashboard components

'use client'

import { createContext, useContext, useCallback, ReactNode } from 'react'
import { useSSE, SSEEventType } from './use-sse'

interface SSEContextType {
  connected: boolean
  reconnectCount: number
  lastEvent: { event: SSEEventType; data: any; timestamp: string } | null
  on: (event: SSEEventType, handler: (data: any) => void) => () => void
}

const SSEContext = createContext<SSEContextType>({
  connected: false,
  reconnectCount: 0,
  lastEvent: null,
  on: () => () => {},
})

// Event handler registry
const handlers = new Map<SSEEventType, Set<(data: any) => void>>()

function emitToHandlers(event: SSEEventType, data: any) {
  const set = handlers.get(event)
  if (set) {
    for (const handler of set) {
      try { handler(data) } catch (e) { console.error('SSE handler error:', e) }
    }
  }
}

export function SSEProvider({ children }: { children: ReactNode }) {
  const { connected, lastEvent, reconnectCount } = useSSE({
    onMessage: (msg) => {
      emitToHandlers(msg.event, msg.data)
    },
  })

  const on = useCallback((event: SSEEventType, handler: (data: any) => void) => {
    if (!handlers.has(event)) handlers.set(event, new Set())
    handlers.get(event)!.add(handler)
    return () => { handlers.get(event)?.delete(handler) }
  }, [])

  return (
    <SSEContext.Provider value={{ connected, lastEvent, reconnectCount, on }}>
      {children}
    </SSEContext.Provider>
  )
}

export const useSSEContext = () => useContext(SSEContext)

/**
 * Subscribe to a specific SSE event type.
 * Auto-cleans up on unmount.
 *
 * Usage:
 *   useSSEEvent('message:new', (data) => setMessages(prev => [data, ...prev]))
 */
export function useSSEEvent(event: SSEEventType, handler: (data: any) => void) {
  const { on } = useSSEContext()
  const ref = useCallback(handler, []) // stable reference
  // Use effect to subscribe
  const { useEffect } = require('react')
  useEffect(() => on(event, ref), [on, event, ref])
}
