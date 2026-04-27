// src/importer/cleaner.ts
// Limpieza determinística de contactos

import { RawContact } from './parsers'

export interface CleanContact {
  name: string | null
  phone: string | null
  email: string | null
  company: string | null
  tags: string[]
  source: string
  score: number
}

/**
 * Mapeo de columnas comunes (ES/EN) a campos internos
 */
const COLUMN_MAP: Record<string, keyof CleanContact> = {
  // Nombre
  'nombre': 'name', 'name': 'name', 'nombre completo': 'name',
  'full name': 'name', 'first name': 'name', 'apellido': 'name',
  'contacto': 'name', 'contact': 'name', 'contacto nombre': 'name',
  
  // Teléfono
  'teléfono': 'phone', 'telefono': 'phone', 'phone': 'phone',
  'celular': 'phone', 'mobile': 'phone', 'móvil': 'phone',
  'tel': 'phone', 'teléfono celular': 'phone', 'whatsapp': 'phone',
  'número': 'phone', 'numero': 'phone', 'number': 'phone',
  
  // Email
  'email': 'email', 'correo': 'email', 'mail': 'email',
  'e-mail': 'email', 'email address': 'email', 'correo electrónico': 'email',
  
  // Empresa
  'empresa': 'company', 'company': 'company', 'organización': 'company',
  'organization': 'company', 'razón social': 'company', 'razon social': 'company',
}

/**
 * Auto-detecta y mapea columnas
 */
export function autoMapColumns(raw: RawContact[]): CleanContact[] {
  if (raw.length === 0) return []
  
  // Obtener headers del primer registro
  const headers = Object.keys(raw[0])
  
  // Mapear headers a campos
  const mappedHeaders: Record<string, keyof CleanContact> = {}
  for (const header of headers) {
    const normalized = header.toLowerCase().trim()
    const mapped = COLUMN_MAP[normalized]
    if (mapped) {
      mappedHeaders[header] = mapped
    }
  }
  
  // Si no se detectaron columnas, intentar por contenido
  if (Object.keys(mappedHeaders).length === 0) {
    return autoMapByContent(raw)
  }
  
  // Mapear contactos
  return raw.map(record => {
    const contact: CleanContact = {
      name: null,
      phone: null,
      email: null,
      company: null,
      tags: [],
      source: 'import',
      score: 0,
    }
    
    for (const [header, field] of Object.entries(mappedHeaders)) {
      const value = record[header]
      if (value && typeof value === 'string' && value.trim()) {
        (contact as any)[field] = value.trim()
      }
    }
    
    return contact
  })
}

/**
 * Auto-mapeo por contenido (cuando no hay headers reconocibles)
 */
function autoMapByContent(raw: RawContact[]): CleanContact[] {
  return raw.map(record => {
    const contact: CleanContact = {
      name: null,
      phone: null,
      email: null,
      company: null,
      tags: [],
      source: 'import',
      score: 0,
    }
    
    const values = Object.values(record).filter(v => v && typeof v === 'string')
    
    for (const value of values) {
      const str = String(value).trim()
      if (!str) continue
      
      // Detectar email
      if (str.includes('@') && str.includes('.')) {
        contact.email = str
      }
      // Detectar teléfono (números con posible +)
      else if (/^[\+]?[\d\s\-\(\)]{7,}$/.test(str)) {
        contact.phone = str
      }
      // Detectar nombre (texto sin números, más de 2 caracteres)
      else if (str.length > 2 && !/\d/.test(str) && !contact.name) {
        contact.name = str
      }
    }
    
    return contact
  })
}

/**
 * Limpia un contacto individual
 */
export function cleanContact(contact: CleanContact): CleanContact {
  // Limpiar nombre
  if (contact.name) {
    contact.name = contact.name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ'-]/gi, '')
    if (contact.name.length < 2) contact.name = null
  }
  
  // Limpiar teléfono
  if (contact.phone) {
    contact.phone = cleanPhone(contact.phone)
    if (!contact.phone || contact.phone.length < 7) contact.phone = null
  }
  
  // Limpiar email
  if (contact.email) {
    contact.email = contact.email.toLowerCase().trim()
    if (!contact.email.includes('@') || !contact.email.includes('.')) {
      contact.email = null
    }
  }
  
  // Limpiar empresa
  if (contact.company) {
    contact.company = contact.company.trim()
    if (contact.company.length < 2) contact.company = null
  }
  
  return contact
}

/**
 * Limpia y normaliza un número de teléfono
 */
export function cleanPhone(phone: string): string {
  // Remover todo excepto dígitos y +
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  // Remover + del medio si existe
  if (cleaned.indexOf('+') > 0) {
    cleaned = cleaned.replace(/\+/g, '')
  }
  
  // Si empieza con +, preservar
  const hasPlus = cleaned.startsWith('+')
  cleaned = cleaned.replace(/\D/g, '')
  
  // Normalizar formatos comunes de Argentina
  if (cleaned.startsWith('54') && cleaned.length >= 12) {
    // Ya tiene código de país
    return hasPlus ? `+${cleaned}` : cleaned
  }
  
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    // Formato local AR: 011-1234-5678 → 5491112345678
    cleaned = '549' + cleaned.substring(1)
    return hasPlus ? `+${cleaned}` : cleaned
  }
  
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    // Posible número AR sin código
    if (cleaned.length === 10) {
      cleaned = '549' + cleaned
    }
    return hasPlus ? `+${cleaned}` : cleaned
  }
  
  return hasPlus ? `+${cleaned}` : cleaned
}

/**
 * Limpia un array de contactos
 */
export function cleanContacts(contacts: CleanContact[]): CleanContact[] {
  return contacts
    .map(cleanContact)
    .filter(c => c.phone || c.email) // Al menos uno de los dos
}
