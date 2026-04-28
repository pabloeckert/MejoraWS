// src/server.ts
// Entry point de MejoraWS — CRM WhatsApp Autónomo con IA

import { Orchestrator } from './brain/orchestrator'
import { createApi } from './api'
import { c, status, progressBar, table, box } from './cli/theme'
import { logger } from './utils/logger'
import * as readline from 'readline'

const API_PORT = parseInt(process.env.PORT || '3000')

async function main() {
  const orchestrator = new Orchestrator()

  // Manejar cierre graceful
  process.on('SIGINT', async () => {
    console.log('\n' + status.warn('Cerrando sistema...'))
    await orchestrator.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await orchestrator.stop()
    process.exit(0)
  })

  // Iniciar sistema
  await orchestrator.start()

  // Iniciar API REST
  const api = createApi(orchestrator)
  api.listen(API_PORT, () => {
    logger.info({ port: API_PORT }, `API REST listening on http://localhost:${API_PORT}`)
    console.log(status.ok(`API REST activa en ${c('cyan', `http://localhost:${API_PORT}`)}`))
    console.log(c('dim', `   Health: http://localhost:${API_PORT}/health`))
    console.log(c('dim', `   Docs:   http://localhost:${API_PORT}/api/v1/`))
  })

  // CLI interactivo (solo en TTY)
  const isInteractive = process.stdin.isTTY
  let rl: readline.Interface | null = null

  if (isInteractive) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: c('brightCyan', '🚀 mejoraws') + c('dim', '> '),
    })

    printHelp()
    rl.prompt()
  } else {
    logger.info('Running in non-interactive mode (background)')
  }

  if (!rl) return // Non-interactive mode, keep running

  rl.on('line', async (line) => {
    const input = line.trim()

    // === COMUNICACIÓN ===
    if (input.startsWith('/enviar ')) {
      const parts = input.slice(8).split(' ')
      const to = parts[0]
      const text = parts.slice(1).join(' ')

      if (!to || !text) {
        console.log(status.err('Uso: /enviar <número> <mensaje>'))
      } else {
        console.log(status.pending(`Enviando a ${to}...`))
        const success = await orchestrator.sendMessage(to, text)
        console.log(success ? status.ok('Mensaje enviado') : status.err('Error al enviar'))
      }
    }

    // === ESTADO ===
    else if (input === '/estado') {
      const sysStatus = await orchestrator.getStatus()
      const stats = orchestrator.getSendStats()
      const contactStats = orchestrator.contacts.getStats()
      const dealStats = orchestrator.deals.getStats()

      console.log('')
      console.log(box('📊 ESTADO DE MEJORAWS', [
        '',
        `  ${c('bold', 'WhatsApp:')}    ${sysStatus.whatsapp ? c('brightGreen', '● Conectado') : c('red', '○ Desconectado')}`,
        `  ${c('bold', 'Bot:')}         ${sysStatus.botActive ? c('brightGreen', '● Activo') : c('red', '○ Inactivo')}`,
        `  ${c('bold', 'LLM:')}         ${c('cyan', sysStatus.llm.active)} (Groq: ${sysStatus.llm.groq ? c('green', '✓') : c('red', '✗')} | Ollama: ${sysStatus.llm.ollama ? c('green', '✓') : c('red', '✗')})`,
        `  ${c('bold', 'Anti-ban:')}    ${c('yellow', sysStatus.warmup)}`,
        '',
        `  ${c('bold', 'Warm-up:')}     ${progressBar(stats.warmupDay, 14)}`,
        `  ${c('bold', 'Enviados hoy:')} ${progressBar(stats.sentToday, stats.dailyLimit)}`,
        '',
        `  ${c('bold', '📇 Contactos:')} ${c('brightWhite', String(contactStats.total))} total │ ${c('green', String(contactStats.withWhatsApp))} WA │ ${c('cyan', String(contactStats.withEmail))} email │ Score: ${c('yellow', String(contactStats.avgScore))}`,
        `  ${c('bold', '🎯 Pipeline:')}  ${c('brightGreen', String(dealStats.open))} abiertos │ ${c('green', String(dealStats.closedWon))} ganados │ ${c('red', String(dealStats.closedLost))} perdidos │ $${c('brightWhite', dealStats.totalValue.toLocaleString())} │ Conv: ${c('yellow', dealStats.conversionRate + '%')}`,
        '',
      ].join('\n')))
    }

    // === HISTORIAL ===
    else if (input.startsWith('/historial ')) {
      const phone = input.slice(11).trim()
      const history = orchestrator.getReceiver().getHistory(phone, 10)
      console.log('')
      console.log(c('bold', `📜 Historial de ${c('brightCyan', phone)}:`))
      if (history.length === 0) {
        console.log(c('dim', '   Sin mensajes'))
      } else {
        const rows = history.map((msg: any) => ({
          dir: msg.direction === 'inbound' ? '📩 Entrante' : '📤 Saliente',
          time: msg.created_at,
          msg: msg.content.substring(0, 60),
        }))
        console.log(table(
          [
            { header: 'Dir', key: 'dir', width: 12 },
            { header: 'Fecha', key: 'time', width: 20 },
            { header: 'Mensaje', key: 'msg', width: 60 },
          ],
          rows
        ))
      }
      console.log('')
    }

    // === CONTACTOS ===
    else if (input === '/contactos') {
      const contacts = orchestrator.contacts.list({ limit: 20 })
      console.log('')
      console.log(c('bold', `📇 Contactos (${c('brightWhite', String(contacts.length))}):`))
      if (contacts.length === 0) {
        console.log(c('dim', '   Sin contactos. Usá /importar <archivo>'))
      } else {
        const rows = contacts.map(c => ({
          phone: c.phone,
          name: c.name || '—',
          wa: c.whatsapp ? '✅' : '❌',
          score: String(c.score),
          tags: c.tags.length > 0 ? c.tags.join(', ') : '—',
        }))
        console.log(table(
          [
            { header: 'Teléfono', key: 'phone', width: 18 },
            { header: 'Nombre', key: 'name', width: 20 },
            { header: 'WA', key: 'wa', width: 4, align: 'center' },
            { header: 'Score', key: 'score', width: 6, align: 'right' },
            { header: 'Tags', key: 'tags', width: 25 },
          ],
          rows
        ))
      }
      console.log('')
    }

    // === IMPORTAR ===
    else if (input.startsWith('/importar ')) {
      const filePath = input.slice(10).trim()
      if (!filePath) {
        console.log(status.err('Uso: /importar <ruta/archivo.csv|json|xlsx|vcf>'))
      } else {
        try {
          console.log(status.pending(`Importando ${filePath}...`))
          const result = await orchestrator.importer.importFile(filePath)
          console.log('')
          console.log(box('📥 RESULTADO DE IMPORTACIÓN', [
            '',
            `  ${c('bold', 'Importados:')}   ${c('brightGreen', String(result.imported))}`,
            `  ${c('bold', 'Duplicados:')}   ${c('yellow', String(result.duplicates))}`,
            `  ${c('bold', 'Inválidos:')}    ${c('red', String(result.invalid))}`,
            `  ${c('bold', 'Con WhatsApp:')} ${c('cyan', String(result.withWhatsApp))}`,
            '',
          ].join('\n')))
        } catch (error: any) {
          console.log(status.err(error.message))
        }
      }
    }

    // === DEALS / PIPELINE ===
    else if (input === '/pipeline') {
      const pipeline = orchestrator.deals.getPipeline()
      console.log('')
      console.log(c('bold', '🎯 PIPELINE'))

      const rows = pipeline.stages.map(s => ({
        stage: s.stage,
        count: String(s.count),
        value: `$${s.value.toLocaleString()}`,
        bar: '█'.repeat(Math.min(20, s.count)) + '░'.repeat(Math.max(0, 20 - s.count)),
      }))
      console.log(table(
        [
          { header: 'Etapa', key: 'stage', width: 18 },
          { header: 'Deals', key: 'count', width: 6, align: 'right' },
          { header: 'Valor', key: 'value', width: 12, align: 'right' },
          { header: 'Distribución', key: 'bar', width: 20 },
        ],
        rows
      ))

      console.log(c('dim', '─'.repeat(60)))
      console.log(`  ${c('bold', 'Total:')} ${c('brightWhite', String(pipeline.totalDeals))} deals │ ${c('brightGreen', `$${pipeline.totalValue.toLocaleString()}`)}`)
      console.log('')
    }

    else if (input.startsWith('/deal ')) {
      const parts = input.slice(6).split(' ')
      const phone = parts[0]
      const value = parts[1] ? parseFloat(parts[1]) : undefined

      if (!phone) {
        console.log(status.err('Uso: /deal <número> [valor]'))
      } else {
        const deal = orchestrator.deals.create(phone, value)
        console.log(status.ok(`Deal creado: ${c('brightCyan', deal.id)} (etapa: ${c('yellow', deal.stage)})`))
      }
    }

    else if (input.startsWith('/mover ')) {
      const parts = input.slice(7).split(' ')
      const dealId = parts[0]
      const stage = parts[1]

      if (!dealId || !stage) {
        console.log(status.err('Uso: /mover <deal-id> <etapa>'))
        console.log(c('dim', '   Etapas: nuevo, contactado, interesado, propuesta, negociacion, cerrado-ganado, cerrado-perdido'))
      } else {
        try {
          const deal = orchestrator.deals.moveStage(dealId, stage)
          console.log(status.ok(`Deal movido a: ${c('brightCyan', deal?.stage || '')}`))
        } catch (error: any) {
          console.log(status.err(error.message))
        }
      }
    }

    // === FOLLOW-UPS ===
    else if (input === '/followups') {
      const pending = orchestrator.deals.getPendingFollowUps()
      console.log('')
      console.log(c('bold', `⏰ Follow-ups pendientes (${c('brightYellow', String(pending.length))}):`))
      if (pending.length === 0) {
        console.log(c('dim', '   Sin follow-ups pendientes'))
      } else {
        const rows = pending.map(d => ({
          phone: d.contact_phone,
          name: d.contact_name || '—',
          stage: d.stage,
          followup: d.next_follow_up,
        }))
        console.log(table(
          [
            { header: 'Teléfono', key: 'phone', width: 18 },
            { header: 'Nombre', key: 'name', width: 20 },
            { header: 'Etapa', key: 'stage', width: 14 },
            { header: 'Follow-up', key: 'followup', width: 20 },
          ],
          rows
        ))
      }
      console.log('')
    }

    // === KNOWLEDGE BASE ===
    else if (input.startsWith('/kb ')) {
      const kb = input.slice(4).trim()
      orchestrator.setKnowledgeBase(kb)
      console.log(status.ok('Knowledge base actualizada'))
    }

    // === CONFIGURACIÓN ===
    else if (input === '/config') {
      const config = orchestrator.getAutoReply().getConfig()
      console.log('')
      console.log(box('⚙️  CONFIGURACIÓN DEL BOT', [
        '',
        `  ${c('bold', 'Nombre:')}        ${c('brightCyan', config.name)}`,
        `  ${c('bold', 'Personalidad:')}  ${c('dim', config.personality.substring(0, 55))}...`,
        `  ${c('bold', 'Tono:')}          ${c('yellow', config.tone)}`,
        `  ${c('bold', 'Horario:')}       ${c('green', `${config.schedule.start}:00`)} — ${c('green', `${config.schedule.end}:00`)}`,
        `  ${c('bold', 'Escalamiento:')}  ${c('dim', config.escalation.keywords.join(', '))}`,
        `  ${c('bold', 'Max intercambios:')} ${c('yellow', String(config.escalation.maxExchanges))}`,
        '',
      ].join('\n')))
    }

    // === AYUDA ===
    else if (input === '/ayuda' || input === '/help') {
      printHelp()
    }

    // === SALIR ===
    else if (input === '/salir') {
      console.log(status.warn('Desconectando...'))
      await orchestrator.stop()
      process.exit(0)
    }

    // === WEBHOOKS ===
    else if (input === '/webhooks') {
      const webhooks = orchestrator.webhooks.list()
      if (webhooks.length === 0) {
        console.log(status.info('No hay webhooks configurados'))
      } else {
        console.log('')
        console.log(c('bold', '🔗 Webhooks:'))
        for (const wh of webhooks) {
          const statusIcon = wh.active ? c('green', '●') : c('red', '○')
          console.log(`  ${statusIcon} ${c('bold', wh.url)} — ${wh.events.join(', ')} (fallos: ${wh.failure_count})`)
        }
        console.log('')
      }
    }

    // === QUALITY ===
    else if (input === '/quality' || input === '/calidad') {
      const { ConversationQualityScorer } = await import('./brain/conversation-quality')
      const scorer = new ConversationQualityScorer(orchestrator.getDB())
      const stats = scorer.getStats(5)
      console.log('')
      console.log(c('bold', '📊 Calidad de Conversaciones:'))
      console.log(`  Total: ${c('cyan', String(stats.totalConversations))}`)
      console.log(`  Score promedio: ${c('yellow', String(stats.avgQualityScore))}/100`)
      console.log(`  Auto-resolución: ${c('green', stats.autoResolutionRate + '%')}`)
      console.log(`  Escalamiento: ${c('red', stats.escalationRate + '%')}`)
      if (stats.topConversations.length > 0) {
        console.log(c('bold', '  Top conversaciones:'))
        for (const conv of stats.topConversations.slice(0, 3)) {
          console.log(`    ${conv.contactName || conv.phone}: ${conv.qualityScore}/100 — ${conv.summary}`)
        }
      }
      console.log('')
    }

    // === TEMPLATES ===
    else if (input === '/templates') {
      const { getAvailableTemplates } = await import('./brain/prompt-templates')
      const templates = getAvailableTemplates()
      console.log('')
      console.log(c('bold', '🏭 Templates por Industria:'))
      for (const t of templates) {
        console.log(`  ${c('cyan', t.id)} — ${c('bold', t.name)}: ${t.description}`)
      }
      console.log(`\n  ${c('dim', 'Usar: /config → industry: <id>')}`)
      console.log('')
    }

    // === DESCONOCIDO ===
    else if (input.startsWith('/')) {
      console.log(status.err(`Comando desconocido: ${c('bold', input)}. Escribí ${c('cyan', '/ayuda')}`))
    }

    // === TEXTO PLANO ===
    else if (input) {
      console.log(c('dim', '💡 Escribí ') + c('cyan', '/enviar <número> <mensaje>') + c('dim', ' para enviar un mensaje'))
    }

    rl.prompt()
  }).on('close', async () => {
    await orchestrator.stop()
    process.exit(0)
  })
}

