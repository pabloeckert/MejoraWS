// src/whatsapp/receiver.ts
// Recepción y procesamiento de mensajes entrantes

import { WhatsAppClient } from './client'
import { proto } from '@whiskeysockets/baileys'
import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'

export interface IncomingMessage {
  id: string
  from: string
  name?: string
  text: string
  timestamp: number
  isGroup: boolean
}

export type MessageProcessor = (msg: IncomingMessage) => void | Promise<void>

export class MessageReceiver {
  private client: WhatsAppClient
  private db: DatabaseType
  private processors: MessageProcessor[] = []

  constructor(client: WhatsAppClient, db: DatabaseType) {
    this.client = client
    this.db = db
  }

  /**
   * Inicia la escucha de mensajes
   */
  start(): void {
    this.client.onMessage(async (msg) => {
      try {
        const incoming = this.parseMessage(msg)
        if (!incoming) return

        // Guardar en DB
        this.db.prepare(`
          INSERT INTO messages (id, contact_phone, direction, content, status)
          VALUES (?, ?, 'inbound', ?, 'received')
        `).run(incoming.id, incoming.from, incoming.text)

        // Asegurar que el contacto existe
        this.ensureContact(incoming)

        // Procesar con handlers registrados
        for (const processor of this.processors) {
          try {
            await processor(incoming)
          } catch (error) {
            console.error('❌ Error en message processor:', error)
          }
        }
      } catch (error) {
        console.error('❌ Error procesando mensaje:', error)
      }
    })

    console.log('👂 Escuchando mensajes entrantes...')
  }

  /**
   * Registra un procesador de mensajes
   */
  onMessage(processor: MessageProcessor): void {
    this.processors.push(processor)
  }

  /**
   * Parsea un mensaje de Baileys a formato simplificado
   */
  private parseMessage(msg: proto.IWebMessageInfo): IncomingMessage | null {
    const { key, message, pushName, messageTimestamp } = msg
    
    if (!key || !key.remoteJid) return null

    // Extraer texto del mensaje
    let text = ''
    if (message?.conversation) {
      text = message.conversation
    } else if (message?.extendedTextMessage?.text) {
      text = message.extendedTextMessage.text
    } else if (message?.imageMessage?.caption) {
      text = message.imageMessage.caption
    } else if (message?.videoMessage?.caption) {
      text = message.videoMessage.caption
    } else if (message?.documentMessage?.caption) {
      text = message.documentMessage.caption
    } else {
      // Tipo de mensaje no soportado
      return null
    }

    if (!text.trim()) return null

    const from = key.remoteJid.replace('@s.whatsapp.net', '')
    const isGroup = key.remoteJid.includes('@g.us')

    return {
      id: generateId(),
      from,
      name: pushName || undefined,
      text: text.trim(),
      timestamp: typeof messageTimestamp === 'number' ? messageTimestamp * 1000 : Date.now(),
      isGroup,
    }
  }

  /**
   * Asegura que el contacto existe en la DB
   */
  private ensureContact(msg: IncomingMessage): void {
    const existing = this.db.prepare('SELECT id FROM contacts WHERE phone = ?').get(msg.from)
    
    if (!existing) {
      this.db.prepare(`
        INSERT INTO contacts (id, name, phone, whatsapp, source)
        VALUES (?, ?, ?, 1, 'whatsapp')
      `).run(generateId(), msg.name || null, msg.from)
    } else if (msg.name) {
      // Actualizar nombre si tenemos uno nuevo
      this.db.prepare(`
        UPDATE contacts SET name = ?, updated_at = datetime('now') WHERE phone = ?
      `).run(msg.name, msg.from)
    }
  }

  /**
   * Obtiene historial de mensajes de un contacto
   */
  getHistory(phone: string, limit: number = 50): any[] {
    return this.db.prepare(`
      SELECT * FROM messages 
      WHERE contact_phone = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(phone, limit)
  }

  /**
   * Obtiene mensajes recientes de todos los contactos
   */
  getRecent(limit: number = 20): any[] {
    return this.db.prepare(`
      SELECT m.*, c.name as contact_name
      FROM messages m
      LEFT JOIN contacts c ON m.contact_phone = c.phone
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(limit)
  }
}
