/**
 * Mejora Suite - Script de Validación de Integración End-to-End
 * MejoraWS (Router / Web Service) <---> MejoraNucleo (Base de Datos Central)
 *
 * Ejecuta la verificación empírica de:
 * 1. Conexión y salud de ambos servicios locales.
 * 2. Creación de un Contacto mediante POST a MejoraWS.
 * 3. Enrutamiento y persistencia en MejoraNucleo.
 * 4. Verificación de lectura vía API de MejoraWS.
 * 5. Verificación física directa en la base de datos SQLite de MejoraNucleo.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NUCLEO_PORT = 5001;
const WS_PORT = 4180;
const NUCLEO_URL = `http://127.0.0.1:${NUCLEO_PORT}`;
const WS_URL = `http://127.0.0.1:${WS_PORT}`;

const NUCLEO_SERVER_PATH = path.resolve(__dirname, '..', '..', 'MejoraNucleo', 'src', 'server.mjs');
const WS_SERVER_PATH = path.resolve(__dirname, '..', 'src', 'server.mjs');
const DB_FILE_PATH = path.resolve(__dirname, '..', '..', 'MejoraNucleo', 'data', 'nucleo.db');

async function isPortOpen(url) {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(url)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function runTest() {
  console.log('================================================================');
  console.log('   MEJORA SUITE - VALIDACIÓN EMPÍRICA BACKEND (WS <-> NÚCLEO)   ');
  console.log('================================================================\n');

  let nucleoProc = null;
  let wsProc = null;

  try {
    // 1. Verificar si MejoraNucleo ya está corriendo; si no, levantarlo
    const nucleoAlreadyUp = await isPortOpen(NUCLEO_URL);
    if (!nucleoAlreadyUp) {
      console.log(`[1/5] Levantando MejoraNucleo en segundo plano (puerto ${NUCLEO_PORT})...`);
      nucleoProc = spawn(process.execPath, [NUCLEO_SERVER_PATH], {
        env: { ...process.env, NUCLEO_PORT: String(NUCLEO_PORT) },
        stdio: 'inherit'
      });
      const ok = await waitForServer(NUCLEO_URL);
      if (!ok) throw new Error('MejoraNucleo no respondió en el tiempo límite');
      console.log('      -> MejoraNucleo ONLINE y escuchando.');
    } else {
      console.log(`[1/5] MejoraNucleo ya se encuentra activo en ${NUCLEO_URL}.`);
    }

    // 2. Verificar si MejoraWS ya está corriendo; si no, levantarlo
    const wsAlreadyUp = await isPortOpen(WS_URL);
    if (!wsAlreadyUp) {
      console.log(`[2/5] Levantando MejoraWS Router en segundo plano (puerto ${WS_PORT})...`);
      wsProc = spawn(process.execPath, [WS_SERVER_PATH], {
        env: { ...process.env, WS_PORT: String(WS_PORT), NUCLEO_URL },
        stdio: 'inherit'
      });
      const ok = await waitForServer(WS_URL);
      if (!ok) throw new Error('MejoraWS no respondió en el tiempo límite');
      console.log('      -> MejoraWS Router ONLINE y escuchando.');
    } else {
      console.log(`[2/5] MejoraWS ya se encuentra activo en ${WS_URL}.`);
    }

    // 3. Health check de MejoraWS y enlace con MejoraNucleo
    console.log('\n[3/5] Comprobando salud y conectividad de MejoraWS -> MejoraNucleo...');
    const wsHealthRes = await fetch(`${WS_URL}/health`);
    const wsHealth = await wsHealthRes.json();
    console.log('      Estado del Router:', JSON.stringify(wsHealth, null, 2));
    if (!wsHealth.nucleoConnected) {
      throw new Error('MejoraWS reporta que MejoraNucleo no está conectado');
    }

    // 4. Enviar un Contacto de prueba vía POST a MejoraWS
    console.log('\n[4/5] Enviando Contacto de prueba vía POST a MejoraWS (/api/contactos)...');
    const nuevoContactoPayload = {
      nombre: 'Contacto Integracion',
      apellido: 'Empírico',
      telefono: '+5493764889900',
      email: 'integracion.nucleo@mejoracontinua.com',
      empresa: 'Laboratorio Mejora Continua',
      cargo: 'Director de Operaciones',
      origen: 'whatsapp',
      estado: 'nuevo',
      notas: 'Contacto creado vía HTTP POST en MejoraWS y persistido en MejoraNucleo'
    };

    const postRes = await fetch(`${WS_URL}/api/contactos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoContactoPayload)
    });

    if (postRes.status !== 201) {
      const errBody = await postRes.text();
      throw new Error(`Esperado HTTP 201 pero se recibió HTTP ${postRes.status}: ${errBody}`);
    }

    const postResult = await postRes.json();
    console.log('      [+] HTTP 201 Created recibido de MejoraWS:');
    console.log(JSON.stringify(postResult, null, 2));

    const contactoId = postResult.contacto.id;
    const contactoUuid = postResult.contacto.uuid;

    // 5. Verificación cruzada: Leer desde MejoraWS y verificar directamente en la base SQLite de MejoraNucleo
    console.log(`\n[5/5] Verificación cruzada de persistencia para ID ${contactoId} (UUID: ${contactoUuid})...`);

    // 5.a Lectura a través de MejoraWS (Router)
    const getWsRes = await fetch(`${WS_URL}/api/contactos/${contactoId}`);
    const getWsData = await getWsRes.json();
    console.log('      [~] Lectura vía MejoraWS (GET /api/contactos/:id):');
    console.log('          Nombre:', getWsData.data.nombre, getWsData.data.apellido);
    console.log('          Teléfono:', getWsData.data.telefono);
    console.log('          Empresa:', getWsData.data.empresa);

    // 5.b Lectura directa en el archivo SQLite físico de MejoraNucleo
    console.log(`      [~] Auditoría física directa en archivo SQLite: ${DB_FILE_PATH}`);
    const db = new DatabaseSync(DB_FILE_PATH);
    const row = db.prepare('SELECT * FROM contactos WHERE id = ?').get(contactoId);
    db.close();

    if (!row) {
      throw new Error(`¡Fallo crítico! El contacto con ID ${contactoId} no existe en la base física SQLite.`);
    }

    console.log('      [=] Registro verificado directamente en MejoraNucleo SQLite:');
    console.log(JSON.stringify(row, null, 2));

    // 5.c Actualización (PUT)
    console.log('\n      [+] Probando actualización parcial (PUT /api/contactos/:id)...');
    const putRes = await fetch(`${WS_URL}/api/contactos/${contactoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cargo: 'Director General (Promovido)' })
    });
    const putData = await putRes.json();
    console.log('          Cargo actualizado:', putData.contacto.cargo);

    console.log('\n================================================================');
    console.log('   PRUEBA EMPÍRICA COMPLETADA CON ÉXITO: 100% OPERATIVO         ');
    console.log('   MejoraWS recibe peticiones HTTP y escribe en MejoraNucleo.   ');
    console.log('================================================================\n');
  } finally {
    if (wsProc) {
      console.log('Cerrando proceso temporal de MejoraWS...');
      wsProc.kill();
    }
    if (nucleoProc) {
      console.log('Cerrando proceso temporal de MejoraNucleo...');
      nucleoProc.kill();
    }
  }
}

runTest().catch((err) => {
  console.error('\n[ERROR EN PRUEBA DE INTEGRACIÓN]:', err);
  process.exit(1);
});
