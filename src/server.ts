// src/server.ts
// Entry point de MejoraWS — CRM WhatsApp Autónomo con IA

import { WhatsAppClient } from './whatsapp/client'
import { MessageSender } from './whatsapp/sender'
import { MessageReceiver, IncomingMessage } from './whatsapp/receiver'
import { WarmupManager } from './antiban/warmup'
import { initDatabase } from './db/database'
import { loadConfig } from './config'
import * as readline from 'readline'

async function main() {
  console.log('')
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║        🚀 MejoraWS — CRM WhatsApp Autónomo      ║')
  console.log('║           con IA · Anti-ban · $0                 ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log('')

  // 1. Cargar configuración
  const config = loadConfig()
  console.log('⚙️  Configuración cargada')

  // 2. Inicializar base de datos
  const db = initDatabase(config.dbPath)
  console.log('💾 Base de datos lista')

  // 3. Inicializar anti-ban
  const warmup = new WarmupManager()
  console.log(`🛡️  Anti-ban: ${warmup.getStatus()}`)

  // 4. Conectar WhatsApp
  const client = new WhatsAppClient(config.sessionPath)
  
  // Estado de conexión
  client.onConnection((state) => {
    if (state === 'connected') {
      console.log('')
      console.log('╔══════════════════════════════════════════════════╗')
      console.log('║  ✅ WhatsApp conectado — Listo para operar       ║')
      console.log('║                                                  ║')
      console.log('║  Comandos:                                       ║')
      console.log('║    /enviar <número> <mensaje>  — Enviar mensaje  ║')
      console.log('║    /estado                     — Ver estado      ║')
      console.log('║    /historial <número>         — Ver historial   ║')
      console.log('║    /ayuda                      — Ver comandos    ║')
      console.log('║    /salir                      — Desconectar     ║')
      console.log('╚══════════════════════════════════════════════════╝')
      console.log('')
    }
  })

  // 5. Inicializar sender y receiver
  const sender = new MessageSender(client, warmup, db)
  const receiver = new MessageReceiver(client, db)

  // 6. Registrar handler de mensajes entrantes
  receiver.onMessage(async (msg: IncomingMessage) => {
    console.log('')
    console.log(`📩 Mensaje de ${msg.name || msg.from}:`)
    console.log(`   "${msg.text}"`)
    console.log(`   Hora: ${new Date(msg.timestamp).toLocaleTimeString()}`)
    console.log('')
    
    // Por ahora solo logueamos. En Etapa 2: auto-reply
  })

  // 7. Iniciar escucha de mensajes
  receiver.start()

  // 8. Conectar
  await client.connect()

  // 9. CLI interactivo
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '🚀 mejoraws> ',
  })

  rl.prompt()

  rl.on('line', async (line) => {
    const input = line.trim()
    
    if (input.startsWith('/enviar ')) {
      const parts = input.slice(8).split(' ')
      const to = parts[0]
      const text = parts.slice(1).join(' ')
      
      if (!to || !text) {
        console.log('❌ Uso: /enviar <número> <mensaje>')
        console.log('   Ejemplo: /enviar 5491112345678 Hola, ¿cómo estás?')
      } else {
        await sender.send(to, text)
      }
    } else if (input === '/estado') {
      console.log('')
      console.log('📊 Estado de MejoraWS:')
      console.log(`   WhatsApp: ${client.isConnected() ? '🟢 Conectado' : '🔴 Desconectado'}`)
      console.log(`   Anti-ban: ${warmup.getStatus()}`)
      console.log(`   Día warm-up: ${warmup.getCurrentDay()}/14`)
      console.log(`   Progreso: ${warmup.getWarmupProgress()}%`)
      console.log('')
    } else if (input.startsWith('/historial ')) {
      const phone = input.slice(11).trim()
      const history = receiver.getHistory(phone, 10)
      console.log('')
      console.log(`📜 Historial de ${phone}:`)
      if (history.length === 0) {
        console.log('   Sin mensajes')
      } else {
        for (const msg of history) {
          const dir = msg.direction === 'inbound' ? '📩' : '📤'
          console.log(`   ${dir} [${msg.created_at}] ${msg.content}`)
        }
      }
      console.log('')
    } else if (input === '/ayuda') {
      console.log('')
      console.log('📋 Comandos disponibles:')
      console.log('   /enviar <número> <mensaje>  — Enviar mensaje')
      console.log('   /estado                     — Ver estado del sistema')
      console.log('   /historial <número>         — Ver historial de un contacto')
      console.log('   /contactos                  — Listar contactos')
      console.log('   /ayuda                      — Ver esta ayuda')
      console.log('   /salir                      — Desconectar y salir')
      console.log('')
    } else if (input === '/salir') {
      console.log('👋 Desconectando...')
      await client.disconnect()
      db.close()
      process.exit(0)
    } else if (input.startsWith('/')) {
      console.log(`❌ Comando desconocido: ${input}. Escribí /ayuda`)
    } else if (input) {
      console.log('💡 Escribí /enviar <número> <mensaje> para enviar un mensaje')
    }
    
    rl.prompt()
  }).on('close', async () => {
    await client.disconnect()
    db.close()
    process.exit(0)
  })
}

// Ejecutar
main().catch((error) => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})
