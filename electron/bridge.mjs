// Bridge HTTP local para que MejoraCRM y MejoraContactos puedan mostrar el
// estado de MejoraWS (conectado/desconectado, campaña corriendo) y recibir
// eventos en tiempo real (respuesta entrante, cambio de estado) sin salir
// de su propia app — parte de la fusión MejoraSuite (ver
// C:\Github\Negocio\MejoraCRM\mejorasuite\ESPECIFICACION.md).
//
// Fase 1b: POST /send no manda texto libre ni agrega contactos nuevos —
// solo dispara un envío a un contacto que YA es miembro "pendiente" de una
// carpeta existente, llamando a runCampaign([contactoId]) tal cual: mismo
// template, mismo dailyCap, mismo delay. Nada de esto es una lógica de
// envío nueva.
// Solo escucha en 127.0.0.1 (nunca 0.0.0.0) y exige un token compartido
// por header — generado una vez y guardado en userData, para que otra app
// del mismo usuario en la misma máquina lo pueda leer sin que quede
// hardcodeado en ningún repo.

import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const PORT = 4180
const HOST = '127.0.0.1'

let server = null
const sseClients = new Set()

function loadOrCreateToken(userDataDir) {
  const tokenFile = path.join(userDataDir, 'bridge-token.txt')
  if (fs.existsSync(tokenFile)) {
    const existing = fs.readFileSync(tokenFile, 'utf8').trim()
    if (existing) return existing
  }
  const token = crypto.randomBytes(24).toString('hex')
  fs.writeFileSync(tokenFile, token, 'utf8')
  return token
}


function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 4096) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('JSON inválido'))
      }
    })
    req.on('error', reject)
  })
}
function withCommonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*') // igual exige token; ver nota de seguridad abajo
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bridge-Token')
  // Private Network Access (spec de Chromium): una página pública/HTTPS
  // (MejoraContactos en GitHub Pages, MejoraCRM en Vercel) que le pega a
  // 127.0.0.1 manda un preflight OPTIONS con
  // Access-Control-Request-Private-Network: true, y el navegador bloquea
  // la respuesta real si el server no contesta explícitamente que sí.
  // Sin esto, el fetch nunca llega a ejecutarse aunque el token sea correcto.
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
}

/**
 * Arranca el bridge. `getState` es una función síncrona que devuelve el
 * estado actual (se llama en cada GET /status, no se cachea acá).
 * Devuelve `{ token, broadcastEvent }` — `broadcastEvent(tipo, data)` lo
 * usa main.mjs para empujar eventos a los clientes SSE conectados.
 */
export function startBridgeServer(userDataDir, getState, handleSend) {
  const token = loadOrCreateToken(userDataDir)

    server = http.createServer(async (req, res) => {
    withCommonHeaders(res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Nota de seguridad: el bridge solo escucha en 127.0.0.1, así que CORS
    // "*" no expone nada a otras máquinas — el token es la barrera real
    // contra otro proceso local no autorizado leyendo el estado.
    const providedToken = req.headers['x-bridge-token']
    if (providedToken !== token) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'token inválido o faltante (header X-Bridge-Token)' }))
      return
    }

    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(getState()))
      return
    }

    if (req.method === 'GET' && req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write(`event: hello\ndata: ${JSON.stringify(getState())}\n\n`)
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      return
    }

        if (req.method === 'POST' && req.url === '/send') {
      let body
      try {
        body = await readJsonBody(req)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'JSON inválido' }))
        return
      }
      if (!body.telefono) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Falta "telefono" en el body' }))
        return
      }
      const result = handleSend(body.telefono, body.carpetaId)
      res.writeHead(result.error ? 400 : 200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
      return
    }
res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })

  server.listen(PORT, HOST, () => {
    console.log(`[bridge] escuchando en http://${HOST}:${PORT} (token en ${path.join(userDataDir, 'bridge-token.txt')})`)
  })

  function broadcastEvent(tipo, data) {
    const payload = `event: ${tipo}\ndata: ${JSON.stringify(data)}\n\n`
    for (const client of sseClients) {
      client.write(payload)
    }
  }

  return { token, broadcastEvent }
}

export function stopBridgeServer() {
  for (const client of sseClients) client.end()
  sseClients.clear()
  server?.close()
  server = null
}
