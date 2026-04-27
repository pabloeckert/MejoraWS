// src/whatsapp/client.ts
// Conexión WhatsApp con Baileys

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  proto,
} from '@whiskeysockets/baileys'
import * as path from 'path'
import * as fs from 'fs'
import { Boom } from '@hapi/boom'

export type MessageHandler = (msg: proto.IWebMessageInfo) => void | Promise<void>

export class WhatsAppClient {
  private sock: WASocket | null = null
  private sessionPath: string
  private messageHandlers: MessageHandler[] = []
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected'
  private onConnectionChange?: (state: string) => void

  constructor(sessionPath: string = './data/session') {
    this.sessionPath = sessionPath
  }

  /**
   * Conecta a WhatsApp
   */
  async connect(): Promise<void> {
    // Asegurar directorio de sesión
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath)

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['MejoraWS', 'Chrome', '120.0'],
      logger: {
        level: 'silent',
        child: () => ({
          level: 'silent',
          child: () => ({ level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {} }),
          trace: () => {},
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          fatal: () => {},
        }),
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
      } as any,
    })

    // Guardar credenciales cuando se actualicen
    this.sock.ev.on('creds.update', saveCreds)

    // Manejar cambios de conexión
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        console.log('📱 Escaneá el QR code con tu teléfono')
        this.connectionState = 'connecting'
        this.onConnectionChange?.('connecting')
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
        
        console.log(`❌ Conexión cerrada. Status: ${statusCode}`)
        this.connectionState = 'disconnected'
        this.onConnectionChange?.('disconnected')
        
        if (shouldReconnect) {
          console.log('🔄 Reconectando...')
          setTimeout(() => this.connect(), 5000)
        } else {
          console.log('⚠️ Sesión cerrada. Escaneá QR nuevamente.')
          // Limpiar sesión
          if (fs.existsSync(this.sessionPath)) {
            fs.rmSync(this.sessionPath, { recursive: true })
          }
          setTimeout(() => this.connect(), 3000)
        }
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp conectado!')
        this.connectionState = 'connected'
        this.onConnectionChange?.('connected')
      }
    })

    // Manejar mensajes entrantes
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return

      for (const msg of messages) {
        // Ignorar mensajes de status y de uno mismo
        if (msg.key.fromMe) continue
        if (msg.key.remoteJid === 'status@broadcast') continue
        
        for (const handler of this.messageHandlers) {
          try {
            await handler(msg)
          } catch (error) {
            console.error('❌ Error en message handler:', error)
          }
        }
      }
    })

    console.log('⏳ Conectando a WhatsApp...')
  }

  /**
   * Registra un handler para mensajes entrantes
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler)
  }

  /**
   * Registra callback para cambios de conexión
   */
  onConnection(callback: (state: string) => void): void {
    this.onConnectionChange = callback
  }

  /**
   * Envía un mensaje de texto
   */
  async sendMessage(to: string, text: string): Promise<void> {
    if (!this.sock || this.connectionState !== 'connected') {
      throw new Error('WhatsApp no conectado')
    }

    // Normalizar JID
    const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`
    
    await this.sock.sendMessage(jid, { text })
  }

  /**
   * Envía indicador de typing
   */
  async sendTyping(to: string): Promise<void> {
    if (!this.sock) return
    const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`
    await this.sock.sendPresenceUpdate('composing', jid)
  }

  /**
   * Detiene indicador de typing
   */
  async stopTyping(to: string): Promise<void> {
    if (!this.sock) return
    const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`
    await this.sock.sendPresenceUpdate('paused', jid)
  }

  /**
   * Obtiene el estado de conexión
   */
  getConnectionState(): string {
    return this.connectionState
  }

  /**
   * Verifica si está conectado
   */
  isConnected(): boolean {
    return this.connectionState === 'connected'
  }

  /**
   * Obtiene el socket (uso interno)
   */
  getSocket(): WASocket | null {
    return this.sock
  }

  /**
   * Desconecta
   */
  async disconnect(): Promise<void> {
    if (this.sock) {
      this.sock.end(undefined)
      this.sock = null
      this.connectionState = 'disconnected'
      console.log('👋 WhatsApp desconectado')
    }
  }
}
