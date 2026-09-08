import { describe, it, expect } from 'vitest'
import {
  normalizePhone, toCsv, fechaLegible, etapaEntrega, findFieldKey,
  randomDelayMs, extractText, renderTemplate, canSendMore
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

describe('randomDelayMs', () => {
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
    // min efectivo pasa a ser 90 también como max, así que el delay es fijo en 90s
    expect(ms).toBe(90 * 1000)
  })
  it('nunca devuelve menos de 1 segundo aunque min sea 0 o negativo', () => {
    const ms = randomDelayMs(0, 5)
    expect(ms).toBeGreaterThanOrEqual(1000)
  })
})

describe('renderTemplate', () => {
  it('reemplaza placeholders presentes en el contacto', () => {
    const out = renderTemplate('Hola {nombre}, de {empresa}', { nombre: 'Juan', empresa: 'Acme' })
    expect(out).toBe('Hola Juan, de Acme')
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
  it('no confunde texto con llaves literales que no son campos válidos', () => {
    // \w+ no matchea espacios, así que "{no es campo}" no se reemplaza
    const out = renderTemplate('Precio: {no es campo}', {})
    expect(out).toBe('Precio: {no es campo}')
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
    const row = { Nombre_Completo: 'Juan', Whatsapp_Format: '5493765407805' }
    expect(findFieldKey(row, ['whatsapp', 'telefono'])).toBe('Whatsapp_Format')
  })
  it('respeta el orden de prioridad de los candidatos', () => {
    const row = { Telefono: '111', Whatsapp: '222' }
    expect(findFieldKey(row, ['whatsapp', 'telefono'])).toBe('Whatsapp')
  })
  it('ignora columnas que matchean el nombre pero están vacías', () => {
    const row = { Whatsapp: '', Telefono: '5493765407805' }
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
