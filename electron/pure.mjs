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

export function randomDelayMs(min, max) {
  const a = Math.max(1, Number(min) || 20)
  const b = Math.max(a, Number(max) || 90)
  return (a + Math.random() * (b - a)) * 1000
}

export function extractText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    ''
  )
}

// Reemplaza cualquier {campo} presente en el texto por el valor de ese
// campo en el contacto (nombre, apellido, variable, o lo que tenga). Si el
// contacto no tiene ese campo, lo deja vacío en vez de romper el mensaje.
export function renderTemplate(template, contact) {
  return (template || '').replace(/\{(\w+)\}/g, (match, key) => {
    const value = contact?.[key]
    return value !== undefined && value !== null && value !== '' ? String(value) : ''
  })
}

// Gate del tope diario de envíos, extraído de runCampaign para poder
// testearlo aislado. true = todavía se puede mandar más hoy.
export function canSendMore(sentToday, dailyCap) {
  return Number(sentToday) < Number(dailyCap)
}
