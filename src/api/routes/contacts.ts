// src/api/routes/contacts.ts
// API routes for contacts

import { Router, Request, Response, NextFunction } from 'express'
import { ContactManager } from '../../crm/contacts'
import { ContactImporter } from '../../importer/pipeline'
import { validate } from '../middleware/validate'
import { createContactSchema, updateContactSchema, listContactsSchema } from '../schemas'
import { AppError } from '../middleware/error'
import { childLogger } from '../../utils/logger'
import multer from 'multer'
import * as path from 'path'

const log = childLogger('api:contacts')

export function contactsRouter(contacts: ContactManager, importer: ContactImporter) {
  const router = Router()
  const upload = multer({ dest: '/tmp/mejora-uploads/', limits: { fileSize: 10 * 1024 * 1024 } })

  // List contacts
  router.get('/', validate(listContactsSchema, 'query'), (req: Request, res: Response) => {
    const { search, tags, minScore, whatsapp, limit, offset } = req.query as any
    const filter: any = { limit, offset }
    if (search) filter.search = search
    if (tags) filter.tags = tags.split(',').map((t: string) => t.trim())
    if (minScore !== undefined) filter.minScore = minScore
    if (whatsapp !== undefined) filter.whatsapp = whatsapp

    const results = contacts.list(filter)
    const total = contacts.count()

    res.json({
      data: results,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  })

  // Get contact by ID
  router.get('/:id', (req: Request, res: Response) => {
    const contact = contacts.get(req.params.id as string)
    if (!contact) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND')
    res.json({ data: contact })
  })

  // Get contact by phone
  router.get('/phone/:phone', (req: Request, res: Response) => {
    const contact = contacts.getByPhone(req.params.phone as string)
    if (!contact) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND')
    res.json({ data: contact })
  })

  // Create contact
  router.post('/', validate(createContactSchema), (req: Request, res: Response) => {
    const data = req.body
    const existing = contacts.getByPhone(data.phone)
    if (existing) throw new AppError(409, 'Contact already exists with this phone', 'CONTACT_EXISTS')

    // Use the insert from pipeline
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
    const tags = JSON.stringify(data.tags || [])

    // Direct DB insert since ContactManager doesn't have a create method exposed
    const db = contacts as any
    db.db.prepare(`
      INSERT INTO contacts (id, name, phone, email, company, tags, score, whatsapp, consent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name || null,
      data.phone,
      data.email || null,
      data.company || null,
      tags,
      data.score || 0,
      data.whatsapp ? 1 : 0,
      data.consent ? 1 : 0,
    )

    const created = contacts.get(id)
    log.info({ phone: data.phone }, 'Contact created')
    res.status(201).json({ data: created })
  })

  // Update contact
  router.put('/:id', validate(updateContactSchema), (req: Request, res: Response) => {
    const updated = contacts.update(req.params.id as string, req.body)
    if (!updated) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND')
    log.info({ id: req.params.id }, 'Contact updated')
    res.json({ data: updated })
  })

  // Delete contact
  router.delete('/:id', (req: Request, res: Response) => {
    const deleted = contacts.delete(req.params.id as string)
    if (!deleted) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND')
    log.info({ id: req.params.id }, 'Contact deleted')
    res.status(204).send()
  })

  // Import contacts from file
  router.post('/import', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError(400, 'No file uploaded', 'NO_FILE')

      const result = await importer.importFile(req.file.path, req.body.source)
      log.info({ imported: result.imported, duplicates: result.duplicates }, 'Import completed')
      res.json({ data: result })
    } catch (err) {
      next(err)
    }
  })

  // Contact stats
  router.get('/stats/summary', (_req: Request, res: Response) => {
    const stats = contacts.getStats()
    res.json({ data: stats })
  })

  return router
}
