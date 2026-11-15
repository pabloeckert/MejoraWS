export const ESTADOS = {
  pendiente: { label: 'Pendiente', dot: 'bg-mc-gris', text: 'text-mc-gris', bg: 'bg-gray-50 border-gray-200' },
  enviado: { label: 'Enviado', dot: 'bg-mc-azul', text: 'text-mc-azul', bg: 'bg-blue-50 border-blue-100' },
  respondio: { label: 'Respondió', dot: 'bg-mc-amarillo', text: 'text-mc-tinta', bg: 'bg-yellow-50 border-yellow-200' },
  respondio_no_listado: { label: 'Respondió (no listado)', dot: 'bg-mc-amarillo', text: 'text-mc-tinta', bg: 'bg-yellow-50 border-yellow-200' },
  error: { label: 'Error', dot: 'bg-mc-rojo', text: 'text-mc-rojo', bg: 'bg-red-50 border-red-100' }
}

export const CONTACTO_PRUEBA = { nombre: 'Juan', apellido: 'Pérez', variable: '' }

export function renderTemplate(template, contact) {
  return (template || '').replace(/\{(\w+)\}/g, (match, key) => {
    const value = contact?.[key]
    return value !== undefined && value !== null && value !== '' ? String(value) : ''
  })
}

export const EMOJIS = [
  '👋', '🙂', '😊', '👍', '🙌', '🤝', '💪', '🎯',
  '✅', '✨', '📌', '📎', '📅', '⏰', '📞', '💬',
  '📈', '💡', '🔧', '🛠️', '🏪', '🚚', '📦', '🙏'
]

// Parser de Spintax recursivo para evitar repetición de hashes y firmas de texto
export function parseSpintax(texto) {
  if (!texto || typeof texto !== 'string') return ''
  const regex = /\{([^{}]+)\}/g
  let resultado = texto
  const RESERVADOS = new Set(['nombre', 'apellido', 'telefono', 'variable'])

  while (regex.test(resultado)) {
    resultado = resultado.replace(regex, (match, contenido) => {
      if (RESERVADOS.has(contenido.trim().toLowerCase())) {
        return match
      }
      const opciones = contenido.split('|').map((s) => s.trim())
      if (opciones.length <= 1) {
        return match
      }
      const elegido = opciones[Math.floor(Math.random() * opciones.length)]
      return elegido
    })
  }
  return resultado
}

// Medidor de Seguridad en Vivo (Safety Gauge para UX):
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

export function normalizePhone(p) {
  return (p || '').toString().replace(/\D/g, '')
}

export function formatToJid(p) {
  const norm = normalizePhone(p)
  if (!norm) return ''
  if (norm.endsWith('@s.whatsapp.net')) return norm
  if (norm.length === 10 && !norm.startsWith('54')) {
    return `549${norm}@s.whatsapp.net`
  }
  if (norm.length === 12 && norm.startsWith('54') && !norm.startsWith('549')) {
    return `549${norm.slice(2)}@s.whatsapp.net`
  }
  return `${norm}@s.whatsapp.net`
}

export function parseRecipientsText(rawText) {
  if (!rawText || typeof rawText !== 'string') return []
  const lines = rawText.split(/\r?\n/)
  const recipients = []
  const seenPhones = new Set()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (/[;,\t]/.test(trimmed)) {
      const parts = trimmed.split(/[;,\t]/).map((p) => p.trim()).filter(Boolean)
      if (parts.length > 0) {
        if (parts.every((p) => normalizePhone(p).length >= 7)) {
          for (const p of parts) {
            const norm = normalizePhone(p)
            if (norm && !seenPhones.has(norm)) {
              seenPhones.add(norm)
              recipients.push({ telefono: p, nombre: '', variable: '' })
            }
          }
          continue
        }

        const phoneIndex = parts.findIndex((p) => normalizePhone(p).length >= 7)
        if (phoneIndex !== -1) {
          const telefono = parts[phoneIndex]
          const telNorm = normalizePhone(telefono)
          if (telNorm && !seenPhones.has(telNorm)) {
            seenPhones.add(telNorm)
            const otherParts = parts.filter((_, idx) => idx !== phoneIndex)
            const nombre = otherParts[0] || ''
            const variable = otherParts.slice(1).join(' ') || ''
            recipients.push({ telefono, nombre, variable })
          }
          continue
        }
      }
    }

    const words = trimmed.split(/[\s,;]+/).map((w) => w.trim()).filter(Boolean)
    for (const w of words) {
      const norm = normalizePhone(w)
      if (norm.length >= 7 && !seenPhones.has(norm)) {
        seenPhones.add(norm)
        recipients.push({ telefono: w, nombre: '', variable: '' })
      }
    }
  }

  return recipients
}
