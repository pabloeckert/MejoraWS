// src/server.ts
// Entry point de MejoraWS — CRM WhatsApp Autónomo con IA

import { Orchestrator } from './brain/orchestrator'
import * as readline from 'readline'

async function main() {
  const orchestrator = new Orchestrator()

  // Manejar cierre graceful
  process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando...')
    await orchestrator.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await orchestrator.stop()
    process.exit(0)
  })

  // Iniciar sistema
  await orchestrator.start()

  // CLI interactivo
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '🚀 mejoraws> ',
  })

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  Comandos:                                       ║')
  console.log('║    /enviar <número> <mensaje>  — Enviar mensaje  ║')
  console.log('║    /estado                     — Ver estado      ║')
  console.log('║    /historial <número>         — Ver historial   ║')
  console.log('║    /contactos                  — Listar contactos║')
  console.log('║    /kb <texto>                 — Knowledge base  ║')
  console.log('║    /config                     — Ver config bot  ║')
  console.log('║    /ayuda                      — Ver comandos    ║')
  console.log('║    /salir                      — Desconectar     ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log('')

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
        const success = await orchestrator.sendMessage(to, text)
        console.log(success ? '✅ Enviado' : '❌ Error al enviar')
      }
    } else if (input === '/estado') {
      const status = orchestrator.getStatus()
      const stats = orchestrator.getSendStats()
      console.log('')
      console.log('📊 Estado de MejoraWS:')
      console.log(`   WhatsApp: ${status.whatsapp ? '🟢 Conectado' : '🔴 Desconectado'}`)
      console.log(`   Bot: ${status.botActive ? '🟢 Activo' : '🔴 Inactivo'}`)
      console.log(`   Anti-ban: ${status.warmup}`)
      console.log(`   Enviados hoy: ${stats.sentToday}/${stats.dailyLimit}`)
      console.log(`   Warm-up: día ${stats.warmupDay}/14 (${stats.warmupProgress}%)`)
      console.log('')
    } else if (input.startsWith('/historial ')) {
      const phone = input.slice(11).trim()
      const history = orchestrator.getReceiver().getHistory(phone, 10)
      console.log('')
      console.log(`📜 Historial de ${phone}:`)
      if (history.length === 0) {
        console.log('   Sin mensajes')
      } else {
        for (const msg of history) {
          const dir = msg.direction === 'inbound' ? '📩' : '📤'
          console.log(`   ${dir} [${msg.created_at}] ${msg.content.substring(0, 80)}`)
        }
      }
      console.log('')
    } else if (input === '/contactos') {
      const contacts = orchestrator.getDB().prepare(`
        SELECT phone, name, whatsapp, score FROM contacts ORDER BY created_at DESC LIMIT 20
      `).all() as any[]
      console.log('')
      console.log(`📇 Contactos (${contacts.length}):`)
      if (contacts.length === 0) {
        console.log('   Sin contactos aún')
      } else {
        for (const c of contacts) {
          console.log(`   ${c.phone} | ${c.name || 'Sin nombre'} | WA: ${c.whatsapp ? '✅' : '❌'} | Score: ${c.score}`)
        }
      }
      console.log('')
    } else if (input.startsWith('/kb ')) {
      const kb = input.slice(4).trim()
      orchestrator.setKnowledgeBase(kb)
      console.log('✅ Knowledge base actualizada')
    } else if (input === '/config') {
      const config = orchestrator.getAutoReply().getConfig()
      console.log('')
      console.log('⚙️  Configuración del bot:')
      console.log(`   Nombre: ${config.name}`)
      console.log(`   Personalidad: ${config.personality.substring(0, 60)}...`)
      console.log(`   Tono: ${config.tone}`)
      console.log(`   Horario: ${config.schedule.start}:00 - ${config.schedule.end}:00`)
      console.log(`   Escalamiento keywords: ${config.escalation.keywords.join(', ')}`)
      console.log('')
    } else if (input === '/ayuda') {
      console.log('')
      console.log('📋 Comandos disponibles:')
      console.log('   /enviar <número> <mensaje>  — Enviar mensaje')
      console.log('   /estado                     — Ver estado del sistema')
      console.log('   /historial <número>         — Ver historial de un contacto')
      console.log('   /contactos                  — Listar contactos')
      console.log('   /kb <texto>                 — Actualizar knowledge base')
      console.log('   /config                     — Ver config del bot')
      console.log('   /ayuda                      — Ver esta ayuda')
      console.log('   /salir                      — Desconectar y salir')
      console.log('')
    } else if (input === '/salir') {
      console.log('👋 Desconectando...')
      await orchestrator.stop()
      process.exit(0)
    } else if (input.startsWith('/')) {
      console.log(`❌ Comando desconocido: ${input}. Escribí /ayuda`)
    } else if (input) {
      console.log('💡 Escribí /enviar <número> <mensaje> para enviar un mensaje')
    }
    
    rl.prompt()
  }).on('close', async () => {
    await orchestrator.stop()
    process.exit(0)
  })
}

// Ejecutar
main().catch((error) => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})
