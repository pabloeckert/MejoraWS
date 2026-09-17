/**
 * Servicio cliente para interactuar con la API central de contactos (MejoraContactos)
 * Endpoint: https://tzatuvxatsduuslxqdtm.supabase.co/functions/v1/contactos-api
 */

export const CONTACTOS_API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONTACTOS_API_URL) ||
  (typeof process !== 'undefined' && process.env?.CONTACTOS_API_URL) ||
  'https://tzatuvxatsduuslxqdtm.supabase.co/functions/v1/contactos-api';

export const CONTACTOS_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONTACTOS_API_KEY) ||
  (typeof process !== 'undefined' && process.env?.CONTACTOS_API_KEY) ||
  '66005e1e7b99040265523d6be7cbbe75468da7fbe58fa6c60aed74b917dee46f';

export interface Contacto {
  persona_id: string;
  nombre: string;
  apellido?: string;
  cargo?: string;
  organizacion?: string;
  whatsapp?: string[];
  telefono_fijo?: string[];
  emails?: string[];
  tag?: string;
  domicilio?: string;
  ciudad?: string;
  provincia?: string;
  pais?: string;
  cumpleanos?: string;
  foto_url?: string;
  nota_referencia?: string;
  flags?: string[];
  updated_at?: string;
  sincronizado_en?: string;
}

export interface ObtenerContactosResponse {
  total: number;
  pagina: number;
  tamano: number;
  contactos: Contacto[];
}

export interface InteraccionPayload {
  persona_id?: string;
  numero?: string;
  telefono?: string;
  whatsapp?: string | string[];
  nombre?: string;
  estado_respuesta?: string;
  estado?: string;
  mensaje?: string;
  nota_referencia?: string;
  tag?: string;
  [key: string]: unknown;
}

export interface ReportarInteraccionResponse {
  persona_id: string;
  creado: boolean;
}

declare global {
  interface Window {
    mejora?: {
      obtenerContactos?: (tag?: string) => Promise<ObtenerContactosResponse>;
      reportarInteraccion?: (payload: InteraccionPayload) => Promise<ReportarInteraccionResponse>;
      [key: string]: unknown;
    };
  }
}

/**
 * Obtiene contactos de la fuente de verdad (contactos_finales)
 * @param tag Filtro opcional por tag
 */
export async function obtenerContactos(tag?: string): Promise<ObtenerContactosResponse> {
  // Si corre dentro del contexto de Electron con preload
  if (typeof window !== 'undefined' && typeof window.mejora?.obtenerContactos === 'function') {
    try {
      return await window.mejora.obtenerContactos(tag);
    } catch {
      // Si falla IPC, intentar fetch directo
    }
  }

  const url = new URL(CONTACTOS_API_URL);
  url.searchParams.set('tamano', '2000');
  if (tag) {
    url.searchParams.set('tag', tag);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': CONTACTOS_API_KEY,
    'Authorization': `Bearer ${CONTACTOS_API_KEY}`,
  };

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error obteniendo contactos (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as ObtenerContactosResponse;

  // Filtrado defensivo en cliente por tag si es necesario
  if (tag && Array.isArray(data.contactos)) {
    const tagLower = tag.toLowerCase();
    data.contactos = data.contactos.filter(
      (c) =>
        c.tag?.toLowerCase() === tagLower ||
        c.flags?.some((f) => f.toLowerCase() === tagLower)
    );
  }

  return data;
}

/**
 * Envía el reporte de actividad o interacción de un contacto a la API central
 * @param payload Datos de la interacción (número, estado, notas, persona_id)
 */
export async function reportarInteraccion(
  payload: InteraccionPayload
): Promise<ReportarInteraccionResponse> {
  // Si corre dentro del contexto de Electron con preload
  if (typeof window !== 'undefined' && typeof window.mejora?.reportarInteraccion === 'function') {
    try {
      return await window.mejora.reportarInteraccion(payload);
    } catch {
      // Si falla IPC, intentar fetch directo
    }
  }

  const tel =
    payload.numero ||
    payload.telefono ||
    (Array.isArray(payload.whatsapp) ? payload.whatsapp[0] : payload.whatsapp);
  const estado = payload.estado_respuesta || payload.estado || 'registrado';
  const detalleMensaje = payload.mensaje ? ` - ${payload.mensaje}` : '';
  const nota =
    payload.nota_referencia || `[MejoraWS] Interacción: ${estado}${detalleMensaje}`;

  const body: Record<string, unknown> = {
    nota_referencia: nota,
  };

  if (payload.persona_id) {
    body.persona_id = payload.persona_id;
  }
  if (payload.nombre) {
    body.nombre = payload.nombre;
  }
  if (tel) {
    body.telefono = tel;
  }
  if (payload.tag) {
    body.tag = payload.tag;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': CONTACTOS_API_KEY,
    'Authorization': `Bearer ${CONTACTOS_API_KEY}`,
  };

  const res = await fetch(CONTACTOS_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error reportando interacción (${res.status}): ${errorText}`);
  }

  return (await res.json()) as ReportarInteraccionResponse;
}
