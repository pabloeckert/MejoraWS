// src/brain/orchestrator.ts
// Orchestrator — Coordinador central de MejoraWS

import { WhatsAppClient } from '../whatsapp/client'
import { MessageSender } from '../whatsapp/sender'
import { MessageReceiver, IncomingMessage } from '../whatsapp/receiver'
import { AutoReplyEngine, BotConfig } from './auto-reply'
import { WarmupManager } from '../antiban/warmup'
import { LLMManager } from '../llm'
import { initDatabase } from '../db/database'
import { loadConfig } from '../config'
import { ContactImporter } from '../importer/pipeline'
import { ContactManager } from '../crm/contacts'
import { DealManager } from '../crm/deals'
import { CampaignEngine } from '../campaigns/engine'
import { CampaignScheduler } from '../campaigns/scheduler'
import { AuditLogger } from '../security/audit'
import { DataRetention } from '../security/retention'
import { c, status, box } from '../cli/theme'
import Database from 'better-sqlite3'

export class Orchestrator {
  private client: WhatsAppClient
  private sender: MessageSender
  private receiver: MessageReceiver
  private autoReply: AutoReplyEngine
  private warmup: WarmupManager
  private llm: LLMManager
  private db: Database.Database
  private config: ReturnType<typeof loadConfig>
  private isRunning: boolean = false

  // CRM
  public contacts: ContactManager
  public deals: DealManager
  public importer: ContactImporter

  // Campaigns
  public campaigns: CampaignEngine
  public campaignScheduler: CampaignScheduler

  // Security
  public audit: AuditLogger
  public retention: DataRetention

  constructor() {
    this.config = loadConfig()
    this.db = initDatabase(this.config.dbPath)
    this.warmup = new WarmupManager()
    this.llm = new LLMManager()
    this.client = new WhatsAppClient(this.config.sessionPath)
    this.sender = new MessageSender(this.client, this.warmup, this.db)
    this.receiver = new MessageReceiver(this.client, this.db)
    this.autoReply = new AutoReplyEngine(this.llm, this.db)
    
    // CRM
    this.contacts = new ContactManager(this.db)
    this.deals = new DealManager(this.db)
    this.importer = new ContactImporter(this.db)

    // Campaigns
    this.campaigns = new CampaignEngine(
      this.db,
      (to: string, text: string, campaignId?: string) => this.sender.send(to, text, campaignId),
      this.warmup,
    )
    this.campaignScheduler = new CampaignScheduler(this.campaigns, this.contacts)

    // Security
    this.audit = new AuditLogger(this.db)
    this.retention = new DataRetention(this.db)
  }

  /**
   * Inicia el sistema completo
   */
  async start(): Promise<void> {
    console.log('')
    console.log(box('🚀 MejoraWS — Sistema Autónomo', '', { color: 'brightCyan' }))

    // 1. Verificar LLM disponible
    const llmStatus = await this.llm.getStatus()
    const groqIcon = llmStatus.groq ? c('green', '✓') : c('red', '✗')
    const ollamaIcon = llmStatus.ollama ? c('green', '✓') : c('red', '✗')
    console.log(`  ${c('bold', '🧠 LLM:')} ${c('cyan', llmStatus.active)} (Groq: ${groqIcon} | Ollama: ${ollamaIcon})`)

    // 2. Estado anti-ban
    console.log(`  ${c('bold', '🛡️  Anti-ban:')} ${c('yellow', this.warmup.getStatus())}`)

    // 3. Registrar handlers de mensajes
    this.receiver.onMessage(async (msg: IncomingMessage) => {
      await this.handleIncomingMessage(msg)
    })

    // 4. Iniciar escucha
    this.receiver.start()

    // 5. Conectar WhatsApp
    await this.client.connect()

    // 6. Iniciar campaign scheduler
    this.campaignScheduler.start()

    this.isRunning = true
    console.log('')
    console.log(status.success('Sistema iniciado. El bot responderá automáticamente.'))
    console.log('')
  }

  /**
   * Maneja un mensaje entrante
   */
  private async handleIncomingMessage(msg: IncomingMessage): Promise<void> {
    // Ignorar mensajes de grupo por ahora
    if (msg.isGroup) return

    console.log(`  ${c('brightCyan', '📩')} ${c('bold', msg.name || msg.from)}: ${c('white', `"${msg.text}"`)}`)

    // Generar respuesta con el bot
    const { response, escalated, intent } = await this.autoReply.handleMessage(
      msg.from,
      msg.text,
      msg.name
    )

    // Enviar respuesta
    if (response) {
      await this.sender.send(msg.from, response)
      
      if (escalated) {
        console.log(`  ${c('brightYellow', '🔺')} Escalado a humano: ${c('yellow', msg.from)}`)
      }

      const intentColor = intent === 'COMPRA' ? 'brightGreen' : intent === 'QUEJA' ? 'red' : 'dim'
      console.log(`  ${c('brightMagenta', '🤖')} → ${c('dim', msg.from)}: ${c('dim', `"${response.substring(0, 50)}..."`)} ${c(intentColor, `[${intent}]`)}`)
    }
  }

  /**
   * Detiene el sistema
   */
  async stop(): Promise<void> {
    this.isRunning = false
    this.campaignScheduler.stop()
    await this.client.disconnect()
    this.db.close()
    console.log(status.warn('Sistema detenido'))
  }

  /**
   * Envía un mensaje manual (para CLI)
   */
  async sendMessage(to: string, text: string): Promise<boolean> {
    return this.sender.send(to, text)
  }

  /**
   * Obtiene el estado del sistema
   */
  async getStatus(): Promise<{
    whatsapp: boolean
    warmup: string
    llm: { groq: boolean; ollama: boolean; active: string }
    botActive: boolean
  }> {
    const llmStatus = await this.llm.getStatus()
    return {
      whatsapp: this.client.isConnected(),
      warmup: this.warmup.getStatus(),
      llm: llmStatus,
      botActive: this.isRunning,
    }
  }

  /**
   * Obtiene estadísticas de envío
   */
  getSendStats() {
    return this.sender.getStats()
  }

  /**
   * Acceso al receiver para historial
   */
  getReceiver(): MessageReceiver {
    return this.receiver
  }

  /**
   * Acceso al auto-reply para configuración
   */
  getAutoReply(): AutoReplyEngine {
    return this.autoReply
  }

  /**
   * Acceso a la DB
   */
  getDB(): Database.Database {
    return this.db
  }

  /**
   * Actualiza la knowledge base del bot
   */
  setKnowledgeBase(kb: string): void {
    this.autoReply.setKnowledgeBase(kb)
  }

  /**
   * Actualiza la configuración del bot
   */
  updateBotConfig(config: Partial<BotConfig>): void {
    this.autoReply.updateConfig(config)
  }
}
