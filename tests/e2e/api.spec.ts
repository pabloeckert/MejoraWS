// tests/e2e/api.spec.ts
// E2E tests: API endpoints end-to-end

import { test, expect } from '@playwright/test'

const API_URL = process.env.API_URL || 'http://localhost:3000'
let authToken: string

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { password: 'admin' },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  authToken = body.token
})

test.describe('Health & Status', () => {
  test('GET /health should return ok', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks).toBeDefined()
  })

  test('GET /api/v1/status should return system status', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/status`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('Contacts API', () => {
  let contactId: string

  test('POST /api/v1/contacts should create contact', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/contacts`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        name: 'E2E Test Contact',
        phone: '5491199990000',
        email: 'e2e@test.com',
        tags: ['test', 'e2e'],
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.data.name).toBe('E2E Test Contact')
    contactId = body.data.id
  })

  test('GET /api/v1/contacts should list contacts', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/contacts`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.data)).toBeTruthy()
  })

  test('GET /api/v1/contacts/:id should get contact', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/contacts/${contactId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.data.name).toBe('E2E Test Contact')
  })

  test('PUT /api/v1/contacts/:id should update contact', async ({ request }) => {
    const res = await request.put(`${API_URL}/api/v1/contacts/${contactId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { name: 'E2E Updated Contact' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.data.name).toBe('E2E Updated Contact')
  })

  test('DELETE /api/v1/contacts/:id should delete contact', async ({ request }) => {
    const res = await request.delete(`${API_URL}/api/v1/contacts/${contactId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })

  test('GET /api/v1/contacts/stats/summary should return stats', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/contacts/stats/summary`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('Deals API', () => {
  let dealId: string

  test('POST /api/v1/deals should create deal', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/deals`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        contact_phone: '5491199990000',
        value: 5000,
        notes: 'E2E test deal',
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.data.stage).toBe('nuevo')
    dealId = body.data.id
  })

  test('GET /api/v1/deals/pipeline should return pipeline', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/deals/pipeline`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.data.stages).toBeDefined()
  })

  test('PATCH /api/v1/deals/:id/stage should move deal', async ({ request }) => {
    const res = await request.patch(`${API_URL}/api/v1/deals/${dealId}/stage`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { stage: 'contactado' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.data.stage).toBe('contactado')
  })

  test('GET /api/v1/deals/stats should return stats', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/deals/stats`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })

  test('POST /api/v1/deals/:id/close should close deal', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/deals/${dealId}/close`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { won: true },
    })
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('Analytics API', () => {
  test('GET /api/v1/analytics/overview should return KPIs', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/analytics/overview`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })

  test('GET /api/v1/analytics/messages should return trend', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/analytics/messages`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })

  test('GET /api/v1/analytics/funnel should return funnel', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/analytics/funnel`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })

  test('GET /api/v1/analytics/sentiment should return sentiment', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/analytics/sentiment`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('GDPR API', () => {
  test('GET /api/v1/gdpr/stats should return compliance stats', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/gdpr/stats`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })
})
