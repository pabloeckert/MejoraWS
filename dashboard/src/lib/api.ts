// src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

interface ApiOptions {
  method?: string
  body?: any
  token?: string
}

async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : opts.token

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `API error: ${res.status}`)
  }

  if (res.status === 204) return {} as T
  return res.json()
}

// === Auth ===
export async function login(password: string) {
  return apiFetch<{ token: string }>('/api/v1/auth/login', {
    method: 'POST',
    body: { password },
  })
}

// === Status ===
export async function getStatus() {
  return apiFetch<{ data: any }>('/api/v1/status')
}

export async function getBotConfig() {
  return apiFetch<{ data: any }>('/api/v1/status/config')
}

export async function updateBotConfig(config: any) {
  return apiFetch<{ data: any }>('/api/v1/status/config', {
    method: 'PUT',
    body: config,
  })
}

export async function updateKnowledgeBase(knowledge: string) {
  return apiFetch<{ data: any }>('/api/v1/status/kb', {
    method: 'PUT',
    body: { knowledge },
  })
}

// === Contacts ===
export async function getContacts(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return apiFetch<{ data: any[]; pagination: any }>(`/api/v1/contacts${qs}`)
}

export async function getContact(id: string) {
  return apiFetch<{ data: any }>(`/api/v1/contacts/${id}`)
}

export async function createContact(data: any) {
  return apiFetch<{ data: any }>('/api/v1/contacts', { method: 'POST', body: data })
}

export async function updateContact(id: string, data: any) {
  return apiFetch<{ data: any }>(`/api/v1/contacts/${id}`, { method: 'PUT', body: data })
}

export async function deleteContact(id: string) {
  return apiFetch(`/api/v1/contacts/${id}`, { method: 'DELETE' })
}

export async function getContactStats() {
  return apiFetch<{ data: any }>('/api/v1/contacts/stats/summary')
}

// === Deals ===
export async function getDeals(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return apiFetch<{ data: any[] }>(`/api/v1/deals${qs}`)
}

export async function getPipeline() {
  return apiFetch<{ data: any }>('/api/v1/deals/pipeline')
}

export async function getFollowUps() {
  return apiFetch<{ data: any[] }>('/api/v1/deals/followups')
}

export async function getDealStats() {
  return apiFetch<{ data: any }>('/api/v1/deals/stats')
}

export async function createDeal(data: any) {
  return apiFetch<{ data: any }>('/api/v1/deals', { method: 'POST', body: data })
}

export async function moveDealStage(id: string, stage: string) {
  return apiFetch<{ data: any }>(`/api/v1/deals/${id}/stage`, {
    method: 'PATCH',
    body: { stage },
  })
}

export async function closeDeal(id: string, won: boolean) {
  return apiFetch<{ data: any }>(`/api/v1/deals/${id}/close`, {
    method: 'POST',
    body: { won },
  })
}

// === Messages ===
export async function getMessages(phone: string, limit?: number) {
  const qs = limit ? `?limit=${limit}` : ''
  return apiFetch<{ data: any[] }>(`/api/v1/messages/${phone}${qs}`)
}

export async function getRecentMessages(limit?: number) {
  const qs = limit ? `?limit=${limit}` : ''
  return apiFetch<{ data: any[] }>(`/api/v1/messages/recent/all${qs}`)
}

export async function sendMessage(to: string, text: string) {
  return apiFetch<{ data: any }>('/api/v1/messages/send', {
    method: 'POST',
    body: { to, text },
  })
}

export async function getSendStats() {
  return apiFetch<{ data: any }>('/api/v1/messages/stats/sending')
}

// === Campaigns ===
export async function getCampaigns() {
  return apiFetch<{ data: any[] }>('/api/v1/campaigns')
}

export async function getCampaign(id: string) {
  return apiFetch<{ data: any }>(`/api/v1/campaigns/${id}`)
}

export async function getCampaignStats(id: string) {
  return apiFetch<{ data: any }>(`/api/v1/campaigns/${id}/stats`)
}

export async function createCampaign(data: any) {
  return apiFetch<{ data: any }>('/api/v1/campaigns', { method: 'POST', body: data })
}

export async function updateCampaign(id: string, data: any) {
  return apiFetch<{ data: any }>(`/api/v1/campaigns/${id}`, { method: 'PATCH', body: data })
}

export async function deleteCampaign(id: string) {
  return apiFetch(`/api/v1/campaigns/${id}`, { method: 'DELETE' })
}

export async function executeCampaign(id: string, body?: any) {
  return apiFetch<{ data: any }>(`/api/v1/campaigns/${id}/execute`, { method: 'POST', body: body || {} })
}

export async function pauseCampaign(id: string) {
  return apiFetch<{ data: any }>(`/api/v1/campaigns/${id}/pause`, { method: 'POST' })
}

// === Analytics ===
export async function getAnalyticsOverview() {
  return apiFetch<{ data: any }>('/api/v1/analytics/overview')
}

export async function getAnalyticsMessages() {
  return apiFetch<{ data: any[] }>('/api/v1/analytics/messages')
}

export async function getAnalyticsFunnel() {
  return apiFetch<{ data: any[] }>('/api/v1/analytics/funnel')
}

export async function getAnalyticsSentiment() {
  return apiFetch<{ data: any[] }>('/api/v1/analytics/sentiment')
}

export async function getAnalyticsTiming() {
  return apiFetch<{ data: any }>('/api/v1/analytics/timing')
}

export async function getAnalyticsQuality() {
  return apiFetch<{ data: any }>('/api/v1/analytics/quality')
}

export async function exportAnalytics(type: string, days?: number) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : undefined
  const qs = days ? `?type=${type}&days=${days}` : `?type=${type}`
  const res = await fetch(`${API_BASE}/api/v1/analytics/export${qs}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error('Export failed')
  return res.blob()
}
