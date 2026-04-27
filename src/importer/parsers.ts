// src/importer/parsers.ts
// Parsers para diferentes formatos de archivo

import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export interface RawContact {
  [key: string]: any
}

/**
 * Detecta el formato del archivo
 */
export function detectFormat(filePath: string): 'csv' | 'xlsx' | 'vcf' | 'json' | 'unknown' {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.csv') return 'csv'
  if (ext === '.xlsx' || ext === '.xls') return 'xlsx'
  if (ext === '.vcf') return 'vcf'
  if (ext === '.json') return 'json'
  return 'unknown'
}

/**
 * Parsea un archivo CSV
 */
export function parseCSV(filePath: string): RawContact[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  return result.data as RawContact[]
}

/**
 * Parsea un archivo Excel
 */
export function parseExcel(filePath: string): RawContact[] {
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
  
  if (data.length < 2) return []
  
  // Primera fila como headers
  const headers = data[0].map((h: any) => String(h).trim().toLowerCase())
  const contacts: RawContact[] = []
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.every(cell => !cell)) continue
    
    const contact: RawContact = {}
    headers.forEach((header, idx) => {
      if (header && row[idx] !== undefined) {
        contact[header] = String(row[idx]).trim()
      }
    })
    contacts.push(contact)
  }
  
  return contacts
}

/**
 * Parsea un archivo VCF (vCard)
 */
export function parseVCF(filePath: string): RawContact[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const contacts: RawContact[] = []
  
  // Dividir por vCards
  const vcards = content.split('BEGIN:VCARD')
  
  for (const vcard of vcards) {
    if (!vcard.includes('END:VCARD')) continue
    
    const contact: RawContact = {}
    const lines = vcard.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed.startsWith('FN:') || trimmed.startsWith('FN;')) {
        contact.name = trimmed.split(':').slice(1).join(':').trim()
      } else if (trimmed.startsWith('TEL') && trimmed.includes(':')) {
        const phone = trimmed.split(':').pop()?.trim()
        if (phone) contact.phone = phone
      } else if (trimmed.startsWith('EMAIL') && trimmed.includes(':')) {
        const email = trimmed.split(':').pop()?.trim()
        if (email) contact.email = email
      } else if (trimmed.startsWith('ORG:') || trimmed.startsWith('ORG;')) {
        contact.company = trimmed.split(':').slice(1).join(':').trim()
      }
    }
    
    if (contact.phone || contact.email) {
      contacts.push(contact)
    }
  }
  
  return contacts
}

/**
 * Parsea un archivo JSON
 */
export function parseJSON(filePath: string): RawContact[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(content)
  
  // Si es un array, devolverlo directamente
  if (Array.isArray(data)) return data
  
  // Si es un objeto con una propiedad que es array, buscar contactos
  const possibleKeys = ['contacts', 'data', 'items', 'results', 'records']
  for (const key of possibleKeys) {
    if (Array.isArray(data[key])) return data[key]
  }
  
  // Si es un solo objeto, envolverlo en array
  return [data]
}

/**
 * Parsea cualquier formato soportado
 */
export function parseFile(filePath: string): RawContact[] {
  const format = detectFormat(filePath)
  
  switch (format) {
    case 'csv': return parseCSV(filePath)
    case 'xlsx': return parseExcel(filePath)
    case 'vcf': return parseVCF(filePath)
    case 'json': return parseJSON(filePath)
    default:
      throw new Error(`Formato no soportado: ${path.extname(filePath)}`)
  }
}
