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

  printHelp()
  rl.prompt()

  rl.on('line', async (line) => {
    const input = line.trim()
    
    // === COMUNICACIÓN ===
    if (input.startsWith('/enviar ')) {
      const parts = input.slice(8).split(' ')
      const to = parts[0]
      const text = parts.slice(1).join(' ')
      
      if (!to || !text) {
        console.log('❌ Uso: /enviar <número> <mensaje>')
      } else {
        const success = await orchestrator.sendMessage(to, text)
        console.log(success ? '✅ Enviado' : '❌ Error al enviar')
      }
    }
    
    // === ESTADO ===
    else if (input === '/estado') {
      const status = orchestrator.getStatus()
      const stats = orchestrator.getSendStats()
      const contactStats = orchestrator.contacts.getStats()
      const dealStats = orchestrator.deals.getStats()
      console.log('')
      console.log('📊 ═══════════ ESTADO DE MEJORAWS ═══════════')
      console.log(`   WhatsApp: ${status.whatsapp ? '🟢 Conectado' : '🔴 Desconectado'}`)
      console.log(`   Bot: ${status.botActive ? '🟢 Activo' : '🔴 Inactivo'}`)
      console.log(`   Anti-ban: ${status.warmup}`)
      console.log(`   Enviados hoy: ${stats.sentToday}/${stats.dailyLimit}`)
      console.log(`   Warm-up: día ${stats.warmupDay}/14 (${stats.warmupProgress}%)`)
      console.log('')
      console.log('📇 Contactos:')
      console.log(`   Total: ${contactStats.total} | WhatsApp: ${contactStats.withWhatsApp} | Email: ${contactStats.withEmail}`)
      console.log(`   Score promedio: ${contactStats.avgScore}`)
      console.log('')
      console.log('🎯 Pipeline:')
      console.log(`   Abiertos: ${dealStats.open} | Ganados: ${dealStats.closedWon} | Perdidos: ${dealStats.closedLost}`)
      console.log(`   Valor total: $${dealStats.totalValue} | Conversión: ${dealStats.conversionRate}%`)
      console.log('═══════════════════════════════════════════════')
      console.log('')
    }
    
    // === HISTORIAL ===
    else if (input.startsWith('/historial ')) {
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
    }
    
    // === CONTACTOS ===
    else if (input === '/contactos') {
      const contacts = orchestrator.contacts.list({ limit: 20 })
      console.log('')
      console.log(`📇 Contactos (${contacts.length}):`)
      if (contacts.length === 0) {
        console.log('   Sin contactos. Usá /importar <archivo>')
      } else {
        for (const c of contacts) {
          const tags = c.tags.length > 0 ? ` [${c.tags.join(', ')}]` : ''
          console.log(`   ${c.phone} | ${c.name || 'Sin nombre'} | WA: ${c.whatsapp ? '✅' : '❌'} | Score: ${c.score}${tags}`)
        }
      }
      console.log('')
    }
    
    // === IMPORTAR ===
    else if (input.startsWith('/importar ')) {
      const filePath = input.slice(10).trim()
      if (!filePath) {
        console.log('❌ Uso: /importar <ruta/archivo.csv|json|xlsx|vcf>')
      } else {
        try {
          const result = await orchestrator.importer.importFile(filePath)
          console.log('')
          console.log(`📥 Resultado: ${result.imported} importados, ${result.duplicates} duplicados, ${result.invalid} inválidos`)
          console.log('')
        } catch (error: any) {
          console.log(`❌ Error: ${error.message}`)
        }
      }
    }
    
    // === DEALS / PIPELINE ===
    else if (input === '/pipeline') {
      const pipeline = orchestrator.deals.getPipeline()
      console.log('')
      console.log('🎯 ═══════════ PIPELINE ═══════════')
      for (const stage of pipeline.stages) {
        const bar = '█'.repeat(Math.min(20, stage.count))
        console.log(`   ${stage.stage.padEnd(16)} ${String(stage.count).padStart(3)} deals │ $${stage.value.toLocaleString()} │ ${bar}`)
      }
      console.log(`   ${'─'.repeat(50)}`)
      console.log(`   Total: ${pipeline.totalDeals} deals │ $${pipeline.totalValue.toLocaleString()}`)
      console.log('═══════════════════════════════════════')
      console.log('')
    }
    
    else if (input.startsWith('/deal ')) {
      const parts = input.slice(6).split(' ')
      const phone = parts[0]
      const value = parts[1] ? parseFloat(parts[1]) : undefined
      
      if (!phone) {
        console.log('❌ Uso: /deal <número> [valor]')
      } else {
        const deal = orchestrator.deals.create(phone, value)
        console.log(`✅ Deal creado: ${deal.id} (etapa: ${deal.stage})`)
      }
    }
    
    else if (input.startsWith('/mover ')) {
      const parts = input.slice(7).split(' ')
      const dealId = parts[0]
      const stage = parts[1]
      
      if (!dealId || !stage) {
        console.log('❌ Uso: /mover <deal-id> <etapa>')
        console.log('   Etapas: nuevo, contactado, interesado, propuesta, negociacion, cerrado-ganado, cerrado-perdido')
      } else {
        try {
          const deal = orchestrator.deals.moveStage(dealId, stage)
          console.log(`✅ Deal movido a: ${deal?.stage}`)
        } catch (error: any) {
          console.log(`❌ ${error.message}`)
        }
      }
    }
    
    // === FOLLOW-UPS ===
    else if (input === '/followups') {
      const pending = orchestrator.deals.getPendingFollowUps()
      console.log('')
      console.log(`⏰ Follow-ups pendientes (${pending.length}):`)
      if (pending.length === 0) {
        console.log('   Sin follow-ups pendientes')
      } else {
        for (const d of pending) {
          console.log(`   ${d.contact_phone} | ${d.contact_name || 'Sin nombre'} | ${d.stage} | Follow-up: ${d.next_follow_up}`)
        }
      }
      console.log('')
    }
    
    // === KNOWLEDGE BASE ===
    else if (input.startsWith('/kb ')) {
      const kb = input.slice(4).trim()
      orchestrator.setKnowledgeBase(kb)
      console.log('✅ Knowledge base actualizada')
    }
    
    // === CONFIGURACIÓN ===
    else if (input === '/config') {
      const config = orchestrator.getAutoReply().getConfig()
      console.log('')
      console.log('⚙️  Configuración del bot:')
      console.log(`   Nombre: ${config.name}`)
      console.log(`   Personalidad: ${config.personality.substring(0, 60)}...`)
      console.log(`   Tono: ${config.tone}`)
      console.log(`   Horario: ${config.schedule.start}:00 - ${config.schedule.end}:00`)
      console.log(`   Escalamiento keywords: ${config.escalation.keywords.join(', ')}`)
      console.log('')
    }
    
    // === AYUDA ===
    else if (input === '/ayuda' || input === '/help') {
      printHelp()
    }
    
    // === SALIR ===
    else if (input === '/salir') {
      console.log('👋 Desconectando...')
      await orchestrator.stop()
      process.exit(0)
    }
    
    // === DESCONOCIDO ===
    else if (input.startsWith('/')) {
      console.log(`❌ Comando desconocido: ${input}. Escribí /ayuda`)
    }
    
    // === TEXTO PLANO ===
    else if (input) {
      console.log('💡 Escribí /enviar <número> <mensaje> para enviar un mensaje')
    }
    
    rl.prompt()
  }).on('close', async () => {
    await orchestrator.stop()
    process.exit(0)
  })
}

