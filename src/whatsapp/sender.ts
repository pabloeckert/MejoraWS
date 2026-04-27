// src/whatsapp/sender.ts
// Envío de mensajes con protección anti-ban

import { WhatsAppClient } from './client'
import { WarmupManager } from '../antiban/warmup'
import { gaussianDelay, typingDelay, sleep, isWithinSchedule } from '../antiban/rate-limiter'
import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'

export class MessageSender {
  private client: WhatsAppClient
  private warmup: WarmupManager
  private db: DatabaseType
  private messageCount: number = 0

  constructor(client: WhatsAppClient, warmup: WarmupManager, db: DatabaseType) {
    this.client = client
    this.warmup = warmup
    this.db = db
  }

  /**
   * Envía un mensaje con protección anti-ban completa
   */
  async send(to: string, text: string, campaignId?: string): Promise<boolean> {
    // 1. Verificar horario laboral
    const hour = new Date().getHours()
    if (!isWithinSchedule(hour)) {
      console.log('⏰ Fuera de horario laboral. No se envía.')
      return false
    }

    // 2. Verificar warm-up
    if (!this.warmup.canSend()) {
      console.log(`🛑 Límite diario alcanzado (${this.warmup.getDailyLimit()}). No se envía.`)
      return false
    }

    // 3. Verificar conexión
    if (!this.client.isConnected()) {
      console.log('❌ WhatsApp no conectado. No se envía.')
      return false
    }

    try {
      // 4. Delay humano (Gaussian)
      const delay = gaussianDelay()
      console.log(`⏳ Esperando ${(delay / 1000).toFixed(1)}s (anti-ban)...`)
      await sleep(delay)

      // 5. Typing indicator
      const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`
      await this.client.sendTyping(to)
      
      // 6. Simular tiempo de escritura
      const typingTime = typingDelay()
      await sleep(typingTime)
      
      // 7. Enviar mensaje
      await this.client.sendMessage(to, text)
      await this.client.stopTyping(to)

      // 8. Registrar en warm-up
      this.warmup.recordSend()
      this.messageCount++

      // 9. Guardar en DB
      this.db.prepare(`
        INSERT INTO messages (id, contact_phone, direction, content, status, campaign_id)
        VALUES (?, ?, 'outbound', ?, 'sent', ?)
      `).run(generateId(), to, text, campaignId || null)

      console.log(`✅ Enviado a ${to} (${this.warmup.getSentToday()}/${this.warmup.getDailyLimit()} hoy)`)

      // 10. Pausa cada N mensajes
      if (this.messageCount % 10 === 0) {
        const pauseMs = 120000 + Math.floor(Math.random() * 180000) // 2-5 min
        console.log(`⏸️ Pausa de ${(pauseMs / 1000 / 60).toFixed(1)} min (cada 10 mensajes)...`)
        await sleep(pauseMs)
      }

      return true
    } catch (error) {
      console.error(`❌ Error enviando a ${to}:`, error)
      
      // Registrar fallo
      this.db.prepare(`
        INSERT INTO messages (id, contact_phone, direction, content, status)
        VALUES (?, ?, 'outbound', ?, 'failed')
      `).run(generateId(), to, text)
      
      return false
    }
  }

  /**
   * Envía un lote de mensajes (para campañas)
   */
  async sendBatch(
    messages: Array<{ to: string; text: string }>,
    campaignId?: string
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0
    let failed = 0

    for (const msg of messages) {
      if (!this.warmup.canSend()) {
        console.log(`🛑 Límite alcanzado. ${messages.length - sent - failed} mensajes pendientes.`)
        break
      }

      const success = await this.send(msg.to, msg.text, campaignId)
      if (success) {
        sent++
      } else {
        failed++
      }
    }

    console.log(`📊 Lote completado: ${sent} enviados, ${failed} fallidos`)
    return { sent, failed }
  }

  /**
   * Obtiene estadísticas de envío
   */
  getStats(): { sentToday: number; dailyLimit: number; warmupDay: number; warmupProgress: number } {
    return {
      sentToday: this.warmup.getSentToday(),
      dailyLimit: this.warmup.getDailyLimit(),
      warmupDay: this.warmup.getCurrentDay(),
      warmupProgress: this.warmup.getWarmupProgress(),
    }
  }
}