function printHelp() {
  console.log('')
  console.log(c('cyan', 'bold', '╔═══════════════════════════════════════════════════════════╗'))
  console.log(c('cyan', '║') + c('brightWhite', 'bold', '  📋 COMANDOS DE MEJORAWS                                 ') + c('cyan', '║'))
  console.log(c('cyan', '╠═══════════════════════════════════════════════════════════╣'))
  console.log(c('cyan', '║') + '                                                           ' + c('cyan', '║'))
  console.log(c('cyan', '║') + c('brightCyan', 'bold', '  💬 Comunicación:') + '                                         ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/enviar') + c('dim', ' <número> <mensaje>') + c('white', '    Enviar mensaje') + '           ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/historial') + c('dim', ' <número>') + c('white', '           Ver historial') + '            ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '                                                           ' + c('cyan', '║'))
  console.log(c('cyan', '║') + c('brightCyan', 'bold', '  📇 Contactos:') + '                                            ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/contactos') + c('white', '                    Listar contactos') + '         ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/importar') + c('dim', ' <archivo>') + c('white', '           Importar CSV/JSON/XLSX') + '   ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '                                                           ' + c('cyan', '║'))
  console.log(c('cyan', '║') + c('brightCyan', 'bold', '  🎯 Pipeline:') + '                                             ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/pipeline') + c('white', '                     Ver pipeline Kanban') + '      ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/deal') + c('dim', ' <número> [valor]') + c('white', '        Crear deal') + '               ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/mover') + c('dim', ' <deal-id> <etapa>') + c('white', '      Mover deal') + '               ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/followups') + c('white', '                    Ver follow-ups') + '            ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '                                                           ' + c('cyan', '║'))
  console.log(c('cyan', '║') + c('brightCyan', 'bold', '  ⚙️  Configuración:') + '                                        ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/estado') + c('white', '                       Ver estado del sistema') + '   ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/kb') + c('dim', ' <texto>') + c('white', '                   Actualizar knowledge base') + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/config') + c('white', '                       Ver config del bot') + '       ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '                                                           ' + c('cyan', '║'))
  console.log(c('cyan', '║') + c('brightCyan', 'bold', '  🔗 Integraciones:') + '                                         ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/webhooks') + c('white', '                     Ver webhooks') + '               ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/templates') + c('white', '                     Ver templates industria') + '    ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/quality') + c('white', '                       Calidad conversaciones') + '   ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '                                                           ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/ayuda') + c('white', '                        Ver esta ayuda') + '           ' + c('cyan', '║'))
  console.log(c('cyan', '║') + '    ' + c('brightWhite', '/salir') + c('white', '                        Desconectar y salir') + '      ' + c('cyan', '║'))
  console.log(c('cyan', '╚═══════════════════════════════════════════════════════════╝'))
  console.log('')
}

// Ejecutar
main().catch((error) => {
  console.error(status.err(`Error fatal: ${error.message}`))
  process.exit(1)
})
