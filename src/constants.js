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
