/**
 * MejoraWS - Enrutador de Usuarios / Identidad
 * Enruta la administración de usuarios e identidades hacia MejoraNucleo.
 */
import { nucleoClient } from '../services/nucleoClient.mjs';

function validateUsuarioInput(payload, isUpdate = false) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('El cuerpo de la petición debe ser un objeto JSON válido');
  }

  if (!isUpdate || payload.nombre !== undefined) {
    if (!payload.nombre || typeof payload.nombre !== 'string' || !payload.nombre.trim()) {
      throw new Error('El campo "nombre" es obligatorio');
    }
  }

  if (!isUpdate || payload.email !== undefined) {
    if (!payload.email || typeof payload.email !== 'string' || !payload.email.includes('@')) {
      throw new Error('El campo "email" es obligatorio y debe ser válido');
    }
  }
}

export async function handleUsuariosRoute(req, res, pathname, parsedUrl, body, sendJson) {
  // Collection Route: /api/usuarios
  if (pathname === '/api/usuarios') {
    if (req.method === 'GET') {
      const result = await nucleoClient.listarUsuarios();
      sendJson(res, 200, result);
      return true;
    }

    if (req.method === 'POST') {
      validateUsuarioInput(body, false);
      const result = await nucleoClient.crearUsuario(body);
      sendJson(res, 201, {
        status: 'success',
        mensaje: 'Usuario creado y enrutado a MejoraNucleo exitosamente',
        usuario: result.data || result
      });
      return true;
    }
  }

  // Member Route: /api/usuarios/:id
  const match = pathname.match(/^\/api\/usuarios\/(\d+)$/);
  if (match) {
    const id = Number(match[1]);

    if (req.method === 'GET') {
      const result = await nucleoClient.obtenerUsuario(id);
      sendJson(res, 200, result);
      return true;
    }

    if (req.method === 'PUT') {
      validateUsuarioInput(body, true);
      const result = await nucleoClient.actualizarUsuario(id, body);
      sendJson(res, 200, {
        status: 'success',
        mensaje: 'Usuario actualizado en MejoraNucleo',
        usuario: result.data || result
      });
      return true;
    }

    if (req.method === 'DELETE') {
      const result = await nucleoClient.eliminarUsuario(id);
      sendJson(res, 200, {
        status: 'success',
        mensaje: `Usuario ${id} eliminado`,
        resultado: result
      });
      return true;
    }
  }

  return false;
}
