/**
 * MejoraWS - Enrutador de Contactos
 * Expone endpoints REST para crear, consultar, actualizar y transicionar prospectos,
 * validando los datos antes de delegar la persistencia en MejoraNucleo.
 */
import { nucleoClient } from '../services/nucleoClient.mjs';

/**
 * Valida la entrada cruda para creación o actualización de contacto.
 * @param {object} payload
 * @param {boolean} isUpdate
 */
function validateContactoInput(payload, isUpdate = false) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('El cuerpo de la petición debe ser un objeto JSON válido');
  }

  if (!isUpdate || payload.nombre !== undefined) {
    if (!payload.nombre || typeof payload.nombre !== 'string' || !payload.nombre.trim()) {
      throw new Error('El campo "nombre" es obligatorio');
    }
  }

  if (!isUpdate || payload.telefono !== undefined) {
    if (!payload.telefono || typeof payload.telefono !== 'string' || !payload.telefono.trim()) {
      throw new Error('El campo "telefono" es obligatorio');
    }
  }
}

export async function handleContactosRoute(req, res, pathname, parsedUrl, body, sendJson) {
  // Collection Route: /api/contactos
  if (pathname === '/api/contactos') {
    if (req.method === 'GET') {
      const limit = parsedUrl.searchParams.get('limit') || parsedUrl.searchParams.get('limite');
      const offset = parsedUrl.searchParams.get('offset');
      const buscar = parsedUrl.searchParams.get('buscar') || parsedUrl.searchParams.get('busqueda');
      const estado = parsedUrl.searchParams.get('estado');
      const result = await nucleoClient.listarContactos({ limit, offset, buscar, estado });
      sendJson(res, 200, result);
      return true;
    }

    if (req.method === 'POST') {
      validateContactoInput(body, false);
      const result = await nucleoClient.crearContacto(body);
      sendJson(res, 201, {
        status: 'success',
        mensaje: 'Contacto creado y enrutado a MejoraNucleo exitosamente',
        contacto: result.data || result
      });
      return true;
    }
  }

  // Action Subroutes: /api/contactos/:id/(seguimiento|calificar|cerrar|eventos)
  const matchAction = pathname.match(/^\/api\/contactos\/([^/]+)\/(seguimiento|calificar|cerrar|eventos)$/);
  if (matchAction) {
    const id = decodeURIComponent(matchAction[1]);
    const action = matchAction[2];

    if (action === 'seguimiento') {
      const result = await nucleoClient.iniciarSeguimiento(id);
      sendJson(res, 200, { status: 'success', accion: 'seguimiento', prospecto: result });
      return true;
    }
    if (action === 'calificar') {
      const result = await nucleoClient.calificarProspecto(id);
      sendJson(res, 200, { status: 'success', accion: 'calificar', prospecto: result });
      return true;
    }
    if (action === 'cerrar') {
      const result = await nucleoClient.cerrarProspecto(id, Boolean(body.ganado));
      sendJson(res, 200, { status: 'success', accion: 'cerrar', prospecto: result });
      return true;
    }
    if (action === 'eventos') {
      const result = await nucleoClient.listarEventos(id);
      sendJson(res, 200, { status: 'success', eventos: result });
      return true;
    }
  }

  // Member Route: /api/contactos/:id (acepta UUID, ID numérico o teléfono)
  const matchMember = pathname.match(/^\/api\/contactos\/([^/]+)$/);
  if (matchMember) {
    const id = decodeURIComponent(matchMember[1]);

    if (req.method === 'GET') {
      const result = await nucleoClient.obtenerContacto(id);
      sendJson(res, 200, result);
      return true;
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      // Soporte para transiciones de semáforo comercial y SLA 48h
      if (body.accion === 'calificar' || body.estado === 'calificado') {
        const result = await nucleoClient.calificarProspecto(id);
        sendJson(res, 200, { status: 'success', accion: 'calificar', prospecto: result });
        return true;
      }
      if (body.accion === 'seguimiento' || body.estado === 'seguimiento' || body.estado === 'respondido') {
        const result = await nucleoClient.iniciarSeguimiento(id);
        sendJson(res, 200, { status: 'success', accion: 'seguimiento', prospecto: result });
        return true;
      }
      if (body.accion === 'cerrar') {
        const result = await nucleoClient.cerrarProspecto(id, Boolean(body.ganado));
        sendJson(res, 200, { status: 'success', accion: 'cerrar', prospecto: result });
        return true;
      }

      sendJson(res, 200, {
        status: 'success',
        mensaje: 'Contacto procesado en MejoraWS',
        id
      });
      return true;
    }
  }

  return false;
}
