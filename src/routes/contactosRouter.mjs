/**
 * MejoraWS - Enrutador de Contactos
 * Expone endpoints REST para crear, consultar, actualizar y borrar contactos
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
      const limit = parsedUrl.searchParams.get('limit');
      const offset = parsedUrl.searchParams.get('offset');
      const buscar = parsedUrl.searchParams.get('buscar');
      const result = await nucleoClient.listarContactos({ limit, offset, buscar });
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

  // Member Route: /api/contactos/:id
  const match = pathname.match(/^\/api\/contactos\/(\d+)$/);
  if (match) {
    const id = Number(match[1]);

    if (req.method === 'GET') {
      const result = await nucleoClient.obtenerContacto(id);
      sendJson(res, 200, result);
      return true;
    }

    if (req.method === 'PUT') {
      validateContactoInput(body, true);
      const result = await nucleoClient.actualizarContacto(id, body);
      sendJson(res, 200, {
        status: 'success',
        mensaje: 'Contacto actualizado en MejoraNucleo',
        contacto: result.data || result
      });
      return true;
    }

    if (req.method === 'DELETE') {
      const result = await nucleoClient.eliminarContacto(id);
      sendJson(res, 200, {
        status: 'success',
        mensaje: `Contacto ${id} eliminado`,
        resultado: result
      });
      return true;
    }
  }

  return false;
}
