// src/importer/deduplicator.ts
// Deduplicación de contactos (exacto + fuzzy)

import { CleanContact } from './cleaner'
import { c } from '../cli/theme'

/**
 * Deduplica contactos por teléfono (exacto)
 */
export function deduplicateByPhone(contacts: CleanContact[]): CleanContact[] {
  const seen = new Map<string, CleanContact>()
  
  for (const contact of contacts) {
    if (!contact.phone) {
      // Sin teléfono, mantener si no hay otro igual
      const key = `_no_phone_${contact.email || contact.name || Math.random()}`
      if (!seen.has(key)) seen.set(key, contact)
      continue
    }
    
    const normalizedPhone = normalizePhone(contact.phone)
    
    if (seen.has(normalizedPhone)) {
      // Merge con el existente
      const existing = seen.get(normalizedPhone)!
      seen.set(normalizedPhone, mergeContacts(existing, contact))
    } else {
      seen.set(normalizedPhone, { ...contact })
    }
  }
  
  return Array.from(seen.values())
}

/**
 * Deduplica contactos por email (exacto)
 */
export function deduplicateByEmail(contacts: CleanContact[]): CleanContact[] {
  const seen = new Map<string, CleanContact>()
  const noEmail: CleanContact[] = []
  
  for (const contact of contacts) {
    if (!contact.email) {
      noEmail.push(contact)
      continue
    }
    
    const normalizedEmail = contact.email.toLowerCase().trim()
    
    if (seen.has(normalizedEmail)) {
      const existing = seen.get(normalizedEmail)!
      seen.set(normalizedEmail, mergeContacts(existing, contact))
    } else {
      seen.set(normalizedEmail, { ...contact })
    }
  }
  
  return [...Array.from(seen.values()), ...noEmail]
}

/**
 * Deduplica por nombre usando Jaro-Winkler similarity
 */
export function deduplicateByName(contacts: CleanContact[], threshold: number = 0.9): CleanContact[] {
  const result: CleanContact[] = []
  const used = new Set<number>()
  
  for (let i = 0; i < contacts.length; i++) {
    if (used.has(i)) continue
    
    let merged = { ...contacts[i] }
    
    if (merged.name) {
      for (let j = i + 1; j < contacts.length; j++) {
        if (used.has(j)) continue
        
        const other = contacts[j]
        if (!other.name || !merged.name) continue
        
        const similarity = jaroWinkler(
          merged.name.toLowerCase(),
          other.name.toLowerCase()
        )
        
        if (similarity >= threshold) {
          merged = mergeContacts(merged, other)
          used.add(j)
        }
      }
    }
    
    result.push(merged)
    used.add(i)
  }
  
  return result
}

/**
 * Deduplicación completa (teléfono + email + nombre fuzzy)
 */
export function deduplicate(contacts: CleanContact[]): CleanContact[] {
  let result = contacts
  const before = result.length
  
  // 1. Dedup por teléfono
  result = deduplicateByPhone(result)
  
  // 2. Dedup por email
  result = deduplicateByEmail(result)
  
  // 3. Dedup por nombre (fuzzy)
  result = deduplicateByName(result)
  
  const removed = before - result.length
  if (removed > 0) {
    console.log(c('dim', `🔄 Deduplicación: ${before} → ${result.length} (${removed} duplicados eliminados)`))
  }
  
  return result
}

/**
 * Normaliza un teléfono para comparación
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0+/, '')
}

/**
 * Merge dos contactos (prioriza datos más completos)
 */
function mergeContacts(a: CleanContact, b: CleanContact): CleanContact {
  return {
    name: a.name || b.name,
    phone: a.phone || b.phone,
    email: a.email || b.email,
    company: a.company || b.company,
    tags: [...new Set([...a.tags, ...b.tags])],
    source: a.source || b.source,
    score: Math.max(a.score, b.score),
  }
}

/**
 * Algoritmo Jaro-Winkler para similitud de strings
 */
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1
  
  const len1 = s1.length
  const len2 = s2.length
  
  if (len1 === 0 || len2 === 0) return 0
  
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1
  if (matchWindow < 0) return 0
  
  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)
  
  let matches = 0
  let transpositions = 0
  
  // Encontrar matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, len2)
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }
  
  if (matches === 0) return 0
  
  // Contar transposiciones
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }
  
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  
  // Winkler modification
  let prefix = 0
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }
  
  return jaro + prefix * 0.1 * (1 - jaro)
}
