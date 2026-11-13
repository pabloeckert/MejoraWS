import { describe, it, expect } from 'vitest'
import {
  normalizePhone, toCsv, fechaLegible, etapaEntrega, findFieldKey,
  randomDelayMs, extractText, renderTemplate, canSendMore,
  parseSpintax, gaussianRandomDelayMs, calculateTypingDurationMs,
  clasificarRespuesta, calculateSafetyLevel
} from './pure.mjs'

describe('normalizePhone', () => {
  it('deja solo dígitos', () => {
    expect(normalizePhone('+54 9 3765-40 78 05')).toBe('5493765407805')
  })
  it('maneja null/undefined sin explotar', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
  })
  it('acepta números ya limpios', () => {
    expect(normalizePhone(5493765407805)).toBe('5493765407805')
  })
  it('devuelve vacío si no hay ningún dígito', () => {
    expect(normalizePhone('sin numero')).toBe('')
  })
})

describe('canSendMore (gate del tope diario)', () => {
  it('permite enviar si todavía no llegó al tope', () => {
    expect(canSendMore(10, 50)).toBe(true)
  })
  it('bloquea justo al llegar al tope', () => {
    expect(canSendMore(50, 50)).toBe(false)
  })
  it('bloquea si ya se pasó del tope', () => {
    expect(canSendMore(51, 50)).toBe(false)
  })
  it('permite el primer envío del día', () => {
    expect(canSendMore(0, 50)).toBe(true)
  })
})

describe('randomDelayMs (uniforme)', () => {
  it('devuelve un valor dentro del rango pedido (en ms)', () => {
    for (let i = 0; i < 50; i++) {
      const ms = randomDelayMs(20, 90)
      expect(ms).toBeGreaterThanOrEqual(20 * 1000)
      expect(ms).toBeLessThanOrEqual(90 * 1000)
    }
  })
  it('usa defaults sensatos si min/max no son números', () => {
    const ms = randomDelayMs(undefined, undefined)
    expect(ms).toBeGreaterThanOrEqual(20 * 1000)
    expect(ms).toBeLessThanOrEqual(90 * 1000)
  })
  it('nunca deja que max quede por debajo de min (config invertida)', () => {
    const ms = randomDelayMs(90, 20)
    expect(ms).toBe(90 * 1000)
  })
  it('nunca devuelve menos de 1 segundo aunque min sea 0 o negativo', () => {
    const ms = randomDelayMs(0, 5)
    expect(ms).toBeGreaterThanOrEqual(1000)
  })
})

describe('gaussianRandomDelayMs (Jitter Estocástico Gaussiano)', () => {
  it('se mantiene estrictamente dentro de los límites [min, max]', () => {
    for (let i = 0; i < 100; i++) {
      const ms = gaussianRandomDelayMs(25, 85)
      expect(ms).toBeGreaterThanOrEqual(25 * 1000)
      expect(ms).toBeLessThanOrEqual(85 * 1000)
    }
  })
  it('retorna el valor fijo si min y max son iguales', () => {
    const ms = gaussianRandomDelayMs(45, 45)
    expect(ms).toBe(45 * 1000)
  })
})

describe('calculateTypingDurationMs (Emulación de Tipeo Humano)', () => {
  it('acota la duración mínima a 2000ms', () => {
    expect(calculateTypingDurationMs(5)).toBeGreaterThanOrEqual(2000)
    expect(calculateTypingDurationMs(0)).toBe(2000)
  })
  it('acota la duración máxima a 7000ms', () => {
    expect(calculateTypingDurationMs(500)).toBe(7000)
  })
  it('crece proporcionalmente con la longitud del mensaje', () => {
    const d1 = calculateTypingDurationMs(30)
    const d2 = calculateTypingDurationMs(120)
    expect(d2).toBeGreaterThan(d1)
  })
})

describe('parseSpintax (Anti-Hash Matching)', () => {
  it('resuelve una opción simple entre alternativas', () => {
    const template = '{Hola|Buen día|Buenas}'
    const resultado = parseSpintax(template)
    expect(['Hola', 'Buen día', 'Buenas']).toContain(resultado)
  })
  it('resuelve múltiples bloques Spintax en un mismo texto', () => {
    const template = '{Hola|Buenas}, {cómo estás|todo bien}?'
    const resultado = parseSpintax(template)
    expect(resultado).toMatch(/^(Hola|Buenas), (cómo estás|todo bien)\?$/)
  })
  it('soporta spintax anidado', () => {
    const template = '{Hola|{Muy buenos días|Buenas}} estimado'
    const resultado = parseSpintax(template)
    expect(['Hola estimado', 'Muy buenos días estimado', 'Buenas estimado']).toContain(resultado)
  })
  it('no modifica cadenas sin spintax', () => {
    expect(parseSpintax('Mensaje plano directo')).toBe('Mensaje plano directo')
  })
})

