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
