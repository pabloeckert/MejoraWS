import { app, BrowserWindow, WebContentsView, ipcMain, Notification, shell, clipboard, safeStorage, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSONFilePreset } from 'lowdb/node'
import QRCode from 'qrcode'
import pino from 'pino'
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from 'baileys'
import { startBridgeServer } from './bridge.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logger = pino({ level: 'silent' }) // subir a 'debug' si algo falla y hay que ver qué pasa

// En esta máquina (GPU Intel), Electron a veces deja la ventana pintada en
// blanco hasta que algo fuerza un repintado (ej. abrir DevTools) — bug
// conocido de aceleración por hardware con estos drivers. Forzar renderizado
// por software evita que la ventana quede en blanco al arrancar.
app.disableHardwareAcceleration()

// Fase 3 de MejoraSuite: protocolo mejoraws:// para que MejoraContactos (o
// cualquier página) pueda ofrecer un link "Abrir MejoraWS" cuando el bridge
// no responde (la app no está corriendo o no está en foco). Sin
// single-instance-lock, cada click abriría una ventana nueva en vez de
// enfocar la que ya existe — y dos procesos peleando por la misma sesión
// de WhatsApp (electron/auth) sería un problema real, no cosmético.
const PROTOCOLO = 'mejoraws'
const obtuvoLock = app.requestSingleInstanceLock()
if (!obtuvoLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
// En modo empaquetado alcanza con el nombre; en dev hace falta indicarle a
// Windows el exe de Electron + el path del proyecto como argumento, si no
// el registro del protocolo apunta a electron.exe pelado sin saber qué app abrir.
if (process.platform === 'win32') {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient(PROTOCOLO)
  } else if (process.argv[1]) {
    app.setAsDefaultProtocolClient(PROTOCOLO, process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOLO)
}

let mainWindow = null
let sock = null
let db = null
let campaignRunning = false
let stopRequested = false
let pauseRequested = false
let LOG_FILE = null
// Estado de conexión + bridge local — parte de la fusión MejoraSuite, ver
// electron/bridge.mjs para el detalle. No cambia nada del comportamiento
// existente, solo espeja lo que ya se manda por IPC hacia afuera del proceso.
let waStatus = 'desconectado'
let bridge = null

// Fase 2 de MejoraSuite: MejoraWS embebe MejoraContactos (producto público
// aparte, sigue siendo independiente — ver mejorasuite/ESPECIFICACION.md en
// el repo de MejoraCRM). Un solo WebContentsView, creado una vez y
// reusado — se oculta/muestra en vez de destruirse y recrearse, así no
// se pierde la sesión/estado de MejoraContactos al cambiar de pestaña.
const MEJORACONTACTOS_URL = 'https://pabloeckert.github.io/MejoraContactos/'
let contactosView = null

function ensureContactosView() {
  if (contactosView) return contactosView
  contactosView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  contactosView.webContents.loadURL(MEJORACONTACTOS_URL)
  mainWindow.contentView.addChildView(contactosView)
  contactosView.setVisible(false)
  return contactosView
}

// --- Modelo de datos ---
//
// La app se organiza en CARPETAS (una por cada uso: el cumple, los ferreteros,
// el aviso a los asociados...). Cada carpeta tiene su propia lista, su mensaje
// y su tono, y todas conviven sin pisarse.
//
//   contactos → la persona. Existe UNA sola vez aunque esté en varias
//               carpetas. Acá va lo que no cambia según el uso: nombre,
//               teléfono, si tiene WhatsApp.
//   carpetas  → cada uso. Adentro, "miembros" guarda qué pasó con cada
//               persona EN ESA carpeta (si le llegó, qué respondió).
//   config    → lo que es de la app entera, no de una carpeta: la API key,
//               tu número para el informe.

// Los tonos vienen con estos cuatro de fábrica, pero podés crear los tuyos.
const TONOS = {
  personal: {
    nombre: 'Personal',
    guia: 'Escribile como a alguien que conocés de verdad. Cercano, sin formalidad, sin nada que suene a plantilla ni a negocio.'
  },
  familiar: {
    nombre: 'Familiar',
    guia: 'Tono de familia y amigos: relajado, afectuoso, corto. Nada de estructura formal ni lenguaje de trabajo.'
  },
  comercial: {
    nombre: 'Comercial',
    guia: 'Cálido y directo a la vez. Nunca vende, clarifica. El problema nunca es la persona: es lo que falta.'
  },
  operativo: {
    nombre: 'Operativo',
    guia: 'Informativo y claro. Que se entienda qué hay que hacer, cuándo y dónde. Sin vueltas ni adornos.'
  }
}

// Criterio de Mejora Continua: manual de tono + los dos buyer personas que
// aplican a su lista. Solo se le pasa a la IA en las carpetas marcadas como
// comerciales — en el cumple del hijo, Pablo es el papa, no la consultora.
const BLOQUE_MEJORA_CONTINUA = `
## A quién le escribe
Dueños de comercio y pymes (ferreterías, bulonerías, distribuidoras) que ya conocen a Pablo. Casi siempre caen en uno de estos dos perfiles:

1. EMPRENDEDOR SATURADO — trabaja mucho, avanza poco, vive apagando incendios. Siente que todo depende de él. Dice "estoy en mil cosas", "no doy más", "no sé por dónde empezar". No busca motivación: busca claridad. Su dolor no es técnico, es mental.

2. EL QUE NECESITA ORDEN PARA CRECER — creció rápido y sin estructura, y sabe que si sigue así desbarranca. Dice "crecí rápido", "no llego a todo", "estoy a mil". Tiene miedo de que ordenar signifique frenar o perder lo logrado. No quiere trabajar menos: quiere trabajar mejor.

Ninguno de los dos busca motivación. Los dos buscan claridad y criterio.

## Cómo se les habla
Corto. Directo. Con autoridad serena. Sin tecnicismos, sin vueltas, con claridad inmediata. No necesita un pitch largo: necesita sentirse entendido.

Estructura que funciona: nombrar el dolor sin juzgar → correr el foco de "vos hiciste mal" a "esto funciona así, por eso pasa esto" → cerrar con una dirección concreta, nunca con un reto.

## Mensajes que le pegan (el patrón, no para copiar literal)
- "No estás saturado por trabajar mucho, sino por trabajar sin claridad."
- "Tu problema no es el tiempo, es el foco."
- "No necesitás más ideas, necesitás orden."
- "No necesitás cambiar todo, necesitás ordenar lo que ya funciona."
- "No estás mal, estás desordenado."
- "No estás frenando, estás ordenando para crecer."
El patrón es: negar el diagnóstico equivocado y devolver el verdadero en una sola frase.

## Qué NO decirle nunca
- "Tenés que organizarte mejor / delegar más / planificar / bajar un cambio." Todo eso ya lo sabe; decírselo suena a reto y a consejo genérico.
- "Tenés que frenar / cambiar todo / replantear tu negocio / hacer un proceso largo." Eso lo asusta, lo paraliza y lo aleja.
- Nada de "vos podés" ni motivación vacía.

## Criterio de marca (manda sobre todo lo demás)
- El sujeto del problema es siempre lo que falta — foco, estructura, criterio externo — NUNCA la capacidad ni la inteligencia de la persona.
- Cálido y directo a la vez: la calidez está en el cuidado detrás de decir la verdad, no en el consuelo.
- Nunca vende, clarifica. Nunca se vende por precio. Nada de urgencia artificial.
- Nunca tiene que sonar a mensaje armado, a IA o a plantilla de marketing: tiene que sonar como si Pablo lo tipeó él mismo, rápido, para alguien que ya conoce.
`

function nuevaCarpeta(nombre, tono = 'personal') {
  return {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nombre,
    tono,
    objetivo: '',
    creada: new Date().toISOString(),
    archivada: false,
    // Solo las carpetas comerciales de Mejora Continua aplican el manual de
    // marca y los buyer personas. En el cumple de tu hijo sos vos, no la
    // consultora.
    usarManualMarca: tono === 'comercial',
    config: {
      template: '',
      variantes: [],
      keywords: ['si', 'sí', 'dale', 'quiero', 'info', 'contame'],
      replyTemplate: '',
      acuseTemplate: 'Gracias por responder {nombre}. Lo leo bien y te contesto en un rato.',
      delayMin: 20,
      delayMax: 90,
      dailyCap: 40,
      sentToday: 0,
      lastSentDate: ''
    },
    miembros: []
  }
}

// --- Acceso a la carpeta abierta ---

function carpetaActiva() {
  const id = db.data.config.carpetaActivaId
  return db.data.carpetas.find((c) => c.id === id) || db.data.carpetas[0] || null
}

function contactoPorId(id) {
  return db.data.contactos.find((c) => c.id === id)
}

// Une la persona con lo que le pasó en ESTA carpeta. La UI trabaja con estas
// filas: para ella sigue siendo "un contacto con su estado", igual que antes.
function filaDeMiembro(m) {
  const c = contactoPorId(m.contactoId) || { id: m.contactoId, nombre: m.contactoId, telefono: m.contactoId }
  return { ...c, ...m, id: m.contactoId }
}

function filasDeCarpeta(carpeta) {
  return carpeta ? carpeta.miembros.map(filaDeMiembro) : []
}

function emitirContactos() {
  mainWindow?.webContents.send('contacts:updated', filasDeCarpeta(carpetaActiva()))
}

// Busca a una persona por teléfono dentro de la carpeta abierta. Devuelve el
// miembro (su estado acá) y el contacto (quién es), que viven separados.
function buscarEnCarpetaPorTelefono(carpeta, phone) {
  if (!carpeta) return {}
  const contacto = db.data.contactos.find((c) => normalizePhone(c.telefono) === phone)
  if (!contacto) return {}
  const miembro = carpeta.miembros.find((m) => m.contactoId === contacto.id)
  return { contacto, miembro }
}

function resumenCarpeta(c) {
  const total = c.miembros.length
  return {
    id: c.id,
    nombre: c.nombre,
    tono: c.tono,
    objetivo: c.objetivo,
    creada: c.creada,
    archivada: !!c.archivada,
    usarManualMarca: !!c.usarManualMarca,
    total,
    pendientes: c.miembros.filter((m) => m.estado === 'pendiente').length,
    enviados: c.miembros.filter((m) => m.estado === 'enviado').length,
    respondieron: c.miembros.filter((m) => String(m.estado).startsWith('respondio')).length
  }
}

// Convierte los datos del formato viejo (una sola lista global) al nuevo
// (carpetas). Corre una sola vez: lo que había pasa a ser la primera carpeta,
// sin perder un solo contacto ni una sola respuesta.
function migrarACarpetas() {
  if (!Array.isArray(db.data.contacts)) return // ya está migrado
  if (!db.data.contactos) db.data.contactos = []
  if (!db.data.carpetas) db.data.carpetas = []

  const viejos = db.data.contacts
  const cfgVieja = db.data.config || {}

  const carpeta = nuevaCarpeta('Mi primera lista', 'comercial')
  carpeta.objetivo = 'Lo que ya tenías cargado antes de organizar por carpetas'
  carpeta.config = {
    template: cfgVieja.template || '',
    variantes: cfgVieja.variantes || [],
    keywords: cfgVieja.keywords || ['si', 'sí', 'dale', 'quiero', 'info', 'contame'],
    replyTemplate: cfgVieja.replyTemplate || '',
    acuseTemplate: cfgVieja.acuseTemplate || 'Gracias por responder {nombre}. Lo leo bien y te contesto en un rato.',
    delayMin: cfgVieja.delayMin ?? 20,
    delayMax: cfgVieja.delayMax ?? 90,
    dailyCap: cfgVieja.dailyCap ?? 40,
    sentToday: cfgVieja.sentToday ?? 0,
    lastSentDate: cfgVieja.lastSentDate || ''
  }

  for (const v of viejos) {
    const telefono = normalizePhone(v.telefono)
    if (!telefono) continue

    if (!db.data.contactos.some((c) => c.id === telefono)) {
      db.data.contactos.push({
        id: telefono,
        nombre: v.nombre || telefono,
        apellido: v.apellido || '',
        telefono,
        variable: v.variable || '',
        // La validación de WhatsApp es de la persona, no de la carpeta:
        // que un número exista no cambia según para qué le escribas.
        waValido: v.waValido ?? null,
        waMotivo: v.waMotivo || null,
        notas: ''
      })
    }

    const m = nuevoMiembro(telefono)
    m.estado = v.estado || 'pendiente'
    m.incluido = v.incluido !== false
    m.fechaEnvio = v.fechaEnvio || null
    m.msgId = v.msgId || null
    // confirmadoServidor quedó redundante con entregaStatus: si venía marcado
    // pero sin etapa, se asume que al menos salió.
    m.entregaStatus = v.entregaStatus ?? (v.confirmadoServidor ? 2 : 0)
    m.fechaSalio = v.fechaSalio || null
    m.fechaLlego = v.fechaLlego || null
    m.fechaLeido = v.fechaLeido || null
    m.respuesta = v.respuesta || null
    m.fechaRespuesta = v.fechaRespuesta || null
    m.autoRespondido = !!v.autoRespondido
    m.fechaAutoRespuesta = v.fechaAutoRespuesta || null
    m.error = v.error || null
    carpeta.miembros.push(m)
  }

  db.data.carpetas.push(carpeta)
  db.data.config.carpetaActivaId = carpeta.id

  // Estos campos ahora viven en la carpeta, no en la config global
  for (const k of ['template', 'variantes', 'keywords', 'replyTemplate', 'acuseTemplate',
    'delayMin', 'delayMax', 'dailyCap', 'sentToday', 'lastSentDate']) {
    delete db.data.config[k]
  }
  delete db.data.contacts

  logEvent('migracion_a_carpetas', {
    contactos: db.data.contactos.length,
    miembros: carpeta.miembros.length,
    carpeta: carpeta.nombre
  })
}

function nuevoMiembro(contactoId) {
  return {
    contactoId,
    estado: 'pendiente',
    incluido: true,
    fechaEnvio: null,
    msgId: null,
    entregaStatus: 0,
    fechaSalio: null,
    fechaLlego: null,
    fechaLeido: null,
    respuesta: null,
    fechaRespuesta: null,
    autoRespondido: false,
    fechaAutoRespuesta: null,
    error: null
  }
}

const DEFAULT_DATA = {
  contactos: [],
  carpetas: [],
  config: {
    reportEnabled: true,
    reportPhone: '5493765007805',
    anthropicApiKeyEncrypted: '',
    carpetaActivaId: null,
    tonosPropios: {}
  }
}

// La API key de Anthropic nunca se guarda ni viaja en texto plano: se cifra
// con safeStorage (DPAPI en Windows) y solo se desencripta en memoria al
// momento de pegarla en el header de la request a la API.
function encryptApiKey(plainKey) {
  if (!safeStorage.isEncryptionAvailable()) return null
  return safeStorage.encryptString(plainKey).toString('base64')
}

// Lo que ve el renderer: la config de la carpeta abierta (mensaje, keywords,
// delays) mezclada con la global (tu número para el informe). De la API key
// solo sabe si hay una guardada — nunca el valor ni el blob cifrado.
function configForRenderer() {
  const { anthropicApiKeyEncrypted, tonosPropios, ...global } = db.data.config
  const carpeta = carpetaActiva()
  return {
    ...global,
    ...(carpeta ? carpeta.config : {}),
    apiKeyConfigured: !!anthropicApiKeyEncrypted,
    carpeta: carpeta ? resumenCarpeta(carpeta) : null
  }
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
      waStatus = 'conectado'
      mainWindow?.webContents.send('wa:status', waStatus)
      bridge?.broadcastEvent('status', waStatus)
      logEvent('wa_conectado')
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      waStatus = shouldReconnect ? 'reconectando' : 'desconectado'
      mainWindow?.webContents.send('wa:status', waStatus)
      bridge?.broadcastEvent('status', waStatus)
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
      bridge?.broadcastEvent('message', { phone, text, recibidoEn: new Date().toISOString() })
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

      // El mensaje puede pertenecer a cualquier carpeta, no solo a la abierta.
      let carpeta = null
      let miembro = null
      for (const c of db.data.carpetas) {
        const m = c.miembros.find((x) => x.msgId === msgId)
        if (m) { carpeta = c; miembro = m; break }
      }
      if (!miembro) continue

      // Los estados solo avanzan, nunca retroceden: si ya estaba leído, un
      // update tardío de "llegó" no lo tiene que pisar.
      const previo = miembro.entregaStatus || 0
      if (status <= previo) continue

      const ahora = new Date().toISOString()
      miembro.entregaStatus = status
      if (status >= 2 && !miembro.fechaSalio) miembro.fechaSalio = ahora
      if (status >= 3 && !miembro.fechaLlego) miembro.fechaLlego = ahora
      if (status >= 4 && !miembro.fechaLeido) miembro.fechaLeido = ahora

      await db.write()
      const persona = contactoPorId(miembro.contactoId)
      logEvent('mensaje_confirmado_whatsapp', {
        carpeta: carpeta.nombre,
        telefono: persona?.telefono,
        nombre: persona?.nombre,
        status,
        etapa: DELIVERY_LABELS[status] || String(status)
      })
      emitirContactos()
    }
  })
}

