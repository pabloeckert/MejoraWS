// tests/load/k6-api.js
// Load test para API completa
// Uso: k6 run tests/load/k6-api.js

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  stages: [
    { duration: '15s', target: 5 },   // Ramp up
    { duration: '60s', target: 20 },  // Sustained load
    { duration: '15s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% under 1s
    http_req_failed: ['rate<0.05'],    // <5% errors
  },
}

export default function () {
  const endpoints = [
    { name: 'health', url: `${BASE_URL}/health` },
    { name: 'status', url: `${BASE_URL}/api/v1/status` },
    { name: 'contacts', url: `${BASE_URL}/api/v1/contacts` },
    { name: 'deals', url: `${BASE_URL}/api/v1/deals` },
    { name: 'deals-pipeline', url: `${BASE_URL}/api/v1/deals/pipeline` },
    { name: 'messages-recent', url: `${BASE_URL}/api/v1/messages/recent/all` },
    { name: 'campaigns', url: `${BASE_URL}/api/v1/campaigns` },
    { name: 'analytics-overview', url: `${BASE_URL}/api/v1/analytics/overview` },
    { name: 'analytics-messages', url: `${BASE_URL}/api/v1/analytics/messages` },
    { name: 'analytics-funnel', url: `${BASE_URL}/api/v1/analytics/funnel` },
    { name: 'metrics', url: `${BASE_URL}/metrics` },
  ]

  // Pick random endpoint
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]

  const res = http.get(endpoint.url)

  check(res, {
    [`${endpoint.name}: status 200`]: (r) => r.status === 200,
    [`${endpoint.name}: response < 500ms`]: (r) => r.timings.duration < 500,
  })

  sleep(0.2)
}
