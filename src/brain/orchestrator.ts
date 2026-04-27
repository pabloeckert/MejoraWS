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
  }

  /**
   * Inicia el sistema completo
   */
  async start(): Promise<void> {
    console.log('')
    console.log('╔══════════════════════════════════════════════════╗')
    console.log('║        🚀 MejoraWS — Sistema Autónomo           ║')
    console.log('╚══════════════════════════════════════════════════╝')
    console.log('')

    // 1. Verificar LLM disponible
    const llmStatus = await this.llm.getStatus()
    console.log(`🧠 LLM: ${llmStatus.active} (Groq: ${llmStatus.groq ? '✅' : '❌'} | Ollama: ${llmStatus.ollama ? '✅' : '❌'})`)

    // 2. Estado anti-ban
    console.log(`🛡️  Anti-ban: ${this.warmup.getStatus()}`)

    // 3. Registrar handlers de mensajes
    this.receiver.onMessage(async (msg: IncomingMessage) => {
      await this.handleIncomingMessage(msg)
    })

    // 4. Iniciar escucha
    this.receiver.start()

    // 5. Conectar WhatsApp
    await this.client.connect()

    this.isRunning = true
    console.log('')
    console.log('✅ Sistema iniciado. El bot responderá automáticamente.')
    console.log('')
  }

  /**
   * Maneja un mensaje entrante
   */
  private async handleIncomingMessage(msg: IncomingMessage): Promise<void> {
    // Ignorar mensajes de grupo por ahora
    if (msg.isGroup) return

    console.log(`📩 ${msg.name || msg.from}: "${msg.text}"`)

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
        console.log(`🔺 Escalado a humano: ${msg.from}`)
        // TODO: notificar al admin
      }

      console.log(`🤖 → ${msg.from}: "${response.substring(0, 60)}..." [${intent}]`)
    }
  }

  /**
   * Detiene el sistema
   */
  async stop(): Promise<void> {
    this.isRunning = false
    await this.client.disconnect()
    this.db.close()
    console.log('👋 Sistema detenido')
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
  getStatus(): {
    whatsapp: boolean
    warmup: string
    llm: string
    botActive: boolean
  } {
    return {
      whatsapp: this.client.isConnected(),
      warmup: this.warmup.getStatus(),
      llm: 'checking...',
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