async function handleIncomingMessage(phone, text) {
  const now = new Date().toISOString()

  // ¿A qué carpeta corresponde esta respuesta? A la que le escribió último.
  // Si la misma persona está en varias, la respuesta va contra la conversación
  // más reciente, que es la que tiene en la cabeza cuando te contesta.
  let carpeta = null
  let miembro = null
  let persona = db.data.contactos.find((c) => normalizePhone(c.telefono) === phone)

  if (persona) {
    let ultimoEnvio = null
    for (const c of db.data.carpetas) {
      const m = c.miembros.find((x) => x.contactoId === persona.id)
      if (!m) continue
      const cuando = m.fechaEnvio || ''
      if (!miembro || cuando > ultimoEnvio) {
        carpeta = c
        miembro = m
        ultimoEnvio = cuando
      }
    }
  }

  // Alguien que no está en ninguna lista. Se guarda igual, en la carpeta
  // abierta, para que no se pierda el mensaje.
  if (!miembro) {
    carpeta = carpetaActiva()
    if (!carpeta) return
    if (!persona) {
      persona = {
        id: phone,
        nombre: phone,
        apellido: '',
        telefono: phone,
        variable: '',
        waValido: true,
        waMotivo: null,
        notas: ''
      }
      db.data.contactos.push(persona)
    }
    miembro = nuevoMiembro(persona.id)
    miembro.estado = 'respondio_no_listado'
    carpeta.miembros.push(miembro)
  } else {
    miembro.estado = 'respondio'
  }

  miembro.respuesta = text
  miembro.fechaRespuesta = now

  await db.write()
  emitirContactos()
  logEvent('mensaje_recibido', {
    carpeta: carpeta.nombre,
    telefono: phone,
    nombre: persona.nombre || phone,
    texto: text.slice(0, 140),
    listado: miembro.estado !== 'respondio_no_listado'
  })

  new Notification({
    title: `Respondió ${persona.nombre || phone}`,
    body: text.slice(0, 140)
  }).show()

  // Cada carpeta tiene sus propias keywords y sus propias respuestas: al
  // cumpleaños se contesta distinto que a un contacto comercial.
  const cfg = carpeta.config
  const keywords = (cfg.keywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean)
  const matched = keywords.some((k) => text.toLowerCase().includes(k))
  const datos = { ...persona, ...miembro }

  // Nadie que escribe se queda sin respuesta. Si dijo alguna de las keywords
  // ("dale", "info"...) va la respuesta con el link; si escribió cualquier
  // otra cosa igual recibe un acuse humano, para que no quede hablando solo.
  //
  // Se responde UNA sola vez por persona y por carpeta: a partir de ahí seguís
  // vos a mano. Eso evita el ping-pong automático — dos bots respondiéndose es
  // exactamente lo que WhatsApp detecta y bloquea.
  if (sock && !miembro.autoRespondido) {
    const texto = matched && cfg.replyTemplate
      ? renderTemplate(cfg.replyTemplate, datos)
      : renderTemplate(cfg.acuseTemplate, datos)

    if (texto.trim()) {
      miembro.autoRespondido = true
      miembro.fechaAutoRespuesta = new Date().toISOString()
      await db.write()

      const jid = `${phone}@s.whatsapp.net`
      // La demora es a propósito: contestar en el mismo segundo delata al bot.
      setTimeout(() => {
        sock?.sendMessage(jid, { text: texto }).catch(() => {})
        logEvent('auto_respuesta_enviada', {
          carpeta: carpeta.nombre,
          telefono: phone,
          nombre: persona.nombre || phone,
          tipo: matched ? 'con keyword' : 'acuse'
        })
      }, 4000 + Math.random() * 6000)
    }
  }
}