describe('renderTemplate', () => {
  it('reemplaza placeholders presentes en el contacto', () => {
    const out = renderTemplate('Hola {nombre}, de {empresa}', { nombre: 'Juan', empresa: 'Acme' })
    expect(out).toBe('Hola Juan, de Acme')
  })
  it('resuelve spintax y variables de forma combinada', () => {
    const out = renderTemplate('{Hola|Buen día} {nombre}!', { nombre: 'Roberto' })
    expect(['Hola Roberto!', 'Buen día Roberto!']).toContain(out)
  })
  it('deja vacío un placeholder sin valor en el contacto, sin romper el mensaje', () => {
    const out = renderTemplate('Hola {nombre}, tel {telefono}', { nombre: 'Juan' })
    expect(out).toBe('Hola Juan, tel ')
  })
  it('maneja template vacío o null', () => {
    expect(renderTemplate('', { nombre: 'Juan' })).toBe('')
    expect(renderTemplate(null, { nombre: 'Juan' })).toBe('')
  })
  it('no toca el texto si no hay placeholders', () => {
    expect(renderTemplate('Mensaje fijo sin variables', {})).toBe('Mensaje fijo sin variables')
  })
})

describe('clasificarRespuesta (Clasificador Tri-Banda)', () => {
  it('detecta intención de interés inmediato', () => {
    expect(clasificarRespuesta('Dale, pasame la info')).toBe('interes_inmediato')
    expect(clasificarRespuesta('Sí, me interesa')).toBe('interes_inmediato')
    expect(clasificarRespuesta('Quiero saber más')).toBe('interes_inmediato')
    expect(clasificarRespuesta('¿Cuándo podés pasar?')).toBe('interes_inmediato')
  })
  it('detecta intención de postergación para re-agenda', () => {
    expect(clasificarRespuesta('Ahora no puedo, estoy complicado')).toBe('postergacion')
    expect(clasificarRespuesta('Escribime la semana que viene')).toBe('postergacion')
    expect(clasificarRespuesta('Más adelante lo vemos')).toBe('postergacion')
  })
  it('detecta solicitudes de baja o negativa estricta', () => {
    expect(clasificarRespuesta('No me interesa, gracias')).toBe('baja')
    expect(clasificarRespuesta('Por favor dar de baja mi número')).toBe('baja')
    expect(clasificarRespuesta('¿Quién sos? No me escribas más')).toBe('baja')
  })
  it('devuelve desconocido si el texto no encaja en ninguna categoría', () => {
    expect(clasificarRespuesta('asdfghjkl')).toBe('desconocido')
    expect(clasificarRespuesta('')).toBe('desconocido')
    expect(clasificarRespuesta(null)).toBe('desconocido')
  })
})

describe('calculateSafetyLevel (Medidor de Seguridad en Vivo)', () => {
  it('marca verde si el volumen y delays son óptimos', () => {
    const res = calculateSafetyLevel(10, 40, 30)
    expect(res.level).toBe('verde')
    expect(res.score).toBeGreaterThan(80)
  })
  it('marca amarillo al superar el 75% del tope diario o delay menor a 25s', () => {
    const res1 = calculateSafetyLevel(32, 40, 30)
    expect(res1.level).toBe('amarillo')
    const res2 = calculateSafetyLevel(10, 40, 20)
    expect(res2.level).toBe('amarillo')
  })
  it('marca rojo si se alcanzó el tope diario o delay es menor a 15s', () => {
    const res1 = calculateSafetyLevel(40, 40, 30)
    expect(res1.level).toBe('rojo')
    const res2 = calculateSafetyLevel(5, 40, 10)
    expect(res2.level).toBe('rojo')
  })
})

