import { app, BrowserWindow, ipcMain, Notification, shell, clipboard, safeStorage, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSONFilePreset } from 'lowdb/node'
import QRCode from 'qrcode'
import pino from 'pino'
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from 'baileys'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logger = pino({ level: 'silent' }) // subir a 'debug' si algo falla y hay que ver qué pasa

// En esta máquina (GPU Intel), Electron a veces deja la ventana pintada en
// blanco hasta que algo fuerza un repintado (ej. abrir DevTools) — bug
// conocido de aceleración por hardware con estos drivers. Forzar renderizado
// por software evita que la ventana quede en blanco al arrancar.
app.disableHardwareAcceleration()

let mainWindow = null
let sock = null
let db = null
let campaignRunning = false
let stopRequested = false
let pauseRequested = false
let LOG_FILE = null

const DEFAULT_DATA = {
  contacts: [],
  config: {
    template: 'Hola {nombre}! Te quiero compartir algo que armé, capaz te sirve: [LINK_MEJORADIAGNOSTICO]',
    delayMin: 20,
    delayMax: 90,
    dailyCap: 40,
    sentToday: 0,
    lastSentDate: '',
    keywords: ['si', 'sí', 'info', 'quiero', 'dale', 'contame'],
    replyTemplate: 'Genial {nombre}, te paso el link: [LINK_MEJORADIAGNOSTICO]',
    // Para cuando responden algo que no matchea ninguna keyword: que nadie
    // quede sin respuesta. Tono del manual — cálido y directo, sin vender.
    acuseTemplate: 'Gracias por responder {nombre}. Lo leo bien y te contesto en un rato.',
    reportEnabled: true,
    reportPhone: '5493765007805',
    anthropicApiKeyEncrypted: '',
    variantes: []
  }
}

// La API key de Anthropic nunca se guarda ni viaja en texto plano: se cifra
// con safeStorage (DPAPI en Windows) y solo se desencripta en memoria al
// momento de pegarla en el header de la request a la API.
function encryptApiKey(plainKey) {
  if (!safeStorage.isEncryptionAvailable()) return null
  return safeStorage.encryptString(plainKey).toString('base64')
}

// Lo único que el renderer necesita saber de la API key es si hay una
// guardada o no — nunca el valor ni el blob cifrado.
function configForRenderer() {
  const { anthropicApiKeyEncrypted, ...rest } = db.data.config
  return { ...rest, apiKeyConfigured: !!anthropicApiKeyEncrypted }
}

function getDecryptedApiKey() {
  const encrypted = db.data.config.anthropicApiKeyEncrypted
  if (!encrypted) return ''
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return ''
  }
}

// Cuando el template tiene saltos de línea reales, a veces el modelo
// devuelve el JSON con esos saltos de línea sin escapar dentro de un
// string — eso rompe JSON.parse ("Unterminated string"). Esto recorre el
// texto y escapa \n, \r y \t que aparezcan dentro de comillas, respetando
// los que ya vienen escapados.
function sanitizeJsonStringLiterals(text) {
  let result = ''
  let inString = false
  let escaped = false
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        result += ch
        escaped = false
      } else if (ch === '\\') {
        result += ch
        escaped = true
      } else if (ch === '"') {
        inString = false
        result += ch
      } else if (ch === '\n') {
        result += '\\n'
      } else if (ch === '\r') {
        result += '\\r'
      } else if (ch === '\t') {
        result += '\\t'
      } else {
        result += ch
      }
    } else {
      if (ch === '"') inString = true
      result += ch
    }
  }
  return result
}

// Los estados de entrega de WhatsApp, en criollo.
const DELIVERY_LABELS = {
  2: 'salió',
  3: 'llegó',
  4: 'leído',
  5: 'leído'
}

function normalizePhone(p) {
  return (p || '').toString().replace(/\D/g, '')
}

// --- Exportación a CSV ---
// Excel en español espera punto y coma como separador, no coma. Y sin el BOM
// del principio se come los acentos y las ñ.
function toCsv(filas, columnas) {
  const escapar = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const cabecera = columnas.map((c) => escapar(c.titulo)).join(';')
  const cuerpo = filas.map((f) => columnas.map((c) => escapar(c.valor(f))).join(';'))
  return '﻿' + [cabecera, ...cuerpo].join('\r\n')
}

function fechaLegible(iso) {
  return iso ? new Date(iso).toLocaleString('es-AR') : ''
}

function etapaEntrega(c) {
  if (c.entregaStatus >= 4) return 'Leído'
  if (c.entregaStatus === 3) return 'Llegó al teléfono'
  if (c.entregaStatus === 2) return 'Salió'
  return c.estado === 'enviado' ? 'Sin confirmar' : ''
}

// Busca la primera columna del CSV/Excel cuyo nombre matchea alguno de los
// candidatos (en orden de prioridad) y que además tiene un valor no vacío
// en esa fila. Así "Whatsapp_Format", "Comercio", "Teléfono", etc. se
// reconocen sin que el archivo tenga que usar los nombres exactos.
function findFieldKey(row, candidates) {
  const keys = Object.keys(row || {})
  for (const cand of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase().includes(cand))
    if (found && String(row[found]).trim()) return found
  }
  return null
}

function randomDelayMs(min, max) {
  const a = Math.max(1, Number(min) || 20)
  const b = Math.max(a, Number(max) || 90)
  return (a + Math.random() * (b - a)) * 1000
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    ''
  )
}

