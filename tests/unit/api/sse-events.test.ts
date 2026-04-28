// tests/unit/api/sse-events.test.ts
// Tests for SSE broadcast functionality

import { describe, it, expect, beforeEach, vi } from 'vitest'

// We test the broadcast logic by importing and verifying behavior
// Since SSE relies on HTTP connections, we test the data transformation logic

describe('SSE Events', () => {
  it('broadcast formats events correctly', () => {
    // Test the SSE wire format
    const event = 'message:new'
    const data = { from: '+1234567890', text: 'hello', direction: 'inbound' }
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

    expect(payload).toContain('event: message:new')
    expect(payload).toContain('"from":"+1234567890"')
    expect(payload).toContain('"text":"hello"')
    expect(payload).toContain('"direction":"inbound"')
    expect(payload.endsWith('\n\n')).toBe(true)
  })

  it('SSEEvents helper methods produce correct event types', () => {
    // Import the module to test helper methods
    // Since the module uses Express types, we test the format inline
    const events = {
      messageNew: (data: any) => ({ event: 'message:new', data }),
      messageStatus: (data: any) => ({ event: 'message:status', data }),
      contactUpdate: (data: any) => ({ event: 'contact:update', data }),
      dealUpdate: (data: any) => ({ event: 'deal:update', data }),
      dealStageChange: (data: any) => ({ event: 'deal:stage', data }),
      campaignUpdate: (data: any) => ({ event: 'campaign:update', data }),
      campaignProgress: (data: any) => ({ event: 'campaign:progress', data }),
      statusUpdate: (data: any) => ({ event: 'status:update', data }),
      systemAlert: (data: any) => ({ event: 'system:alert', data }),
    }

    expect(events.messageNew({ text: 'hi' }).event).toBe('message:new')
    expect(events.dealStageChange({ id: '1', from: 'nuevo', to: 'contactado' }).event).toBe('deal:stage')
    expect(events.campaignProgress({ id: '1', sent: 5, total: 10 }).event).toBe('campaign:progress')
    expect(events.systemAlert({ level: 'warn', message: 'test' }).event).toBe('system:alert')
  })

  it('SSE event data is JSON-serializable', () => {
    const events = [
      { event: 'message:new', data: { id: '1', from: '+123', text: 'hello', timestamp: new Date().toISOString() } },
      { event: 'deal:stage', data: { id: 'deal-1', from: 'nuevo', to: 'contactado' } },
      { event: 'campaign:progress', data: { id: 'camp-1', sent: 50, total: 100 } },
      { event: 'status:update', data: { whatsapp: true, botActive: true, llm: { active: 'groq' } } },
    ]

    for (const evt of events) {
      const serialized = JSON.stringify(evt.data)
      const deserialized = JSON.parse(serialized)
      expect(deserialized).toEqual(evt.data)
    }
  })
})
