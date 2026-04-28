// tests/load/k6-health.js
// Load test para health endpoint
// Uso: k6 run tests/load/k6-health.js

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // Ramp up
    { duration: '30s', target: 50 },  // Sustained load
    { duration: '10s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    http_req_failed: ['rate<0.01'],    // <1% errors
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/health`)

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has status ok': (r) => {
      try {
        return JSON.parse(r.body).status === 'ok'
      } catch {
        return false
      }
    },
    'response time < 200ms': (r) => r.timings.duration < 200,
  })

  sleep(0.1)
}
