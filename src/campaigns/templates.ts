// src/campaigns/templates.ts
// Template rotation — Anti-ban capa 6

export interface MessageTemplate {
  id: string
  text: string
  variables: string[] // e.g. ['nombre', 'empresa']
}

/**
 * Genera variaciones de un template reemplazando sinónimos y estructura
 * Para evitar detección de spam por WhatsApp
 */
const SYNONYMS: Record<string, string[]> = {
  'hola': ['hola', 'buenos días', 'buenas', 'qué tal', 'hey'],
  'gracias': ['gracias', 'te agradezco', 'mil gracias', 'genial'],
  'consultar': ['consultar', 'preguntar', 'saber más sobre', 'informarme sobre'],
  'precio': ['precio', 'costo', 'valor', 'inversión', 'tarifa'],
  'ofrecer': ['ofrecer', 'presentar', 'compartir', 'mostrar'],
  'disponible': ['disponible', 'disponemos', 'tenemos', 'contamos con'],
  'contactar': ['contactar', 'escribir', 'comunicarte', 'hablar'],
  'ayudar': ['ayudar', 'asistir', 'apoyar', 'colaborar'],
}

/**
 * Aplica variaciones de sinónimos a un texto
 */
export function applySynonymVariation(text: string): string {
  let result = text
  for (const [word, synonyms] of Object.entries(SYNONYMS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    if (regex.test(result)) {
      const chosen = synonyms[Math.floor(Math.random() * synonyms.length)]
      result = result.replace(regex, chosen)
    }
  }
  return result
}

/**
 * Aplica variaciones menores de formato (espacios, puntuación)
 * Suficiente para generar diferencias en el hash de WhatsApp
 */
export function applyFormatVariation(text: string): string {
  let result = text

  // Variar espacios después de comas (a veces 1, a veces 2)
  result = result.replace(/, /g, () => Math.random() > 0.5 ? ', ' : ',  ')

  // A veces agregar/quitar punto final
  if (result.endsWith('.') && Math.random() > 0.5) {
    result = result.slice(0, -1)
  } else if (!result.endsWith('.') && !result.endsWith('!') && !result.endsWith('?') && Math.random() > 0.7) {
    result += '.'
  }

  // Variar saludo final
  const endings = ['', ' Saludos.', ' Un abrazo.', ' Quedo atento.', '']
  if (Math.random() > 0.6) {
    result += endings[Math.floor(Math.random() * endings.length)]
  }

  return result.trim()
}

/**
 * Reemplaza variables en un template
 * Variables: {{nombre}}, {{empresa}}, etc.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

/**
 * Genera una variación única de un mensaje aplicando todas las técnicas
 */
export function generateVariation(text: string, vars?: Record<string, string>): string {
  let result = text

  // 1. Fill variables
  if (vars) {
    result = fillTemplate(result, vars)
  }

  // 2. Apply synonym variation
  result = applySynonymVariation(result)

  // 3. Apply format variation
  result = applyFormatVariation(result)

  return result
}

/**
 * Selecciona una variación de un array de templates
 */
export function selectVariation(templates: string[]): string {
  if (templates.length === 0) return ''
  if (templates.length === 1) return templates[0]
  return templates[Math.floor(Math.random() * templates.length)]
}