describe('extractText', () => {
  it('extrae de conversation', () => {
    expect(extractText({ message: { conversation: 'hola' } })).toBe('hola')
  })
  it('extrae de extendedTextMessage', () => {
    expect(extractText({ message: { extendedTextMessage: { text: 'hola largo' } } })).toBe('hola largo')
  })
  it('extrae el caption de una imagen', () => {
    expect(extractText({ message: { imageMessage: { caption: 'mirá esto' } } })).toBe('mirá esto')
  })
  it('devuelve vacío si no hay ningún texto reconocible (audio, sticker, etc)', () => {
    expect(extractText({ message: { audioMessage: {} } })).toBe('')
    expect(extractText({ message: {} })).toBe('')
  })
})

describe('etapaEntrega', () => {
  it('sin confirmar mientras no hay entregaStatus y el mensaje ya se envió', () => {
    expect(etapaEntrega({ estado: 'enviado', entregaStatus: undefined })).toBe('Sin confirmar')
  })
  it('vacío si ni siquiera se envió', () => {
    expect(etapaEntrega({ estado: 'pendiente', entregaStatus: undefined })).toBe('')
  })
  it('salió con status 2', () => {
    expect(etapaEntrega({ estado: 'enviado', entregaStatus: 2 })).toBe('Salió')
  })
  it('llegó al teléfono con status 3', () => {
    expect(etapaEntrega({ estado: 'enviado', entregaStatus: 3 })).toBe('Llegó al teléfono')
  })
  it('leído con status 4 o 5', () => {
    expect(etapaEntrega({ estado: 'enviado', entregaStatus: 4 })).toBe('Leído')
    expect(etapaEntrega({ estado: 'enviado', entregaStatus: 5 })).toBe('Leído')
  })
})

describe('findFieldKey', () => {
  it('encuentra la columna por nombre parcial, sin importar mayúsculas', () => {
    const row = { Nombre_Completo: 'Juan', Whatsapp_Format: '5493764507805' }
    expect(findFieldKey(row, ['whatsapp', 'telefono'])).toBe('Whatsapp_Format')
  })
  it('respeta el orden de prioridad de los candidatos', () => {
    const row = { Telefono: '111', Whatsapp: '222' }
    expect(findFieldKey(row, ['whatsapp', 'telefono'])).toBe('Whatsapp')
  })
  it('ignora columnas que matchean el nombre pero están vacías', () => {
    const row = { Whatsapp: '', Telefono: '5493764507805' }
    expect(findFieldKey(row, ['whatsapp', 'telefono'])).toBe('Telefono')
  })
  it('devuelve null si ninguna columna matchea', () => {
    expect(findFieldKey({ Nombre: 'Juan' }, ['whatsapp', 'telefono'])).toBe(null)
  })
  it('no explota con una fila undefined', () => {
    expect(findFieldKey(undefined, ['whatsapp'])).toBe(null)
  })
})

describe('fechaLegible', () => {
  it('formatea una fecha ISO en formato es-AR', () => {
    const out = fechaLegible('2026-08-07T01:06:47.934Z')
    expect(out).not.toBe('')
    expect(typeof out).toBe('string')
  })
  it('devuelve vacío si no hay fecha', () => {
    expect(fechaLegible(null)).toBe('')
    expect(fechaLegible(undefined)).toBe('')
    expect(fechaLegible('')).toBe('')
  })
})

describe('toCsv', () => {
  const columnas = [
    { titulo: 'Nombre', valor: (f) => f.nombre },
    { titulo: 'Teléfono', valor: (f) => f.telefono },
  ]

  it('arma cabecera y filas separadas por punto y coma', () => {
    const out = toCsv([{ nombre: 'Juan', telefono: '111' }], columnas)
    expect(out).toContain('Nombre;Teléfono')
    expect(out).toContain('Juan;111')
  })
  it('empieza con el BOM UTF-8 para que Excel no rompa acentos/ñ', () => {
    const out = toCsv([{ nombre: 'Ñandú', telefono: '111' }], columnas)
    expect(out.charCodeAt(0)).toBe(0xFEFF)
  })
  it('escapa valores que contienen punto y coma o comillas', () => {
    const out = toCsv([{ nombre: 'Dale; mandame info', telefono: '111' }], columnas)
    expect(out).toContain('"Dale; mandame info"')
  })
  it('trata null/undefined como celda vacía, no como "null"', () => {
    const out = toCsv([{ nombre: null, telefono: undefined }], columnas)
    expect(out).not.toContain('null')
    expect(out).not.toContain('undefined')
  })
})
