/**
 * MEJORA DOCTOR — Diagnóstico y Auditoría Operativa de MejoraWS
 * Basado en estándares de Kendall & Kendall y Robert C. Martin.
 * Ejecuta validaciones de entorno, formateo de números, puertos y monorepo.
 */

import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { formatToJid, parseRecipientsText, gaussianRandomDelayMs, calculateTypingDurationMs } from '../electron/pure.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

console.log('====================================================================')
console.log('  🔍 MEJORA DOCTOR — Diagnóstico de Salud y Gobernanza Técnica')
console.log('====================================================================\n')

let passCount = 0
let warnCount = 0
let failCount = 0

function check(title, condition, info = '') {
  if (condition) {
    console.log(`  [OK] ${title}`)
    if (info) console.log(`       ↳ ${info}`)
    passCount++
  } else {
    console.log(`  [FALLÓ] ${title}`)
    if (info) console.log(`          ↳ ${info}`)
    failCount++
  }
}

function warn(title, info = '') {
  console.log(`  [ATENCIÓN] ${title}`)
  if (info) console.log(`             ↳ ${info}`)
  warnCount++
}

// 1. Entorno de Ejecución Node.js
const nodeVersion = process.versions.node
const [major] = nodeVersion.split('.').map(Number)
check('Versión de Node.js', major >= 18, `Node ${nodeVersion} detectado (Recomendado >= 20.x)`)

// 2. Archivos y configuración
const envPath = path.join(ROOT_DIR, '.env')
const envExamplePath = path.join(ROOT_DIR, '.env.example')
check('Existencia de .env.example', fs.existsSync(envExamplePath), 'Plantilla base de variables disponible')

if (fs.existsSync(envPath)) {
  check('Archivo .env configurado', true, 'Variables locales presentes')
} else {
  warn('Archivo .env no encontrado', 'Se usará .env.example como plantilla de fallback en desarrollo')
}

// 3. Verificación de Formateo de Números de Prueba (3764358152 y 3765007805)
const jid1 = formatToJid('3764358152')
const jid2 = formatToJid('3765007805')
check(
  'Normalización JID WhatsApp 3764358152',
  jid1 === '5493764358152@s.whatsapp.net',
  `Formateado a: ${jid1} (Prefijo internacional Argentina 549 validado)`
)
check(
  'Normalización JID WhatsApp 3765007805',
  jid2 === '5493765007805@s.whatsapp.net',
  `Formateado a: ${jid2} (Prefijo internacional Argentina 549 validado)`
)

// 4. Parser de Destinatarios (Copy-Paste / Carga Rápida)
const parsed = parseRecipientsText('Pablo, 3764358152\nMaria; 3765007805; Consulta')
check(
  'Parser de texto y listas copy-paste',
  parsed.length === 2 && parsed[0].telefono === '3764358152' && parsed[1].telefono === '3765007805',
  `Detectó correctamente ${parsed.length} destinatarios con nombres y variables`
)

// 5. Verificación de Fórmulas Matemáticas Anti-Ban
const jitter = gaussianRandomDelayMs(4, 12)
const typing = calculateTypingDurationMs(50)
check(
  'Generador estocástico Box-Muller (Jitter Anti-Ban)',
  jitter >= 4000 && jitter <= 12000,
  `Retardo orgánico generado: ${(jitter / 1000).toFixed(2)}s`
)
check(
  'Simulación de presencia "composing" humana',
  typing >= 1500 && typing <= 4000,
  `Tiempo de tipeo calculado para 50 caracteres: ${(typing / 1000).toFixed(2)}s`
)

// 6. Integridad de los módulos del Monorepo PRD v1.0
const sharedDist = path.join(ROOT_DIR, 'packages', 'shared', 'dist', 'index.js')
const apiDist = path.join(ROOT_DIR, 'apps', 'orchestrator-api', 'dist', 'index.js')
const workerDist = path.join(ROOT_DIR, 'apps', 'orchestrator-worker', 'dist', 'index.js')
const dashboardDist = path.join(ROOT_DIR, 'apps', 'dashboard-ui', 'dist', 'index.html')
const migration2Path = path.join(ROOT_DIR, 'database', 'migrations', '002_ai_telemetry_and_migrations.sql')

check('@mejoraws/shared compilado', fs.existsSync(sharedDist), 'Núcleo de dominio disponible')
check('@mejoraws/orchestrator-api compilado', fs.existsSync(apiDist), 'Backend Fastify listo')
check('@mejoraws/orchestrator-worker compilado', fs.existsSync(workerDist), 'Consumidor BullMQ listo')
check('@mejoraws/dashboard-ui compilado', fs.existsSync(dashboardDist), 'Dashboard Web listo')
check('Migración 002 (Telemetría IA y Gemini 3.8)', fs.existsSync(migration2Path), 'Migración SQL 2026/2027 presente')

// 7. Chequeo de puertos locales
async function checkPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    server.listen(port)
  })
}

const p3000 = await checkPortFree(3000)
const p5174 = await checkPortFree(5174)
const p5176 = await checkPortFree(5176)

check('Puerto 3000 (Orchestrator API)', p3000, p3000 ? 'Libre para usar' : 'Ocupado por otro proceso')
check('Puerto 5174 (Dashboard Web Vite)', p5174, p5174 ? 'Libre para usar' : 'Ocupado por otro proceso')
check('Puerto 5176 (Desktop Renderer Vite)', p5176, p5176 ? 'Libre para usar' : 'Ocupado por otro proceso')

console.log('\n--------------------------------------------------------------------')
console.log(`  RESUMEN: ${passCount} pruebas superadas, ${warnCount} advertencias, ${failCount} fallos.`)
if (failCount === 0) {
  console.log('  ESTADO: SISTEMA 100% OPERATIVO Y LISTO PARA ENVIAR.')
} else {
  console.log('  ESTADO: SE DETECTARON OBSERVACIONES QUE REQUIEREN ATENCIÓN.')
}
console.log('====================================================================\n')
process.exit(failCount === 0 ? 0 : 1)