async function runCampaign(onlyIds = null) {
  const carpeta = carpetaActiva()
  if (!carpeta) return

  campaignRunning = true
  stopRequested = false
  pauseRequested = false
  const cfg = carpeta.config
  const today = new Date().toISOString().slice(0, 10)
  if (cfg.lastSentDate !== today) {
    cfg.sentToday = 0
    cfg.lastSentDate = today
  }

  const pendientesInicio = carpeta.miembros.filter((m) => m.estado === 'pendiente').length
  logEvent('campana_iniciada', {
    carpeta: carpeta.nombre,
    pendientes: pendientesInicio,
    soloSeleccionados: !!onlyIds
  })

  let enviadosCorrida = 0
  let erroresCorrida = 0
  let motivoFin = 'completado'
  let indiceEnvio = 0

  for (const miembro of carpeta.miembros) {
    const persona = contactoPorId(miembro.contactoId)
    if (!persona) continue
    // "contact" junta a la persona con su estado en esta carpeta, que es lo
    // que necesitan tanto el texto del mensaje como los logs.
    const contact = { ...persona, ...miembro }
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

    if (miembro.estado !== 'pendiente') continue

    // Si vino una lista puntual ("enviar solo a estos"), manda a esos sin
    // importar el flag incluido. Si no, respeta el flag incluido de cada uno
    // (default true — un contacto sin ese campo, de datos viejos, cuenta como incluido).
    if (onlyIds) {
      if (!onlyIds.includes(miembro.contactoId)) continue
    } else if (miembro.incluido === false) {
      continue
    }

    // Si ya lo validaste y WhatsApp dijo que ese número no existe, no gastes
    // un envío al pedo. (waValido null = nunca se validó, se manda igual.)
    if (persona.waValido === false) {
      miembro.estado = 'error'
      miembro.error = persona.waMotivo || 'El número no tiene WhatsApp'
      await db.write()
      continue
    }

    if (cfg.sentToday >= cfg.dailyCap) {
      mainWindow?.webContents.send('campaign:progress', { status: 'tope_diario_alcanzado' })
      logEvent('tope_diario_alcanzado', { enviadosHoy: cfg.sentToday })
      motivoFin = 'tope diario alcanzado'
      break
    }

    const jid = `${normalizePhone(persona.telefono)}@s.whatsapp.net`
    // Cada 5 envíos rota a la siguiente variante (si hay variantes generadas
    // por IA); si no hay, usa siempre la plantilla base.
    const variantes = cfg.variantes && cfg.variantes.length ? cfg.variantes : [cfg.template]
    const variantIndex = Math.floor(indiceEnvio / 5) % variantes.length
    const texto = renderTemplate(variantes[variantIndex], contact)

    if (!texto.trim()) {
      motivoFin = 'no hay mensaje escrito en esta carpeta'
      break
    }

    try {
      const sentMsg = await sock.sendMessage(jid, { text: texto })
      miembro.estado = 'enviado'
      miembro.fechaEnvio = new Date().toISOString()
      miembro.msgId = sentMsg?.key?.id || null
      // Arranca de cero el seguimiento de tildes para este envío
      miembro.entregaStatus = 0
      miembro.fechaSalio = null
      miembro.fechaLlego = null
      miembro.fechaLeido = null
      miembro.error = null
      cfg.sentToday += 1
      enviadosCorrida++
      indiceEnvio++
      logEvent('mensaje_enviado', {
        carpeta: carpeta.nombre,
        telefono: persona.telefono,
        nombre: persona.nombre,
        variante: variantIndex + 1
      })
    } catch (err) {
      miembro.estado = 'error'
      miembro.error = String(err?.message || err)
      erroresCorrida++
      logEvent('error_envio', {
        carpeta: carpeta.nombre,
        telefono: persona.telefono,
        nombre: persona.nombre,
        error: miembro.error
      })
    }

    await db.write()
    emitirContactos()
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
  logEvent('campana_detenida', { carpeta: carpeta.nombre, enviadosHoy: cfg.sentToday })

  const pendientesRestantes = carpeta.miembros.filter((m) => m.estado === 'pendiente').length
  await sendCycleReport({ carpeta, motivoFin, enviadosCorrida, erroresCorrida, pendientesRestantes })
}

function handleSend(telefono, carpetaId) {
  if (!sock) return { error: 'MejoraWS no está conectado a WhatsApp' }
  if (campaignRunning) return { error: 'Ya hay un envío en curso' }

  const carpeta = carpetaId
    ? db.data.carpetas.find((c) => c.id === carpetaId)
    : carpetaActiva()
  if (!carpeta) return { error: 'Carpeta no encontrada' }

  const telefonoNorm = normalizePhone(telefono)
  const miembro = carpeta.miembros.find((m) => {
    const persona = contactoPorId(m.contactoId)
    return persona && normalizePhone(persona.telefono) === telefonoNorm && m.estado === 'pendiente'
  })
  if (!miembro) {
    return { error: `No se encontró un contacto pendiente con ese teléfono en la carpeta "${carpeta.nombre}"` }
  }

  runCampaign([miembro.contactoId])
  return { started: true, carpeta: carpeta.nombre }
}

// Carpeta fija para los envíos de un solo contacto que llegan desde
// MejoraContactos (Fase 6 de MejoraSuite) — deliberadamente separada de
// cualquier carpeta de campaña masiva, para no mezclar "un contacto que
// alguien mandó a mano desde otra app" con una campaña real (ver
// mejorasuite/DECISIONES.md, entrada 2026-08-17).
const CARPETA_CONTACTOS_NOMBRE = 'Importados desde MejoraContactos'

function carpetaContactosImportados() {
  let carpeta = db.data.carpetas.find((c) => c.nombre === CARPETA_CONTACTOS_NOMBRE)
  if (!carpeta) {
    carpeta = nuevaCarpeta(CARPETA_CONTACTOS_NOMBRE, 'comercial')
    carpeta.objetivo = 'Contactos enviados a mano desde MejoraContactos — no es una carpeta de campaña masiva'
    db.data.carpetas.push(carpeta)
  }
  return carpeta
}

/**
 * Variante de handleSend para contactos que todavía no son miembros de
 * ninguna carpeta (el caso normal viniendo de MejoraContactos: esa app no
 * comparte datos con MejoraWS). Da de alta a la persona y la agrega como
 * miembro "pendiente" de la carpeta dedicada si hace falta, y después
 * delega en handleSend tal cual — no duplica ninguna validación ni lógica
 * de envío nueva.
 *
 * Async a propósito: si handleSend corta temprano (ej. WhatsApp
 * desconectado), nunca llega a runCampaign, que es quien normalmente
 * persiste con db.write() — sin el await de acá, el contacto/carpeta nuevos
 * quedarían solo en memoria y se perderían al cerrar la app.
 */
async function handleAddAndSend(telefono, nombre) {
  const telefonoNorm = normalizePhone(telefono)
  if (!telefonoNorm) return { error: 'Teléfono inválido' }

  const carpeta = carpetaContactosImportados()

  if (!contactoPorId(telefonoNorm)) {
    db.data.contactos.push({
      id: telefonoNorm,
      nombre: nombre || telefonoNorm,
      apellido: '',
      telefono: telefonoNorm,
      variable: '',
      waValido: null,
      waMotivo: null,
      notas: 'Agregado desde MejoraContactos'
    })
  }

  if (!carpeta.miembros.some((m) => m.contactoId === telefonoNorm)) {
    carpeta.miembros.push(nuevoMiembro(telefonoNorm))
  }

  await db.write()
  emitirContactos()

  return handleSend(telefonoNorm, carpeta.id)
}

async function sendCycleReport({ carpeta, motivoFin, enviadosCorrida, erroresCorrida, pendientesRestantes }) {
  const cfg = db.data.config
  if (!cfg.reportEnabled || !cfg.reportPhone || !sock) return

  const jid = `${normalizePhone(cfg.reportPhone)}@s.whatsapp.net`
  const texto = `📋 MejoraContacto — "${carpeta.nombre}" terminó (${motivoFin})

Enviados en esta corrida: ${enviadosCorrida}
Errores: ${erroresCorrida}
Enviados hoy en esta carpeta: ${carpeta.config.sentToday}/${carpeta.config.dailyCap}
Pendientes restantes: ${pendientesRestantes}`

  try {
    await sock.sendMessage(jid, { text: texto })
    logEvent('informe_enviado', { motivoFin, enviadosCorrida, erroresCorrida })
  } catch (err) {
    logEvent('error_informe', { error: String(err?.message || err) })
  }
}

function registerIpcHandlers() {
  // --- Carpetas ---

  ipcMain.handle('carpetas:list', () => ({
    carpetas: db.data.carpetas.map(resumenCarpeta),
    activaId: carpetaActiva()?.id || null,
    tonos: { ...TONOS, ...(db.data.config.tonosPropios || {}) }
  }))

  ipcMain.handle('carpetas:create', async (_e, { nombre, tono, objetivo }) => {
    const limpio = (nombre || '').trim()
    if (!limpio) return { error: 'Poné un nombre para la carpeta' }
    if (db.data.carpetas.some((c) => c.nombre.toLowerCase() === limpio.toLowerCase())) {
      return { error: 'Ya tenés una carpeta con ese nombre' }
    }

    const carpeta = nuevaCarpeta(limpio, tono || 'personal')
    carpeta.objetivo = (objetivo || '').trim()
    db.data.carpetas.push(carpeta)
    db.data.config.carpetaActivaId = carpeta.id
    await db.write()
    logEvent('carpeta_creada', { nombre: carpeta.nombre, tono: carpeta.tono })
    emitirContactos()
    return { ok: true, id: carpeta.id }
  })

  ipcMain.handle('carpetas:activar', async (_e, id) => {
    if (campaignRunning) return { error: 'Hay un envío en curso. Detenelo antes de cambiar de carpeta.' }
    if (!db.data.carpetas.some((c) => c.id === id)) return { error: 'Esa carpeta no existe' }
    db.data.config.carpetaActivaId = id
    await db.write()
    emitirContactos()
    return { ok: true }
  })

  ipcMain.handle('carpetas:update', async (_e, { id, nombre, tono, objetivo, usarManualMarca }) => {
    const carpeta = db.data.carpetas.find((c) => c.id === id)
    if (!carpeta) return { error: 'Esa carpeta no existe' }

    if (typeof nombre === 'string' && nombre.trim()) {
      const repetido = db.data.carpetas.some(
        (c) => c.id !== id && c.nombre.toLowerCase() === nombre.trim().toLowerCase()
      )
      if (repetido) return { error: 'Ya tenés una carpeta con ese nombre' }
      carpeta.nombre = nombre.trim()
    }
    if (typeof tono === 'string') carpeta.tono = tono
    if (typeof objetivo === 'string') carpeta.objetivo = objetivo
    if (typeof usarManualMarca === 'boolean') carpeta.usarManualMarca = usarManualMarca

    await db.write()
    return { ok: true }
  })

  ipcMain.handle('carpetas:delete', async (_e, id) => {
    if (campaignRunning) return { error: 'Hay un envío en curso. Detenelo primero.' }
    const carpeta = db.data.carpetas.find((c) => c.id === id)
    if (!carpeta) return { error: 'Esa carpeta no existe' }
    if (db.data.carpetas.length === 1) return { error: 'Es la única carpeta que tenés: no se puede borrar' }

    db.data.carpetas = db.data.carpetas.filter((c) => c.id !== id)
    if (db.data.config.carpetaActivaId === id) {
      db.data.config.carpetaActivaId = db.data.carpetas[0]?.id || null
    }

    // Igual que al borrar contactos o vaciar una lista: si alguien quedó sin
    // pertenecer a ninguna carpeta, se va del todo en vez de quedar huérfano.
    const idsQueQuedaron = carpeta.miembros.map((m) => m.contactoId)
    for (const cid of idsQueQuedaron) {
      const enAlguna = db.data.carpetas.some((c) => c.miembros.some((m) => m.contactoId === cid))
      if (!enAlguna) db.data.contactos = db.data.contactos.filter((c) => c.id !== cid)
    }

    await db.write()
    logEvent('carpeta_eliminada', { nombre: carpeta.nombre, miembros: carpeta.miembros.length })
    emitirContactos()
    return { ok: true }
  })

  // --- Contactos (siempre dentro de la carpeta abierta) ---

  ipcMain.handle('contacts:import', async (_e, rows) => {
    const carpeta = carpetaActiva()
    if (!carpeta) return { error: 'Creá una carpeta primero' }

    const yaEnCarpeta = new Set(carpeta.miembros.map((m) => m.contactoId))
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
      if (yaEnCarpeta.has(telefono)) {
        duplicados++
        continue
      }

      // La persona se guarda una sola vez. Si ya la tenías de otra carpeta, se
      // reusa: mantiene su validación de WhatsApp y sus notas.
      if (!contactoPorId(telefono)) {
        db.data.contactos.push({
          id: telefono,
          nombre: (nameKey ? row[nameKey] : '') || telefono,
          apellido: (lastNameKey ? row[lastNameKey] : '') || '',
          telefono,
          variable: '',
          waValido: null,
          waMotivo: null,
          notas: ''
        })
      }

      carpeta.miembros.push(nuevoMiembro(telefono))
      yaEnCarpeta.add(telefono)
      added++
    }

    await db.write()
    emitirContactos()
    logEvent('contactos_importados', {
      carpeta: carpeta.nombre,
      added,
      sinTelefono,
      duplicados,
      total: carpeta.miembros.length
    })
    return { added, sinTelefono, duplicados, total: carpeta.miembros.length }
  })

  ipcMain.handle('contacts:list', () => filasDeCarpeta(carpetaActiva()))

  ipcMain.handle('contacts:update', async (_e, data) => {
    const persona = contactoPorId(data.id)
    if (!persona) return { error: 'Contacto no encontrado' }

    const nuevoTelefono = normalizePhone(data.telefono)
    if (!nuevoTelefono) return { error: 'Teléfono inválido' }

    if (nuevoTelefono !== persona.telefono) {
      const enUso = db.data.contactos.some((c) => c.id !== persona.id && normalizePhone(c.telefono) === nuevoTelefono)
      if (enUso) return { error: 'Ese teléfono ya lo tiene otro contacto' }
    }

    const idViejo = persona.id
    persona.nombre = data.nombre?.trim() || nuevoTelefono
    persona.apellido = data.apellido?.trim() || ''
    persona.telefono = nuevoTelefono
    persona.variable = data.variable?.trim() || ''
    persona.id = nuevoTelefono

    // Si cambió el número, cambió el id: hay que reapuntar sus membresías en
    // TODAS las carpetas, no solo en la abierta.
    if (idViejo !== nuevoTelefono) {
      persona.waValido = null // el número es otro: la validación anterior ya no vale
      persona.waMotivo = null
      for (const c of db.data.carpetas) {
        for (const m of c.miembros) {
          if (m.contactoId === idViejo) m.contactoId = nuevoTelefono
        }
      }
    }

    await db.write()
    emitirContactos()
    logEvent('contacto_editado', { telefono: nuevoTelefono, nombre: persona.nombre })
    return { ok: true }
  })

  // Saca a la persona de ESTA carpeta. Sigue existiendo en las otras.
  ipcMain.handle('contacts:delete', async (_e, ids) => {
    const carpeta = carpetaActiva()
    if (!carpeta) return { error: 'No hay carpeta abierta' }

    const antes = carpeta.miembros.length
    carpeta.miembros = carpeta.miembros.filter((m) => !ids.includes(m.contactoId))
    const eliminados = antes - carpeta.miembros.length

    // Si la persona no quedó en ninguna carpeta, se va del todo.
    for (const id of ids) {
      const enAlguna = db.data.carpetas.some((c) => c.miembros.some((m) => m.contactoId === id))
      if (!enAlguna) db.data.contactos = db.data.contactos.filter((c) => c.id !== id)
    }

    await db.write()
    emitirContactos()
    logEvent('contactos_eliminados', { carpeta: carpeta.nombre, cantidad: eliminados })
    return { ok: true, eliminados }
  })

  ipcMain.handle('contacts:setIncluido', async (_e, { ids, incluido }) => {
    const carpeta = carpetaActiva()
    if (!carpeta) return { error: 'No hay carpeta abierta' }
    for (const m of carpeta.miembros) {
      if (ids.includes(m.contactoId)) m.incluido = incluido
    }
    await db.write()
    emitirContactos()
    return { ok: true }
  })

  ipcMain.handle('contacts:setEstado', async (_e, { ids, estado }) => {
    const carpeta = carpetaActiva()
    if (!carpeta) return { error: 'No hay carpeta abierta' }
    for (const m of carpeta.miembros) {
      if (ids.includes(m.contactoId)) {
        m.estado = estado
        if (estado === 'pendiente') m.error = null
      }
    }
    await db.write()
    emitirContactos()
    logEvent('contactos_estado_cambiado', { carpeta: carpeta.nombre, cantidad: ids.length, estado })
    return { ok: true }
  })

  // Le pregunta a WhatsApp cuáles de estos números tienen cuenta de verdad.
  // Sirve para no quemar envíos (y reputación del número) contra teléfonos
  // mal tipeados o que directamente no tienen WhatsApp.
  ipcMain.handle('contacts:validate', async (_e, ids) => {
    if (!sock) return { error: 'Conectá WhatsApp primero' }

    // La validación es de la persona, no de la carpeta: si no se pasan ids,
    // se validan los de la carpeta abierta.
    const carpeta = carpetaActiva()
    const objetivo = Array.isArray(ids) && ids.length
      ? db.data.contactos.filter((c) => ids.includes(c.id))
      : (carpeta ? carpeta.miembros.map((m) => contactoPorId(m.contactoId)).filter(Boolean) : [])

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
    emitirContactos()
    logEvent('contactos_validados', {
      revisados: objetivo.length,
      conWhatsapp,
      sinWhatsapp,
      formatoRaro,
      errores
    })
    return { ok: true, revisados: objetivo.length, conWhatsapp, sinWhatsapp, formatoRaro, errores }
  })

  // Vacía la carpeta abierta. Las otras carpetas no se tocan.
  ipcMain.handle('contacts:clearAll', async () => {
    const carpeta = carpetaActiva()
    if (!carpeta) return { error: 'No hay carpeta abierta' }

    const cantidadAnterior = carpeta.miembros.length
    const eran = carpeta.miembros.map((m) => m.contactoId)
    carpeta.miembros = []

    for (const id of eran) {
      const enAlguna = db.data.carpetas.some((c) => c.miembros.some((m) => m.contactoId === id))
      if (!enAlguna) db.data.contactos = db.data.contactos.filter((c) => c.id !== id)
    }

    await db.write()
    emitirContactos()
    logEvent('contactos_vaciados', { carpeta: carpeta.nombre, cantidadAnterior })
    return { ok: true }
  })

  ipcMain.handle('app:resetTotal', async () => {
    db.data.contactos = []
    db.data.carpetas = []
    db.data.config = { ...DEFAULT_DATA.config }

    // Siempre tiene que quedar una carpeta para que la app sea usable
    const primera = nuevaCarpeta('Mi primera carpeta', 'personal')
    db.data.carpetas.push(primera)
    db.data.config.carpetaActivaId = primera.id
    await db.write()

    try {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
      fs.writeFileSync(LOG_FILE, '')
    } catch {
      // si falla la limpieza del log, no bloquea el reset del resto
    }
    logEvent('app_reset_total')

    emitirContactos()
    return { ok: true, config: configForRenderer() }
  })

  ipcMain.handle('contacts:addManual', async (_e, data) => {
    const carpeta = carpetaActiva()
    if (!carpeta) return { error: 'Creá una carpeta primero' }

    const telefono = normalizePhone(data?.telefono)
    if (!telefono) return { error: 'Teléfono inválido' }

    if (carpeta.miembros.some((m) => m.contactoId === telefono)) {
      return { error: 'Ese teléfono ya está en esta carpeta' }
    }

    if (!contactoPorId(telefono)) {
      db.data.contactos.push({
        id: telefono,
        nombre: data.nombre?.trim() || telefono,
        apellido: data.apellido?.trim() || '',
        telefono,
        variable: data.variable?.trim() || '',
        waValido: null,
        waMotivo: null,
        notas: ''
      })
    }
    carpeta.miembros.push(nuevoMiembro(telefono))
    await db.write()
    emitirContactos()
    logEvent('contacto_agregado_manual', { carpeta: carpeta.nombre, telefono, nombre: data.nombre })
    return { ok: true }
  })

  ipcMain.handle('config:get', () => configForRenderer())

  ipcMain.handle('config:set', async (_e, config) => {
    // apiKeyConfigured es un campo sintético que arma configForRenderer()
    // para el lado del renderer — nunca tiene que volver a escribirse en la
    // config real, o ensucia data.json con un campo que no es de config.
    const { anthropicApiKey, apiKeyConfigured, carpeta: _c, ...rest } = config || {}

    // Los campos del mensaje son de la carpeta abierta; el resto (API key, tu
    // número para el informe) son de la app entera.
    const DE_CARPETA = ['template', 'variantes', 'keywords', 'replyTemplate',
      'acuseTemplate', 'delayMin', 'delayMax', 'dailyCap', 'sentToday', 'lastSentDate']

    const carpeta = carpetaActiva()
    for (const [k, v] of Object.entries(rest)) {
      if (DE_CARPETA.includes(k)) {
        // Object.assign en vez de reemplazar el objeto: una campaña en curso
        // tiene una referencia viva a carpeta.config. Si acá se creara uno
        // nuevo, seguiría leyendo el viejo — el mensaje corregido no se usaría
        // y el contador de enviados del día se perdería.
        if (carpeta) carpeta.config[k] = v
      } else {
        db.data.config[k] = v
      }
    }

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
    waStatus = 'desconectado'
    mainWindow?.webContents.send('wa:status', waStatus)
    bridge?.broadcastEvent('status', waStatus)
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
    // sentToday/dailyCap son de la carpeta, no de la config global — quedó
    // referenciando el lugar viejo cuando eso se movió adentro de la carpeta.
    const cfg = carpetaActiva()?.config || {}
    mainWindow?.webContents.send('campaign:progress', {
      status: 'pausado',
      enviadosHoy: cfg.sentToday,
      dailyCap: cfg.dailyCap
    })
    logEvent('campana_pausada', { enviadosHoy: cfg.sentToday })
    return { ok: true }
  })

  ipcMain.handle('campaign:resume', () => {
    if (!campaignRunning) return { error: 'No hay ningún envío en curso' }
    pauseRequested = false
    logEvent('campana_reanudada', { enviadosHoy: carpetaActiva()?.config.sentToday })
    return { ok: true }
  })

  ipcMain.handle('logs:summary', () => buildSummaryText())

  ipcMain.handle('ai:reviewTemplate', async (_e, template) => {
    const apiKey = getDecryptedApiKey()
    if (!apiKey) return { error: 'Falta cargar tu API key de Anthropic en Configuración.' }
    if (!template?.trim()) return { error: 'Escribí un mensaje primero.' }

    const carpeta = carpetaActiva()
    const tonos = { ...TONOS, ...(db.data.config.tonosPropios || {}) }
    const tono = tonos[carpeta?.tono] || TONOS.personal

    // El manual de marca SOLO se aplica donde corresponde. Para el cumpleaños
    // del hijo, Pablo es el papá, no la consultora: meterle criterio comercial
    // ahí arruinaría el mensaje.
    const bloqueMarca = carpeta?.usarManualMarca ? BLOQUE_MEJORA_CONTINUA : ''

    const systemPrompt = `Sos el asistente de escritura de Pablo. Te pasa mensajes de WhatsApp antes de mandarlos y vos los revisás.

## Para qué es este mensaje
Carpeta: "${carpeta?.nombre || 'sin nombre'}"${carpeta?.objetivo ? `\nObjetivo: ${carpeta.objetivo}` : ''}
Registro: ${tono.nombre} — ${tono.guia}

## Reglas que valen siempre
- Español rioplatense (vos, no tú), con todos los acentos y la ñ correctos.
- Mantené EXACTAMENTE los tags entre llaves que aparezcan ({nombre}, {apellido}, {variable}), sin traducirlos ni sacarlos.
- DOGMA: no puede sonar a IA ni a plantilla. Tiene que sonar a que lo escribió Pablo, rápido, a alguien que ya conoce. Si suena perfecto y pulido, está mal.
- Corregí ortografía y gramática, y señalá lo que se entienda mal o sea ambiguo.
- No infles el mensaje: si el original es corto y funciona, dejalo corto.
${bloqueMarca}
## Tu tarea
Revisá el mensaje contra todo lo de arriba.

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

      // Las variantes son de la carpeta abierta, no de la config global — si
      // se guardaran en la global, quedarían tapadas por el carpeta.config.variantes
      // vacío en el próximo configForRenderer() y la rotación nunca las usaría.
      const variantesGeneradas = Array.isArray(parsed.variantes) ? parsed.variantes : []
      if (carpeta) carpeta.config.variantes = variantesGeneradas
      await db.write()
      logEvent('mensaje_revisado_ia', { esClaro: parsed.esClaro, variantesGeneradas: variantesGeneradas.length })

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
      // Exporta TODAS las carpetas: una fila por persona y carpeta, para que
      // en Excel puedas filtrar por carpeta o ver el recorrido de alguien.
      const filas = []
      for (const carp of db.data.carpetas) {
        for (const m of carp.miembros) {
          const p = contactoPorId(m.contactoId) || {}
          filas.push({ ...p, ...m, carpetaNombre: carp.nombre, carpetaTono: carp.tono })
        }
      }
      cantidad = filas.length
      csv = toCsv(filas, [
        { titulo: 'Carpeta', valor: (c) => c.carpetaNombre || '' },
        { titulo: 'Tono', valor: (c) => c.carpetaTono || '' },
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

  // Fase 2 de MejoraSuite — embebido de MejoraContactos. `bounds` viene del
  // renderer (getBoundingClientRect() del slot donde tiene que aparecer),
  // en las mismas coordenadas CSS de la ventana.
  ipcMain.handle('contactos:show', (_e, bounds) => {
    const view = ensureContactosView()
    view.setBounds(bounds)
    view.setVisible(true)
    return true
  })

  ipcMain.handle('contactos:hide', () => {
    contactosView?.setVisible(false)
    return true
  })

  ipcMain.handle('contactos:updateBounds', (_e, bounds) => {
    contactosView?.setBounds(bounds)
    return true
  })

  // Fase 3 de MejoraSuite — MejoraContactos (web, sin acceso a filesystem)
  // no puede leer bridge-token.txt del disco como sí puede otra app
  // Electron. Este handler deja copiar el token a mano una sola vez desde
  // acá; MejoraContactos lo guarda cifrado en su localStorage (mismo
  // patrón que ya usa para las API keys de IA, ver api-keys.ts en ese repo).
  ipcMain.handle('bridge:getToken', () => bridge?.token ?? null)
  ipcMain.handle('bridge:copyToken', () => {
    if (bridge?.token) clipboard.writeText(bridge.token)
    return !!bridge?.token
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
  migrarACarpetas()
  // Instalación totalmente nueva (nunca tuvo el formato viejo, así que
  // migrarACarpetas() no crea nada): igual tiene que arrancar con una carpeta,
  // o la app queda inusable hasta que el usuario cree la primera a mano.
  if (db.data.carpetas.length === 0) {
    const primera = nuevaCarpeta('Mi primera carpeta', 'personal')
    db.data.carpetas.push(primera)
    db.data.config.carpetaActivaId = primera.id
  }
  await db.write()
  registerIpcHandlers()
  createWindow()
   bridge = startBridgeServer(app.getPath('userData'), () => ({
    connected: waStatus === 'conectado',
    waStatus,
    campaignRunning,
    stopRequested,
    pauseRequested,
  }), handleSend, handleAddAndSend)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
