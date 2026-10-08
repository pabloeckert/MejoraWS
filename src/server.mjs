/**
 * MejoraWS - Servidor Enrutador y Gateway Central de Web Services
 * Orquesta peticiones HTTP desde las apps periféricas y enruta persistencia a MejoraNucleo.
 */
import http from 'node:http';
import { nucleoClient } from './services/nucleoClient.mjs';
import { handleContactosRoute } from './routes/contactosRouter.mjs';
import { handleUsuariosRoute } from './routes/usuariosRouter.mjs';

const PORT = Number(process.env.WS_PORT || process.env.PORT) || 4180;
const HOST = process.env.WS_HOST || '127.0.0.1';

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload demasiado grande (>1MB)'));
      }
    });
    req.on('end', () => {
      if (!body) {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error(`JSON inválido: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

export const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = parsedUrl.pathname;

  try {
    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      body = await parseBody(req);
    }

    // Health Check del Router y enlace con MejoraNucleo
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
      let nucleoHealth = null;
      let nucleoError = null;

      try {
        nucleoHealth = await nucleoClient.checkHealth();
      } catch (err) {
        nucleoError = err.message;
      }

      const statusCode = nucleoHealth ? 200 : 503;
      sendJson(res, statusCode, {
        status: nucleoHealth ? 'healthy' : 'degraded',
        service: 'MejoraWS (Router Central)',
        timestamp: new Date().toISOString(),
        nucleoConnected: Boolean(nucleoHealth),
        nucleoDetails: nucleoHealth || { error: nucleoError }
      });
      return;
    }

    // Enrutador de Contactos
    const handledContactos = await handleContactosRoute(req, res, pathname, parsedUrl, body, sendJson);
    if (handledContactos) {
      return;
    }

    // Enrutador de Usuarios
    const handledUsuarios = await handleUsuariosRoute(req, res, pathname, parsedUrl, body, sendJson);
    if (handledUsuarios) {
      return;
    }

    // Ruta no encontrada
    sendJson(res, 404, {
      error: `Ruta no encontrada en MejoraWS: ${req.method} ${pathname}`
    });
  } catch (err) {
    const status = err.status || 400;
    sendJson(res, status, {
      error: err.message || 'Error procesando solicitud en MejoraWS',
      details: err.details || null
    });
  }
});

if (process.argv[1] && process.argv[1].endsWith('server.mjs')) {
  server.listen(PORT, HOST, () => {
    console.log(`[MejoraWS] Enrutador y Gateway activo en http://${HOST}:${PORT}`);
    console.log(`[MejoraWS] Enlazado a MejoraNucleo en ${nucleoClient.baseUrl}`);
  });

  const shutdown = () => {
    console.log('\n[MejoraWS] Deteniendo servidor enrutador...');
    server.close(() => {
      console.log('[MejoraWS] Servidor cerrado limpiamente.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
