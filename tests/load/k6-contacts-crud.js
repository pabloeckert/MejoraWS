// tests/load/k6-contacts-crud.js
// Load test para CRUD de contactos
// Uso: k6 run tests/load/k6-contacts-crud.js

import http from 'k6/http'
import { check, sleep } from 'k6'
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  stages: [
    { duration: '10s', target: 3 },   // Ramp up conservador
    { duration: '30s', target: 10 },  // Sustained
    { duration: '10s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
  },
}

export default function () {
  const phone = `+54911${randomIntBetween(10000000, 99999999)}`

  // CREATE
  const createRes = http.post(`${BASE_URL}/api/v1/contacts`, JSON.stringify({
    name: `LoadTest-${randomIntBetween(1, 99999)}`,
    phone: phone,
    email: `test${randomIntBetween(1, 99999)}@load.test`,
  }), { headers: { 'Content-Type': 'application/json' } })

  check(createRes, {
    'create: status 200 or 201': (r) => r.status >= 200 && r.status < 300,
  })

  // READ (list)
  const listRes = http.get(`${BASE_URL}/api/v1/contacts?limit=10`)
  check(listRes, {
    'list: status 200': (r) => r.status === 200,
  })

  // READ (by phone)
  const getRes = http.get(`${BASE_URL}/api/v1/contacts/phone/${phone}`)
  check(getRes, {
    'get: status 200 or 404': (r) => r.status === 200 || r.status === 404,
  })

  // Stats
  const statsRes = http.get(`${BASE_URL}/api/v1/contacts/stats/summary`)
  check(statsRes, {
    'stats: status 200': (r) => r.status === 200,
  })

  sleep(0.3)
}
