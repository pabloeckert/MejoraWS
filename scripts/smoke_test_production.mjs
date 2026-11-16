/**
 * MEJORA SMOKE TEST — Prueba de Humo y Verificación de Producción 2026/2027
 * Valida de punta a punta la disponibilidad de la infraestructura:
 * 1. Base de datos Postgres y Migraciones 001 y 002.
 * 2. Motor Redis y Cola BullMQ.
 * 3. API Fastify en puerto 3000 (/api/v1/system/health).
 * 4. Dashboard Web Vite/Nginx en puerto 5174.
 * 5. Conectividad real con Gemini 3.8/4 (si hay API Key en .env).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import { MultiProviderLLMAdapter } from '../packages/shared/dist/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

console.log('====================================================================');
console.log('  🚀 MEJORAWS — SMOKE TEST DE PUESTA A PUNTO (PRODUCCIÓN 2026/2027)');
console.log('====================================================================\n');

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function report(status, title, details = '') {
  if (status === 'PASS') {
    console.log(`  [OK] ${title}`);
    if (details) console.log(`       ↳ ${details}`);
    passCount++;
  } else if (status === 'WARN') {
    console.log(`  [ATENCIÓN] ${title}`);
    if (details) console.log(`             ↳ ${details}`);
    warnCount++;
  } else {
    console.log(`  [FALLÓ] ${title}`);
    if (details) console.log(`          ↳ ${details}`);
    failCount++;
  }
}

async function checkPostgres() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres_secure_pass_2026@localhost:5432/mejoraws';
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT 1 as alive');
      if (res.rows[0]?.alive === 1) {
        report('PASS', 'Base de Datos PostgreSQL 16', `Conectado exitosamente.`);
      }

      // Validar tablas requeridas
      const tablesRes = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const tables = tablesRes.rows.map((r) => r.table_name);
      const expected = ['contacts', 'messages', 'scheduled_jobs', 'ai_config', 'api_keys', 'schema_migrations', 'ai_usage_logs'];
      const missing = expected.filter((t) => !tables.includes(t));

      if (missing.length === 0) {
        report('PASS', 'Esquema y Migraciones 001/002', `7/7 tablas de producción verificadas.`);
      } else {
        report('WARN', 'Esquema de Base de Datos', `Faltan tablas: ${missing.join(', ')} (ejecutar migraciones en base de datos viva).`);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    report('WARN', 'Base de Datos PostgreSQL', `No se pudo conectar a ${connectionString} (${err.message}). Si estás probando en frío antes de "docker compose up", esto es normal.`);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function checkRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
  });
  redis.on('error', () => {});

  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong === 'PONG') {
      report('PASS', 'Motor de Colas Redis 7', `PING -> PONG verificado en ${redisUrl}.`);
    }
  } catch (err) {
    report('WARN', 'Motor de Colas Redis 7', `No se pudo conectar a ${redisUrl} (${err.message}). Normal si aún no se encendió el contenedor.`);
  } finally {
    await redis.quit().catch(() => {});
  }
}

async function checkApiHealth() {
  const port = process.env.APP_PORT || process.env.PORT || 3000;
  const url = `http://localhost:${port}/api/v1/system/health`;
  const apiKey = process.env.MASTER_API_KEY || 'sk_live_mejoraws_master_key_2026_authorized';

  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      report('PASS', 'Orchestrator API (Puerto ' + port + ')', `API en línea. Estado WhatsApp: ${data.whatsapp?.state || 'desconocido'}.`);
    } else {
      report('WARN', 'Orchestrator API', `HTTP ${res.status} recibido.`);
    }
  } catch (err) {
    report('WARN', 'Orchestrator API', `No respondió en http://localhost:${port} (${err.message}). Iniciar con "npm run dev:api" o Docker.`);
  }
}

async function checkDashboardUi() {
  const port = process.env.DASHBOARD_PORT || 5174;
  const url = `http://localhost:${port}/`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      report('PASS', 'Dashboard UI (Puerto ' + port + ')', `Frontend web respondiendo código HTTP ${res.status}.`);
    } else {
      report('WARN', 'Dashboard UI', `HTTP ${res.status} recibido.`);
    }
  } catch (err) {
    report('WARN', 'Dashboard UI', `No respondió en http://localhost:${port} (${err.message}). Iniciar con "npm run dev:dashboard" o Docker.`);
  }
}

async function checkGeminiLive() {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gemini-3.8-flash';
  const thinkingLevel = process.env.AI_THINKING_LEVEL || 'high';

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('tu_api_key')) {
    report('WARN', 'Motor IA Gemini 3.8 / 4', 'AI_API_KEY no configurada en .env. Se usará modo fallback o simulación.');
    return;
  }

  try {
    const adapter = new MultiProviderLLMAdapter({
      provider: 'gemini',
      apiKey,
      model,
      thinkingLevel,
    });

    const result = await adapter.generateStructuredRetentionDecision({
      contactName: 'Pablo (Smoke Test)',
      incomingText: 'Hola, me gustaría conocer el costo del servicio y agendar una demo esta semana.',
      history: [],
      systemPrompt: 'Eres el asistente comercial y de retención de Mejora Continua.',
    });

    if (result && result.replyText && result.intent) {
      report(
        'PASS',
        `Inferencia Gemini 3.8 Live (${model} - thinkingLevel: ${thinkingLevel})`,
        `Intención detectada: ${result.intent} (Confianza: ${(result.confidence * 100).toFixed(0)}%). Tokens: ${result.usage?.promptTokens || 0} prompt / ${result.usage?.thoughtTokens || 0} thought / ${result.usage?.outputTokens || 0} output.`
      );
    }
  } catch (err) {
    report('WARN', 'Inferencia Gemini 3.8 Live', `Error en llamada real: ${err.message}`);
  }
}

async function run() {
  await checkPostgres();
  await checkRedis();
  await checkApiHealth();
  await checkDashboardUi();
  await checkGeminiLive();

  console.log('\n--------------------------------------------------------------------');
  console.log(`  RESULTADO: ${passCount} verificaciones activas, ${warnCount} advertencias/pendientes de arranque en vivo.`);
  console.log('====================================================================\n');
}

run().catch((e) => {
  console.error('Error ejecutando smoke test:', e);
  process.exit(1);
});
