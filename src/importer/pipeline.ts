// src/importer/pipeline.ts
// Pipeline de importación de contactos

import { parseFile, detectFormat } from './parsers'
import { autoMapColumns, cleanContacts, CleanContact } from './cleaner'
import { deduplicate } from './deduplicator'
import { c, status } from '../cli/theme'
import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'

export interface ImportResult {
  total: number
  imported: number
  duplicates: number
  invalid: number
  withWhatsApp: number
  errors: string[]
}

export class ContactImporter {
  private db: DatabaseType

  constructor(db: DatabaseType) {
    this.db = db
  }

  /**
   * Importa contactos desde un archivo
   */
  async importFile(filePath: string, source?: string): Promise<ImportResult> {
    const result: ImportResult = {
      total: 0,
      imported: 0,
      duplicates: 0,
      invalid: 0,
      withWhatsApp: 0,
      errors: [],
    }

    try {
      // 1. Detectar formato
      const format = detectFormat(filePath)
      console.log(status.info(`Formato detectado: ${c('bold', format)}`))

      // 2. Parsear archivo
      const raw = parseFile(filePath)
      result.total = raw.length
      console.log(c('dim', `📄 ${raw.length} registros encontrados`))

      if (raw.length === 0) {
        result.errors.push('El archivo está vacío o no tiene datos válidos')
        return result
      }

      // 3. Auto-mapear columnas
      let mapped = autoMapColumns(raw)
      console.log(c('dim', '🔀 Columnas auto-detectadas'))

      // 4. Limpiar datos
      let cleaned = cleanContacts(mapped)
      const invalidCount = mapped.length - cleaned.length
      result.invalid = invalidCount
      console.log(c('dim', `🧹 Limpieza: ${cleaned.length} válidos, ${invalidCount} inválidos`))

      // 5. Deduplicar internamente
      const beforeDedup = cleaned.length
      cleaned = deduplicate(cleaned)
      const internalDups = beforeDedup - cleaned.length
      console.log(c('dim', `🔄 Dedup interna: ${internalDups} duplicados eliminados`))

      // 6. Agregar tags de fuente
      const sourceTag = source || format
      cleaned = cleaned.map(c => ({
        ...c,
        tags: [...c.tags, `fuente:${sourceTag}`],
        source: sourceTag,
      }))

      // 7. Importar a DB (con dedup contra existentes)
      const importResult = await this.importToDB(cleaned)
      result.imported = importResult.imported
      result.duplicates = importResult.duplicates + internalDups
      result.withWhatsApp = importResult.withWhatsApp

      console.log(status.ok('Importación completada:'))
      console.log(c('brightGreen', `   📥 Importados: ${result.imported}`))
      console.log(c('yellow', `   🔄 Duplicados: ${result.duplicates}`))
      console.log(c('red', `   ❌ Inválidos: ${result.invalid}`))
      console.log(c('cyan', `   📱 Con WhatsApp: ${result.withWhatsApp}`))

    } catch (error: any) {
      result.errors.push(`Error procesando archivo: ${error.message}`)
      console.error(status.err(error.message))
    }

    return result
  }

  /**
   * Importa contactos limpios a la base de datos
   */
  private async importToDB(contacts: CleanContact[]): Promise<{
    imported: number
    duplicates: number
    withWhatsApp: number
  }> {
    let imported = 0
    let duplicates = 0
    let withWhatsApp = 0

    const insert = this.db.prepare(`
      INSERT INTO contacts (id, name, phone, email, company, tags, score, source, whatsapp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = COALESCE(excluded.name, contacts.name),
        email = COALESCE(excluded.email, contacts.email),
        company = COALESCE(excluded.company, contacts.company),
        tags = contacts.tags || ',' || excluded.tags,
        score = MAX(contacts.score, excluded.score),
        updated_at = datetime('now')
    `)

    const insertMany = this.db.transaction((items: CleanContact[]) => {
      for (const contact of items) {
        if (!contact.phone && !contact.email) continue

        try {
          const id = generateId()
          const tags = JSON.stringify(contact.tags)
          const hasWhatsApp = contact.phone ? 1 : 0 // Simplificado: asumimos que si tiene phone tiene WA

          const result = insert.run(
            id,
            contact.name,
            contact.phone,
            contact.email,
            contact.company,
            tags,
            contact.score,
            contact.source,
            hasWhatsApp
          )

          if (result.changes > 0) {
            imported++
            if (hasWhatsApp) withWhatsApp++
          } else {
            duplicates++
          }
        } catch (error: any) {
          if (error.message.includes('UNIQUE constraint')) {
            duplicates++
          } else {
            console.error(c('yellow', `   ⚠️ Error importando ${contact.phone || contact.email}: ${error.message}`))
          }
        }
      }
    })

    insertMany(contacts)
    return { imported, duplicates, withWhatsApp }
  }

  /**
   * Importa desde string CSV (útil para testing)
   */
  async importFromCSVString(csv: string, source?: string): Promise<ImportResult> {
    // Crear archivo temporal
    const tmpPath = `/tmp/mejora-import-${Date.now()}.csv`
    require('fs').writeFileSync(tmpPath, csv)
    
    try {
      return await this.importFile(tmpPath, source)
    } finally {
      require('fs').unlinkSync(tmpPath)
    }
  }

  /**
   * Exporta contactos a CSV
   */
  exportToCSV(): string {
    const contacts = this.db.prepare(`
      SELECT * FROM contacts ORDER BY created_at DESC
    `).all() as any[]

    if (contacts.length === 0) return ''

    const headers = Object.keys(contacts[0])
    const rows = contacts.map(c => 
      headers.map(h => {
        const val = c[h]
        if (val === null || val === undefined) return ''
        const str = String(val)
        return str.includes(',') ? `"${str}"` : str
      }).join(',')
    )

    return [headers.join(','), ...rows].join('\n')
  }
}
