// Funciones puras de MejoraWS, sin dependencias de Electron/Baileys/fs —
// separadas de main.mjs para poder testearlas con Vitest sin tener que
// levantar un proceso Electron real (main.mjs importa 'electron' a nivel de
// módulo y ejecuta código de arranque apenas se importa).

export function normalizePhone(p) {
  return (p || '').toString().replace(/\D/g, '')
}

// --- Exportación a CSV ---
// Excel en español espera punto y coma como separador, no coma. Y sin el BOM
// del principio se come los acentos y las ñ.
export function toCsv(filas, columnas) {
  const escapar = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const cabecera = columnas.map((c) => escapar(c.titulo)).join(';')
  const cuerpo = filas.map((f) => columnas.map((c) => escapar(c.valor(f))).join(';'))
  return '﻿' + [cabecera, ...cuerpo].join('\r\n')
}

export function fechaLegible(iso) {
  return iso ? new Date(iso).toLocaleString('es-AR') : ''
}

export function etapaEntrega(c) {
  if (c.entregaStatus >= 4) return 'Leído'
  if (c.entregaStatus === 3) return 'Llegó al teléfono'
  if (c.entregaStatus === 2) return 'Salió'
  return c.estado === 'enviado' ? 'Sin confirmar' : ''
}

// Busca la primera columna del CSV/Excel cuyo nombre matchea alguno de los
// candidatos (en orden de prioridad) y que además tiene un valor no vacío
// en esa fila. Así "Whatsapp_Format", "Comercio", "Teléfono", etc. se
// reconocen sin que el archivo tenga que usar los nombres exactos.
export function findFieldKey(row, candidates) {
  const keys = Object.keys(row || {})
  for (const cand of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase().includes(cand))
    if (found && String(row[found]).trim()) return found
  }
  return null
}

// Retardo aleatorio uniforme básico (retrocompatibilidad)
export function randomDelayMs(min, max) {
  const a = Math.max(1, Number(min) || 20)
  const b = Math.max(a, Number(max) || 90)
  return (a + Math.random() * (b - a)) * 1000
}

// Retardo estocástico con distribución Gaussiana / Box-Muller (Jitter Anti-Detección Meta)
// Concentra la probabilidad en la media con dispersión orgánica hacia los extremos,
// evitando la firma artificial de una distribución rectangular plana.
export function gaussianRandomDelayMs(min, max) {
  const a = Math.max(1, Number(min) || 20)
  const b = Math.max(a, Number(max) || 90)
  if (a === b) return a * 1000

  const mean = (a + b) / 2
  const stdDev = (b - a) / 6 // 99.7% dentro de [min, max]

  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)

  const val = Math.min(b, Math.max(a, mean + z * stdDev))
  return val * 1000
}

// Simula la duración que le tomaría a un humano escribir el mensaje (~250 car/min)
// Acotado entre 2000ms (2s) y 7000ms (7s) para mantener una emulación realista en socket.
export function calculateTypingDurationMs(textLength) {
  const length = Math.max(0, Number(textLength) || 0)
  const duration = 1500 + length * 35
  return Math.min(7000, Math.max(2000, duration))
}

export function extractText(msg) {
  return (
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    msg?.message?.imageMessage?.caption ||
    ''
  )
}

// Motor Spintax Polimórfico (Anti-Hash Matching):
// Resuelve patrones como {Hola|Buen día|Buenas} o anidados {Hola|{Buen día|Buenas}}
// garantizando que cada mensaje emitido tenga una huella criptográfica distinta.
export function parseSpintax(text) {
  if (!text || typeof text !== 'string') return ''
  let current = text
  const spintaxRegex = /\{([^{}]+?\|[^{}]+?)\}/

  let match
  let safetyLimit = 50 // prevenir bucles infinitos en malformados
  while ((match = current.match(spintaxRegex)) && safetyLimit-- > 0) {
    const options = match[1].split('|')
    const chosen = options[Math.floor(Math.random() * options.length)]
    current = current.slice(0, match.index) + chosen + current.slice(match.index + match[0].length)
  }
  return current
}

// Reemplaza primero las opciones Spintax y luego cualquier {campo} por el valor
// del contacto. Si el contacto no tiene ese campo, lo deja vacío sin romper.
export function renderTemplate(template, contact) {
  if (!template) return ''
  const withSpintax = parseSpintax(template)
  return withSpintax.replace(/\{(\w+)\}/g, (match, key) => {
    const value = contact?.[key]
    return value !== undefined && value !== null && value !== '' ? String(value) : ''
  })
}

// Gate del tope diario de envíos, extraído de runCampaign para poder
// testearlo aislado. true = todavía se puede mandar más hoy.
export function canSendMore(sentToday, dailyCap) {
  return Number(sentToday) < Number(dailyCap)
}

// Clasificador Tri-Banda de Respuestas Entrantes:
// Segmenta la intención del prospecto para el semáforo comercial de MejoraCRM y SLA 48h.
export function clasificarRespuesta(texto) {
  if (!texto || typeof texto !== 'string') return 'desconocido'
  const limpio = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes para robustez
    .trim()

  if (!limpio) return 'desconocido'

  // 1. Detección de Baja / Desuscripción (Prioridad 1 para cumplimiento y ética)
  const patronesBaja = [
    /\b(no me interesa|no gracias|baja|remover|desuscribir|eliminar|sacame|no escribas|no molestar|no jodas|equivocado|numero equivocado|quien sos|de donde sacaste)\b/
  ]
  if (patronesBaja.some((rgx) => rgx.test(limpio))) {
    return 'baja'
  }

  // 2. Detección de Interés Inmediato (Disparador SLA 48h Verde)
  const patronesInteres = [
    /\b(si|dale|quiero|info|informacion|contame|interesa|pasame|cuando podes|pasa|coordinemos|llamame|me sirve|buenisimo|de que se trata|contanos)\b/
  ]
  if (patronesInteres.some((rgx) => rgx.test(limpio))) {
    return 'interes_inmediato'
  }

  // 3. Detección de Postergación (Re-agenda en CRM)
  const patronesPostergacion = [
    /\b(ahora no|mas adelante|la semana que viene|el mes que viene|despues|complicado|ocupado|viajando|manana|luego)\b/
  ]
  if (patronesPostergacion.some((rgx) => rgx.test(limpio))) {
    return 'postergacion'
  }

  return 'desconocido'
}

// Medidor de Seguridad en Vivo (Safety Gauge para UX):
// Calcula el nivel de riesgo en base al volumen diario y la cadencia de envío.
export function calculateSafetyLevel(sentToday, dailyCap, minDelaySec) {
  const sent = Number(sentToday) || 0
  const cap = Number(dailyCap) || 40
  const delay = Number(minDelaySec) || 20

  if (sent >= cap) {
    return { level: 'rojo', score: 20, badge: '🔴 Riesgo', mensaje: 'Tope diario alcanzado. Envíos pausados por seguridad.' }
  }
  if (delay < 15) {
    return { level: 'rojo', score: 30, badge: '🔴 Riesgo', mensaje: 'Delay demasiado agresivo (<15s). Alto riesgo de baneo.' }
  }
  if (sent >= cap * 0.75 || delay < 25) {
    return { level: 'amarillo', score: 65, badge: '🟡 Atención', mensaje: 'Cadencia moderada. Acercándose al tope de seguridad.' }
  }
  return { level: 'verde', score: 95, badge: '🟢 Seguro', mensaje: 'Parámetros óptimos. Comportamiento 100% humanizado.' }
}