// Reemplaza cualquier {campo} presente en el texto por el valor de ese
// campo en el contacto (nombre, apellido, variable, o lo que tenga). Si el
// contacto no tiene ese campo, lo deja vacío en vez de romper el mensaje.
function renderTemplate(template, contact) {
  return (template || '').replace(/\{(\w+)\}/g, (match, key) => {
    const value = contact?.[key]
    return value !== undefined && value !== null && value !== '' ? String(value) : ''
  })
}

// --- Log de actividad ---
// Un evento por línea (JSONL) en un archivo local. No es para vos, es para
// Pablo: le sirve como base para pasarme un resumen cada tanto y ajustar
// delays, keywords, tope diario, etc. según cómo se está usando de verdad.

function logEvent(type, data = {}) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    const entry = { ts: new Date().toISOString(), type, ...data }
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n')
  } catch {
    // si falla el log no tiene que tirar abajo el envío real
  }
}

function readLogEntries() {
  if (!LOG_FILE || !fs.existsSync(LOG_FILE)) return []
  return fs
    .readFileSync(LOG_FILE, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function describirEvento(e) {
  switch (e.type) {
    case 'mensaje_enviado':
      return `enviado a ${e.nombre}`
    case 'mensaje_recibido':
      return `respondió ${e.nombre}${e.listado ? '' : ' (no listado)'}: "${e.texto}"`
    case 'auto_respuesta_enviada':
      return `le respondiste automáticamente a ${e.nombre}${e.tipo === 'acuse' ? ' (acuse, no dijo ninguna keyword)' : ' (dijo una keyword)'}`
    case 'error_envio':
      return `ERROR enviando a ${e.nombre}: ${e.error}`
    case 'campana_iniciada':
      return 'campaña iniciada'
    case 'campana_detenida':
      return `campaña detenida (${e.enviadosHoy ?? 0} enviados hoy)`
    case 'exportacion':
      return `exportaste ${e.cantidad} fila(s) de ${e.tipo} a ${e.archivo}`
    case 'contactos_validados':
      return `validaste ${e.revisados} número(s): ${e.conWhatsapp} con WhatsApp, ${e.sinWhatsapp} sin WhatsApp, ${e.formatoRaro} mal escritos`
    case 'campana_pausada':
      return `pausaste el envío (${e.enviadosHoy ?? 0} enviados hoy)`
    case 'campana_reanudada':
      return 'reanudaste el envío'
    case 'tope_diario_alcanzado':
      return 'tope diario alcanzado'
    case 'mensaje_confirmado_whatsapp':
      return `mensaje a ${e.nombre}: ${e.etapa || 'confirmado'}`
    case 'wa_conectado':
      return 'WhatsApp conectado'
    case 'wa_desconectado':
      return `WhatsApp desconectado (${e.motivo})`
    case 'contactos_importados':
      return `import: +${e.added} nuevos, ${e.duplicados} duplicados, ${e.sinTelefono} sin teléfono`
    case 'contacto_agregado_manual':
      return `agregaste a mano a ${e.nombre}`
    case 'informe_enviado':
      return `te mandé el informe del ciclo (${e.motivoFin}, ${e.enviadosCorrida} enviados)`
    case 'error_informe':
      return `ERROR mandándote el informe: ${e.error}`
    case 'mensaje_revisado_ia':
      return `revisaste el mensaje con IA (${e.variantesGeneradas} variantes generadas)`
    case 'contacto_editado':
      return `editaste a ${e.nombre}`
    case 'contactos_eliminados':
      return `eliminaste ${e.cantidad} contacto(s)`
    case 'contactos_estado_cambiado':
      return `marcaste ${e.cantidad} contacto(s) como "${e.estado}"`
    case 'contactos_vaciados':
      return `vaciaste la lista completa (${e.cantidadAnterior} contactos)`
    case 'app_reset_total':
      return 'reset total de la app — contactos, config y log a valores de fábrica'
    default:
      return e.type
  }
}

function buildSummaryText() {
  const entries = readLogEntries()
  if (entries.length === 0) {
    return 'MejoraContacto — todavía no hay actividad registrada.'
  }

  const enviados = entries.filter((e) => e.type === 'mensaje_enviado')
  const confirmadosWa = entries.filter((e) => e.type === 'mensaje_confirmado_whatsapp')
  // Cuenta contactos únicos por etapa, no eventos: un mismo mensaje pasa por
  // salió -> llegó -> leído y generaría tres eventos para una sola persona.
  const porEtapa = (minStatus) =>
    new Set(confirmadosWa.filter((e) => (e.status ?? 0) >= minStatus).map((e) => e.telefono)).size
  const salieron = porEtapa(2)
  const llegaron = porEtapa(3)
  const leyeron = porEtapa(4)
  const respuestasContactos = entries.filter((e) => e.type === 'mensaje_recibido' && e.listado)
  const respuestasOtras = entries.filter((e) => e.type === 'mensaje_recibido' && !e.listado)
  const autoRespuestas = entries.filter((e) => e.type === 'auto_respuesta_enviada')
  const errores = entries.filter((e) => e.type === 'error_envio')
  const importaciones = entries.filter((e) => e.type === 'contactos_importados')
  const tasaRespuesta = enviados.length ? Math.round((respuestasContactos.length / enviados.length) * 100) : 0

  const desde = entries[0].ts.slice(0, 10)
  const hasta = entries[entries.length - 1].ts.slice(0, 10)
  const ultimos = entries
    .slice(-15)
    .map((e) => `- ${e.ts.replace('T', ' ').slice(0, 16)} | ${describirEvento(e)}`)
    .join('\n')

  return `MejoraContacto — resumen de actividad
Generado: ${new Date().toISOString().replace('T', ' ').slice(0, 16)}
Período con datos: ${desde} a ${hasta}

Enviados (nuestra API no tiró error): ${enviados.length}
  ├─ Salieron (WhatsApp los recibió): ${salieron}
  ├─ Llegaron al teléfono: ${llegaron}
  └─ Leídos: ${leyeron}${leyeron < llegaron ? ' (los que tienen el tilde azul apagado no se pueden contar)' : ''}
Respondieron (contactos de tu lista): ${respuestasContactos.length} (${tasaRespuesta}% de los enviados)
Otros mensajes detectados (no listados): ${respuestasOtras.length}
Auto-respuestas disparadas: ${autoRespuestas.length}
Errores de envío: ${errores.length}
Importaciones de contactos: ${importaciones.length}

Últimos eventos:
${ultimos}
`
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '..', 'public', 'brand', 'isotipo-color.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

async function connectWhatsApp() {
  const authDir = path.join(app.getPath('userData'), 'auth')
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['MejoraContacto', 'Desktop', '1.0.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      const dataUrl = await QRCode.toDataURL(qr)
      mainWindow?.webContents.send('wa:qr', dataUrl)
    }

    if (connection === 'open') {
      mainWindow?.webContents.send('wa:status', 'conectado')
      logEvent('wa_conectado')
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      mainWindow?.webContents.send('wa:status', shouldReconnect ? 'reconectando' : 'desconectado')
      logEvent('wa_desconectado', { motivo: shouldReconnect ? 'reconectando' : 'logout' })
      if (shouldReconnect) {
        connectWhatsApp()
      } else {
        sock = null
        // El server de WhatsApp invalidó la sesión (logout real, no un corte
        // de red). Si no se borran las credenciales viejas, el próximo
        // "Conectar" reintenta con la misma sesión ya muerta y vuelve a
        // fallar al toque, sin mostrar QR nunca. Borrándolas, el próximo
        // intento arranca de cero y pide un QR nuevo para revincular.
        try {
          fs.rmSync(path.join(app.getPath('userData'), 'auth'), { recursive: true, force: true })
        } catch {
          // si falla el borrado, el próximo intento va a repetir el mismo error
        }
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const jid = msg.key.remoteJid || ''
      // Solo chats individuales. Ignora grupos (@g.us), status (@broadcast),
      // canales/newsletters (@newsletter) y el formato @lid — nada de eso
      // es un contacto tuyo respondiendo.
      if (!jid.endsWith('@s.whatsapp.net')) continue
      const phone = normalizePhone(jid.split('@')[0])
      const text = extractText(msg)
      if (!phone || !text) continue
      await handleIncomingMessage(phone, text)
    }
  })

  // Los tres tildes de WhatsApp, tal cual los ves en el celu:
  //   status 2 = salió    (un tilde)   — el servidor de WhatsApp lo recibió
  //   status 3 = llegó    (dos tildes) — entró al teléfono del contacto
  //   status 4 = leído    (dos azules) — el contacto abrió el chat
  // sendMessage() resolver sin error NO prueba nada de esto: solo dice que
  // WhatsApp aceptó encolarlo. Esto es la prueba real.
  // Ojo: "leído" solo llega si el contacto tiene las confirmaciones de
  // lectura activadas en su WhatsApp. Si las tiene apagadas, el mensaje
  // puede haberse leído igual y nunca vas a ver el tilde azul.
  sock.ev.on('messages.update', async (updates) => {
    for (const u of updates) {
      const msgId = u.key?.id
      const status = u.update?.status
      if (!msgId || status == null || status < 2) continue

      const contact = db.data.contacts.find((c) => c.msgId === msgId)
      if (!contact) continue

      // Los estados solo avanzan, nunca retroceden: si ya estaba leído, un
      // update tardío de "llegó" no lo tiene que pisar.
      const previo = contact.entregaStatus || 0
      if (status <= previo) continue

      const ahora = new Date().toISOString()
      contact.entregaStatus = status
      contact.confirmadoServidor = true // se mantiene por compatibilidad con datos viejos
      if (status >= 2 && !contact.fechaSalio) contact.fechaSalio = ahora
      if (status >= 3 && !contact.fechaLlego) contact.fechaLlego = ahora
      if (status >= 4 && !contact.fechaLeido) contact.fechaLeido = ahora

      await db.write()
      logEvent('mensaje_confirmado_whatsapp', {
        telefono: contact.telefono,
        nombre: contact.nombre,
        status,
        etapa: DELIVERY_LABELS[status] || String(status)
      })
      mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    }
  })
}

async function handleIncomingMessage(phone, text) {
  const contact = db.data.contacts.find((c) => normalizePhone(c.telefono) === phone)
  const cfg = db.data.config
  const now = new Date().toISOString()

  if (contact) {
    contact.estado = 'respondio'
    contact.respuesta = text
    contact.fechaRespuesta = now
  } else {
    db.data.contacts.push({
      id: phone,
      nombre: phone,
      telefono: phone,
      variable: '',
      estado: 'respondio_no_listado',
      respuesta: text,
      fechaRespuesta: now,
      fechaEnvio: null
    })
  }
  await db.write()
  mainWindow?.webContents.send('contacts:updated', db.data.contacts)
  logEvent('mensaje_recibido', {
    telefono: phone,
    nombre: contact?.nombre || phone,
    texto: text.slice(0, 140),
    listado: !!contact
  })

  new Notification({
    title: contact ? `Respondió ${contact.nombre}` : `Mensaje de ${phone}`,
    body: text.slice(0, 140)
  }).show()

  const keywords = (cfg.keywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean)
  const matched = keywords.some((k) => text.toLowerCase().includes(k))
  const destino = contact || db.data.contacts.find((c) => normalizePhone(c.telefono) === phone)

  // Nadie que escribe se queda sin respuesta. Si dijo alguna de las keywords
  // ("dale", "info"...) va la respuesta con el link; si escribió cualquier
  // otra cosa igual recibe un acuse humano, para que no quede hablando solo.
  //
  // Se responde UNA sola vez por contacto (autoRespondido): a partir de ahí
  // seguís vos a mano. Eso evita el ping-pong automático — dos bots
  // respondiéndose es exactamente lo que WhatsApp detecta y bloquea.
  if (destino && sock && !destino.autoRespondido) {
    const texto = matched && cfg.replyTemplate
      ? renderTemplate(cfg.replyTemplate, destino)
      : renderTemplate(cfg.acuseTemplate || DEFAULT_DATA.config.acuseTemplate, destino)

    if (texto.trim()) {
      destino.autoRespondido = true
      destino.fechaAutoRespuesta = new Date().toISOString()
      await db.write()

      const jid = `${phone}@s.whatsapp.net`
      // La demora es a propósito: contestar en el mismo segundo delata al bot.
      setTimeout(() => {
        sock?.sendMessage(jid, { text: texto }).catch(() => {})
        logEvent('auto_respuesta_enviada', {
          telefono: phone,
          nombre: destino.nombre || phone,
          tipo: matched ? 'con keyword' : 'acuse'
        })
      }, 4000 + Math.random() * 6000)
    }
  }
}

async function runCampaign(onlyIds = null) {
  campaignRunning = true
  stopRequested = false
  pauseRequested = false
  const cfg = db.data.config
  const today = new Date().toISOString().slice(0, 10)
  if (cfg.lastSentDate !== today) {
    cfg.sentToday = 0
    cfg.lastSentDate = today
  }

  const pendientesInicio = db.data.contacts.filter((c) => c.estado === 'pendiente').length
  logEvent('campana_iniciada', { pendientes: pendientesInicio, soloSeleccionados: !!onlyIds })

  let enviadosCorrida = 0
  let erroresCorrida = 0
  let motivoFin = 'completado'
  let indiceEnvio = 0

  for (const contact of db.data.contacts) {
    if (stopRequested) {
      motivoFin = 'detenido manualmente'
      break
    }

    // Pausa: se queda esperando acá sin mandar nada, hasta que le des
    // "Reanudar" (o "Detener"). Sirve para corregir el texto en el medio de
    // una corrida sin perder lo ya enviado — el mensaje corregido se usa
    // desde el próximo envío, porque el texto se arma recién abajo.
    while (pauseRequested && !stopRequested) {
      await sleep(500)
    }
    if (stopRequested) {
      motivoFin = 'detenido manualmente'
      break
    }

    if (contact.estado !== 'pendiente') continue

    // Si vino una lista puntual ("enviar solo a estos"), manda a esos sin
    // importar el flag incluido. Si no, respeta el flag incluido de cada uno
    // (default true — un contacto sin ese campo, de datos viejos, cuenta como incluido).
    if (onlyIds) {
      if (!onlyIds.includes(contact.id)) continue
    } else if (contact.incluido === false) {
      continue
    }

    // Si ya lo validaste y WhatsApp dijo que ese número no existe, no gastes
    // un envío al pedo. (waValido null = nunca se validó, se manda igual.)
    if (contact.waValido === false) {
      contact.estado = 'error'
      contact.error = contact.waMotivo || 'El número no tiene WhatsApp'
      await db.write()
      continue
    }

    if (cfg.sentToday >= cfg.dailyCap) {
      mainWindow?.webContents.send('campaign:progress', { status: 'tope_diario_alcanzado' })
      logEvent('tope_diario_alcanzado', { enviadosHoy: cfg.sentToday })
      motivoFin = 'tope diario alcanzado'
      break
    }

    const jid = `${normalizePhone(contact.telefono)}@s.whatsapp.net`
    // Cada 5 envíos rota a la siguiente variante (si hay variantes generadas
    // por IA); si no hay, usa siempre la plantilla base.
    const variantes = cfg.variantes && cfg.variantes.length ? cfg.variantes : [cfg.template]
    const variantIndex = Math.floor(indiceEnvio / 5) % variantes.length
    const texto = renderTemplate(variantes[variantIndex], contact)

    try {
      const sentMsg = await sock.sendMessage(jid, { text: texto })
      contact.estado = 'enviado'
      contact.fechaEnvio = new Date().toISOString()
      contact.msgId = sentMsg?.key?.id || null
      // Arranca de cero el seguimiento de tildes para este envío
      contact.confirmadoServidor = false
      contact.entregaStatus = 0
      contact.fechaSalio = null
      contact.fechaLlego = null
      contact.fechaLeido = null
      cfg.sentToday += 1
      enviadosCorrida++
      indiceEnvio++
      logEvent('mensaje_enviado', { telefono: contact.telefono, nombre: contact.nombre, variante: variantIndex + 1 })
    } catch (err) {
      contact.estado = 'error'
      contact.error = String(err?.message || err)
      erroresCorrida++
      logEvent('error_envio', { telefono: contact.telefono, nombre: contact.nombre, error: contact.error })
    }

    await db.write()
    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    mainWindow?.webContents.send('campaign:progress', {
      status: 'enviando',
      enviadosHoy: cfg.sentToday,
      dailyCap: cfg.dailyCap,
      variantIndex: variantIndex + 1,
      totalVariantes: variantes.length
    })

    await sleep(randomDelayMs(cfg.delayMin, cfg.delayMax))
  }

  campaignRunning = false
  mainWindow?.webContents.send('campaign:progress', { status: 'detenido' })
  logEvent('campana_detenida', { enviadosHoy: cfg.sentToday })

  const pendientesRestantes = db.data.contacts.filter((c) => c.estado === 'pendiente').length
  await sendCycleReport({ motivoFin, enviadosCorrida, erroresCorrida, pendientesRestantes })
}

async function sendCycleReport({ motivoFin, enviadosCorrida, erroresCorrida, pendientesRestantes }) {
  const cfg = db.data.config
  if (!cfg.reportEnabled || !cfg.reportPhone || !sock) return

  const jid = `${normalizePhone(cfg.reportPhone)}@s.whatsapp.net`
  const texto = `📋 MejoraContacto — ciclo terminado (${motivoFin})

Enviados en esta corrida: ${enviadosCorrida}
Errores: ${erroresCorrida}
Enviados hoy (total): ${cfg.sentToday}/${cfg.dailyCap}
Pendientes restantes: ${pendientesRestantes}`

  try {
    await sock.sendMessage(jid, { text: texto })
    logEvent('informe_enviado', { motivoFin, enviadosCorrida, erroresCorrida })
  } catch (err) {
    logEvent('error_informe', { error: String(err?.message || err) })
  }
}

function registerIpcHandlers() {
  ipcMain.handle('contacts:import', async (_e, rows) => {
    const existing = new Set(db.data.contacts.map((c) => normalizePhone(c.telefono)))
    let added = 0
    let sinTelefono = 0
    let duplicados = 0

    for (const row of rows || []) {
      const phoneKey = findFieldKey(row, ['whatsapp', 'telefono', 'teléfono', 'phone', 'numero', 'número', 'cel'])
      const nameKey = findFieldKey(row, ['nombre', 'name', 'comercio', 'empresa', 'cliente', 'contacto'])
      const lastNameKey = findFieldKey(row, ['apellido', 'lastname', 'last_name'])

      const telefono = normalizePhone(phoneKey ? row[phoneKey] : '')
      if (!telefono) {
        sinTelefono++
        continue
      }
      if (existing.has(telefono)) {
        duplicados++
        continue
      }

      db.data.contacts.push({
        id: telefono,
        nombre: (nameKey ? row[nameKey] : '') || telefono,
        apellido: (lastNameKey ? row[lastNameKey] : '') || '',
        telefono,
        variable: '',
        incluido: true,
        estado: 'pendiente',
        fechaEnvio: null,
        respuesta: null,
        fechaRespuesta: null
      })
      existing.add(telefono)
      added++
    }

    await db.write()
    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    logEvent('contactos_importados', { added, sinTelefono, duplicados, total: db.data.contacts.length })
    return { added, sinTelefono, duplicados, total: db.data.contacts.length }
  })

  ipcMain.handle('contacts:list', () => db.data.contacts)

  ipcMain.handle('contacts:update', async (_e, data) => {
    const contact = db.data.contacts.find((c) => c.id === data.id)
    if (!contact) return { error: 'Contacto no encontrado' }

    const nuevoTelefono = normalizePhone(data.telefono)
    if (!nuevoTelefono) return { error: 'Teléfono inválido' }

    if (nuevoTelefono !== contact.telefono) {
      const enUso = db.data.contacts.some((c) => c.id !== contact.id && normalizePhone(c.telefono) === nuevoTelefono)
      if (enUso) return { error: 'Ese teléfono ya lo tiene otro contacto' }
    }

    contact.nombre = data.nombre?.trim() || nuevoTelefono
    contact.apellido = data.apellido?.trim() || ''
    contact.telefono = nuevoTelefono
    contact.variable = data.variable?.trim() || ''
    contact.id = nuevoTelefono

    await db.write()
    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    logEvent('contacto_editado', { telefono: nuevoTelefono, nombre: contact.nombre })
    return { ok: true }
  })

  ipcMain.handle('contacts:delete', async (_e, ids) => {
    const antes = db.data.contacts.length
    db.data.contacts = db.data.contacts.filter((c) => !ids.includes(c.id))
    const eliminados = antes - db.data.contacts.length

    await db.write()
    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    logEvent('contactos_eliminados', { cantidad: eliminados })
    return { ok: true, eliminados }
  })

  ipcMain.handle('contacts:setIncluido', async (_e, { ids, incluido }) => {
    for (const c of db.data.contacts) {
      if (ids.includes(c.id)) c.incluido = incluido
    }
    await db.write()
    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    return { ok: true }
  })

  ipcMain.handle('contacts:setEstado', async (_e, { ids, estado }) => {
    for (const c of db.data.contacts) {
      if (ids.includes(c.id)) {
        c.estado = estado
        if (estado === 'pendiente') c.error = null
      }
    }
    await db.write()
    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    logEvent('contactos_estado_cambiado', { cantidad: ids.length, estado })
    return { ok: true }
  })

  // Le pregunta a WhatsApp cuáles de estos números tienen cuenta de verdad.
  // Sirve para no quemar envíos (y reputación del número) contra teléfonos
  // mal tipeados o que directamente no tienen WhatsApp.
  ipcMain.handle('contacts:validate', async (_e, ids) => {
    if (!sock) return { error: 'Conectá WhatsApp primero' }

    const objetivo = Array.isArray(ids) && ids.length
      ? db.data.contacts.filter((c) => ids.includes(c.id))
      : db.data.contacts

    let conWhatsapp = 0
    let sinWhatsapp = 0
    let formatoRaro = 0
    let errores = 0

    for (const contact of objetivo) {
      const telefono = normalizePhone(contact.telefono)

      // Un número internacional válido tiene entre 8 y 15 dígitos (norma E.164).
      // Fuera de ese rango ni vale la pena preguntarle a WhatsApp.
      if (telefono.length < 8 || telefono.length > 15) {
        contact.waValido = false
        contact.waMotivo = `El teléfono tiene ${telefono.length} dígitos — un número válido tiene entre 8 y 15`
        formatoRaro++
        continue
      }

      try {
        // onWhatsApp toma el número pelado y puede devolver undefined (no un
        // array vacío) si la consulta no trae respuesta — de ahí el `|| []`,
        // sin eso el destructuring tira TypeError.
        const resultados = (await sock.onWhatsApp(telefono)) || []
        const res = resultados[0]
        if (res?.exists) {
          contact.waValido = true
          contact.waMotivo = null
          conWhatsapp++
        } else {
          contact.waValido = false
          contact.waMotivo = 'Este número no tiene WhatsApp'
          sinWhatsapp++
        }
      } catch (err) {
        contact.waValido = null
        contact.waMotivo = `No se pudo verificar: ${String(err?.message || err)}`
        errores++
      }

      // Pausa corta entre consultas: preguntar de golpe por muchos números
      // seguidos es justo el patrón que WhatsApp marca como bot.
      await sleep(300 + Math.random() * 400)
    }

    await db.write()
    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    logEvent('contactos_validados', {
      revisados: objetivo.length,
      conWhatsapp,
      sinWhatsapp,
      formatoRaro,
      errores
    })
    return { ok: true, revisados: objetivo.length, conWhatsapp, sinWhatsapp, formatoRaro, errores }
  })

  ipcMain.handle('contacts:clearAll', async () => {
    const cantidadAnterior = db.data.contacts.length
    db.data.contacts = []
    await db.write()
    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    logEvent('contactos_vaciados', { cantidadAnterior })
    return { ok: true }
  })

  ipcMain.handle('app:resetTotal', async () => {
    db.data.contacts = []
    db.data.config = { ...DEFAULT_DATA.config }
    await db.write()

    try {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
      fs.writeFileSync(LOG_FILE, '')
    } catch {
      // si falla la limpieza del log, no bloquea el reset del resto
    }
    logEvent('app_reset_total')

    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    return { ok: true, config: configForRenderer() }
  })

  ipcMain.handle('contacts:addManual', async (_e, data) => {
    const telefono = normalizePhone(data?.telefono)
    if (!telefono) return { error: 'Teléfono inválido' }

    const yaExiste = db.data.contacts.some((c) => normalizePhone(c.telefono) === telefono)
    if (yaExiste) return { error: 'Ese teléfono ya está en la lista' }

    db.data.contacts.push({
      id: telefono,
      nombre: data.nombre?.trim() || telefono,
      apellido: data.apellido?.trim() || '',
      telefono,
      variable: data.variable?.trim() || '',
      incluido: true,
      estado: 'pendiente',
      fechaEnvio: null,
      respuesta: null,
      fechaRespuesta: null
    })
    await db.write()
    mainWindow?.webContents.send('contacts:updated', db.data.contacts)
    logEvent('contacto_agregado_manual', { telefono, nombre: data.nombre })
    return { ok: true }
  })

  ipcMain.handle('config:get', () => configForRenderer())

  ipcMain.handle('config:set', async (_e, config) => {
    // apiKeyConfigured es un campo sintético que arma configForRenderer()
    // para el lado del renderer — nunca tiene que volver a escribirse en la
    // config real, o ensucia data.json con un campo que no es de config.
    const { anthropicApiKey, apiKeyConfigured, ...rest } = config || {}
    // Object.assign en vez de reemplazar el objeto: una campaña en curso tiene
    // una referencia viva a db.data.config. Si acá se creara un objeto nuevo,
    // la campaña seguiría leyendo el viejo — el mensaje corregido no se usaría
    // y el contador de enviados del día se perdería al terminar.
    Object.assign(db.data.config, rest)
    if (typeof anthropicApiKey === 'string' && anthropicApiKey.trim()) {
      const encrypted = encryptApiKey(anthropicApiKey.trim())
      if (encrypted) db.data.config.anthropicApiKeyEncrypted = encrypted
    }
    await db.write()
    return configForRenderer()
  })

  ipcMain.handle('wa:connect', async () => {
    if (!sock) await connectWhatsApp()
    return true
  })

  ipcMain.handle('wa:logout', async () => {
    try {
      await sock?.logout()
    } catch {
      // sesión ya caída, no pasa nada
    }
    sock = null
    mainWindow?.webContents.send('wa:status', 'desconectado')
    return true
  })

  ipcMain.handle('campaign:start', async (_e, onlyIds) => {
    if (!sock) return { error: 'Conectá WhatsApp primero' }
    if (campaignRunning) return { error: 'Ya está enviando' }
    runCampaign(Array.isArray(onlyIds) && onlyIds.length ? onlyIds : null)
    return { started: true }
  })

  ipcMain.handle('campaign:stop', () => {
    stopRequested = true
    pauseRequested = false // por si estaba pausada: la saca del bucle de espera
    return true
  })

  ipcMain.handle('campaign:pause', () => {
    if (!campaignRunning) return { error: 'No hay ningún envío en curso' }
    pauseRequested = true
    mainWindow?.webContents.send('campaign:progress', {
      status: 'pausado',
      enviadosHoy: db.data.config.sentToday,
      dailyCap: db.data.config.dailyCap
    })
    logEvent('campana_pausada', { enviadosHoy: db.data.config.sentToday })
    return { ok: true }
  })

  ipcMain.handle('campaign:resume', () => {
    if (!campaignRunning) return { error: 'No hay ningún envío en curso' }
    pauseRequested = false
    logEvent('campana_reanudada', { enviadosHoy: db.data.config.sentToday })
    return { ok: true }
  })

  ipcMain.handle('logs:summary', () => buildSummaryText())

  ipcMain.handle('ai:reviewTemplate', async (_e, template) => {
    const apiKey = getDecryptedApiKey()
    if (!apiKey) return { error: 'Falta cargar tu API key de Anthropic en Configuración.' }
    if (!template?.trim()) return { error: 'Escribí un mensaje primero.' }

    const systemPrompt = `Sos un revisor de copy para Mejora Continua (mejoraok.com), una consultora de claridad estratégica. Aplicá siempre este criterio:

- Cálido y directo a la vez. Nunca vende, clarifica. La calidez está en el cuidado detrás de decir la verdad, no en el consuelo.
- Nunca tiene que sonar a mensaje armado, IA o plantilla de marketing: tiene que sonar como si Pablo lo tipeó él mismo, rápido, para alguien que ya conoce.
- Nada de jerga, nada de motivacional vacío, nada de urgencia artificial. Nunca se vende por precio.
- El problema nunca es la persona: es lo que falta (foco, estructura, criterio externo).
- Escribí en español rioplatense (vos, no tú), con todos los acentos y la ñ correctos.
- Mantené EXACTAMENTE los tags entre llaves que aparezcan en el original (por ejemplo {nombre}, {apellido}, {variable}), sin traducirlos ni sacarlos.

Te paso un mensaje de WhatsApp que Pablo quiere mandar a contactos que ya lo conocen (dueños de comercio, prospectos tibios).

Además de revisar el tono, corregí la ortografía y la gramática, y señalá cualquier parte que se entienda mal o sea ambigua.

El campo "variantes" tiene que traer SIEMPRE exactamente 4 elementos. Las 4 dicen lo mismo que versionMejorada pero cada una con otras palabras y otra estructura de oración — para que WhatsApp no vea el mismo texto exacto mensaje tras mensaje y lo tome por bot.`

    // El JSON lo garantiza la API con un esquema (structured outputs) en vez de
    // pedirlo por prompt y cruzar los dedos: así no puede volver mal formado ni
    // cortado a la mitad. max_tokens generoso porque la respuesta trae la
    // versión mejorada MÁS 4 variantes — o sea ~5 veces el largo del original.
    const RESPUESTA_SCHEMA = {
      type: 'object',
      properties: {
        esClaro: { type: 'boolean', description: 'true si el mensaje se entiende bien como está' },
        feedback: { type: 'string', description: '2-3 líneas directas: qué funciona y qué no' },
        correcciones: {
          type: 'array',
          description: 'Errores de ortografía, gramática o redacción encontrados en el original. Vacío si no hay.',
          items: {
            type: 'object',
            properties: {
              original: { type: 'string', description: 'El fragmento tal cual está escrito' },
              corregido: { type: 'string', description: 'Cómo debería estar escrito' },
              motivo: { type: 'string', description: 'Por qué, en pocas palabras' }
            },
            required: ['original', 'corregido', 'motivo'],
            additionalProperties: false
          }
        },
        versionMejorada: { type: 'string', description: 'El mensaje reescrito, corregido y más humano, con los mismos tags' },
        variantes: {
          type: 'array',
          description: 'Exactamente 4 variantes que dicen lo mismo con otras palabras',
          items: { type: 'string' }
        }
      },
      required: ['esClaro', 'feedback', 'correcciones', 'versionMejorada', 'variantes'],
      additionalProperties: false
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-opus-5',
          max_tokens: 16000,
          system: systemPrompt,
          output_config: { format: { type: 'json_schema', schema: RESPUESTA_SCHEMA } },
          messages: [{ role: 'user', content: template }]
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        return { error: `Anthropic API error ${response.status}: ${errText.slice(0, 200)}` }
      }

      const data = await response.json()
      if (data.stop_reason === 'refusal') {
        return { error: 'La IA no quiso revisar este mensaje. Probá reformulándolo.' }
      }
      const textBlock = data.content?.find((b) => b.type === 'text')?.text || ''
      const clean = textBlock.replace(/```json|```/g, '').trim()

      let parsed
      try {
        parsed = JSON.parse(clean)
      } catch {
        parsed = JSON.parse(sanitizeJsonStringLiterals(clean))
      }

      db.data.config.variantes = Array.isArray(parsed.variantes) ? parsed.variantes : []
      await db.write()
      logEvent('mensaje_revisado_ia', { esClaro: parsed.esClaro, variantesGeneradas: db.data.config.variantes.length })

      return { ok: true, ...parsed }
    } catch (err) {
      if (err instanceof SyntaxError) {
        return { error: 'La IA devolvió una respuesta que no pude interpretar. Probá de nuevo.' }
      }
      return { error: String(err?.message || err) }
    }
  })

  // Exporta contactos o actividad a CSV. Se abre con doble clic en Excel.
  ipcMain.handle('export:run', async (_e, tipo) => {
    const hoy = new Date().toISOString().slice(0, 10)
    const nombreSugerido = tipo === 'actividad'
      ? `MejoraContacto-actividad-${hoy}.csv`
      : `MejoraContacto-contactos-${hoy}.csv`

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: tipo === 'actividad' ? 'Guardar informe de actividad' : 'Guardar contactos y mensajes',
      defaultPath: path.join(app.getPath('documents'), nombreSugerido),
      filters: [{ name: 'CSV para Excel', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return { cancelado: true }

    let csv
    let cantidad

    if (tipo === 'actividad') {
      const entries = readLogEntries()
      cantidad = entries.length
      csv = toCsv(entries, [
        { titulo: 'Fecha y hora', valor: (e) => fechaLegible(e.ts) },
        { titulo: 'Qué pasó', valor: (e) => describirEvento(e) },
        { titulo: 'Tipo', valor: (e) => e.type },
        { titulo: 'Contacto', valor: (e) => e.nombre || '' },
        { titulo: 'Teléfono', valor: (e) => e.telefono || '' },
        { titulo: 'Detalle', valor: (e) => e.texto || e.error || '' }
      ])
    } else {
      const contactos = db.data.contacts
      cantidad = contactos.length
      csv = toCsv(contactos, [
        { titulo: 'Nombre', valor: (c) => c.nombre || '' },
        { titulo: 'Apellido', valor: (c) => c.apellido || '' },
        { titulo: 'Teléfono', valor: (c) => c.telefono || '' },
        { titulo: 'Estado', valor: (c) => c.estado || '' },
        { titulo: 'Entrega', valor: (c) => etapaEntrega(c) },
        { titulo: 'Enviado', valor: (c) => fechaLegible(c.fechaEnvio) },
        { titulo: 'Salió', valor: (c) => fechaLegible(c.fechaSalio) },
        { titulo: 'Llegó', valor: (c) => fechaLegible(c.fechaLlego) },
        { titulo: 'Leído', valor: (c) => fechaLegible(c.fechaLeido) },
        { titulo: 'Qué respondió', valor: (c) => c.respuesta || '' },
        { titulo: 'Cuándo respondió', valor: (c) => fechaLegible(c.fechaRespuesta) },
        { titulo: 'Le respondimos', valor: (c) => (c.autoRespondido ? 'Sí' : 'No') },
        { titulo: 'Tiene WhatsApp', valor: (c) => (c.waValido === true ? 'Sí' : c.waValido === false ? 'No' : 'Sin verificar') },
        { titulo: 'Error', valor: (c) => c.error || '' }
      ])
    }

    fs.writeFileSync(filePath, csv, 'utf-8')
    logEvent('exportacion', { tipo, cantidad, archivo: path.basename(filePath) })
    return { ok: true, filePath, cantidad }
  })

  ipcMain.handle('export:reveal', (_e, filePath) => {
    if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath)
    return true
  })

  ipcMain.handle('logs:copy', () => {
    clipboard.writeText(buildSummaryText())
    return true
  })

  ipcMain.handle('logs:open', () => {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '')
    shell.showItemInFolder(LOG_FILE)
    return true
  })
}

app.whenReady().then(async () => {
  LOG_FILE = path.join(app.getPath('userData'), 'logs', 'actividad.jsonl')
  db = await JSONFilePreset(path.join(app.getPath('userData'), 'data.json'), DEFAULT_DATA)
  // Si venís de una versión anterior, esto rellena los campos nuevos de
  // config sin pisar lo que ya tenías configurado.
  db.data.config = { ...DEFAULT_DATA.config, ...db.data.config }
  // Migración: si venís de una versión vieja que guardaba la key en texto
  // plano, la cifra y borra el campo plano de la DB.
  if (db.data.config.anthropicApiKey) {
    const encrypted = encryptApiKey(db.data.config.anthropicApiKey)
    if (encrypted) db.data.config.anthropicApiKeyEncrypted = encrypted
    delete db.data.config.anthropicApiKey
  }
  await db.write()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