function printHelp() {
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  📋 COMANDOS DE MEJORAWS                                 ║')
  console.log('╠═══════════════════════════════════════════════════════════╣')
  console.log('║                                                           ║')
  console.log('║  💬 Comunicación:                                         ║')
  console.log('║    /enviar <número> <mensaje>    Enviar mensaje           ║')
  console.log('║    /historial <número>           Ver historial            ║')
  console.log('║                                                           ║')
  console.log('║  📇 Contactos:                                            ║')
  console.log('║    /contactos                    Listar contactos         ║')
  console.log('║    /importar <archivo>           Importar CSV/JSON/XLSX   ║')
  console.log('║                                                           ║')
  console.log('║  🎯 Pipeline:                                             ║')
  console.log('║    /pipeline                     Ver pipeline Kanban      ║')
  console.log('║    /deal <número> [valor]        Crear deal               ║')
  console.log('║    /mover <deal-id> <etapa>      Mover deal               ║')
  console.log('║    /followups                    Ver follow-ups            ║')
  console.log('║                                                           ║')
  console.log('║  ⚙️  Configuración:                                        ║')
  console.log('║    /estado                       Ver estado del sistema   ║')
  console.log('║    /kb <texto>                   Actualizar knowledge base║')
  console.log('║    /config                       Ver config del bot       ║')
  console.log('║                                                           ║')
  console.log('║    /ayuda                        Ver esta ayuda           ║')
  console.log('║    /salir                        Desconectar y salir      ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('')
}

// Ejecutar
main().catch((error) => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})
