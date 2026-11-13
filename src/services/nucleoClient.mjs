/**
 * MejoraWS - Cliente de Conexión a MejoraNucleo
 * Orquesta la comunicación con el motor central de persistencia (HTTP / Direct DB Fallback).
 * Actualizado según especificación Clean Architecture de MejoraNucleo (puerto 4002, /api/prospectos).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_NUCLEO_URL = process.env.NUCLEO_URL || 'http://127.0.0.1:4002';
const TIMEOUT_MS = Number(process.env.NUCLEO_TIMEOUT_MS) || 4000;

export class NucleoClient {
  constructor(baseUrl = DEFAULT_NUCLEO_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Ejecuta petición HTTP tipada hacia MejoraNucleo.
   * @param {string} endpoint
   * @param {RequestInit} [options]
   * @returns {Promise<any>}
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data && data.error ? data.error : `HTTP ${response.status} de MejoraNucleo`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TimeoutError') {
        const timeoutError = new Error(`Timeout conectando a MejoraNucleo (${TIMEOUT_MS}ms)`);
        timeoutError.status = 504;
        throw timeoutError;
      }
      if (err.cause && err.cause.code === 'ECONNREFUSED') {
        const connError = new Error(`MejoraNucleo inalcanzable en ${this.baseUrl}. ¿Está el servidor iniciado en el puerto 4002?`);
        connError.status = 503;
        throw connError;
      }
      throw err;
    }
  }

  /**
   * Consulta el estado de salud de MejoraNucleo y conectividad a SQLite.
   */
  async checkHealth() {
    // MejoraNucleo Clean Architecture responde con 200 en /api/prospectos?limite=1
    const res = await this._request('/api/prospectos?limite=1', { method: 'GET' });
    return {
      status: 'healthy',
      service: 'MejoraNucleo (Clean Architecture Core)',
      endpoint: '/api/prospectos',
      prospectosDetectados: Array.isArray(res) ? res.length : 0
    };
  }

  // ========================================================
  // Prospectos / Contactos (Mapeo Hacia MejoraNucleo Core)
  // ========================================================

  /**
   * Registra un nuevo contacto / prospecto en MejoraNucleo
   */
  async crearContacto(contactoData) {
    const payload = {
      nombre: String(contactoData.nombre || '').trim(),
      email: String(contactoData.email || '').trim(),
      telefono: String(contactoData.telefono || '').trim(),
      canalOrigen: String(contactoData.canalOrigen || contactoData.origen || 'whatsapp'),
      piezaIdAtribucion: String(contactoData.piezaIdAtribucion || contactoData.pieza_id_atribucion || 'MEJORAWS_DIRECT'),
      utmSource: String(contactoData.utmSource || contactoData.utm_source || 'whatsapp'),
      utmMedium: String(contactoData.utmMedium || contactoData.utm_medium || 'outreach_1a1'),
      utmCampaign: String(contactoData.utmCampaign || contactoData.utm_campaign || 'prospeccion_ws'),
      utmContent: String(contactoData.utmContent || contactoData.utm_content || contactoData.variable || ''),
      buyerPersonaId: String(contactoData.buyerPersonaId || contactoData.buyer_persona_id || 'SATURADO')
    };

    return this._request('/api/prospectos', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Lista prospectos con filtros opcionales.
   */
  async listarContactos(query = {}) {
    const params = new URLSearchParams();
    if (query.limit || query.limite) params.set('limite', String(query.limit || query.limite));
    if (query.offset) params.set('offset', String(query.offset));
    if (query.buscar || query.busqueda) params.set('busqueda', String(query.buscar || query.busqueda));
    if (query.estado) params.set('estado', String(query.estado));

    const qs = params.toString() ? `?${params.toString()}` : '';
    const items = await this._request(`/api/prospectos${qs}`, { method: 'GET' });
    return {
      total: Array.isArray(items) ? items.length : 0,
      data: items
    };
  }

  /**
   * Obtiene un contacto / prospecto por ID o búsqueda.
   */
  async obtenerContacto(id) {
    const res = await this.listarContactos({ limite: 100 });
    const items = res.data || [];
    const item = items.find((p) => p.id === id || p.telefono === id) || null;
    return { data: item };
  }

  // ========================================================
  // Conexión SLA 48h & Transiciones de Estado
  // ========================================================

  /**
   * Inicia el seguimiento comercial (SLA 48h activado en MejoraCRM).
   */
  async iniciarSeguimiento(id) {
    return this._request(`/api/prospectos/${encodeURIComponent(id)}/seguimiento`, {
      method: 'PATCH'
    });
  }

  /**
   * Califica el prospecto para propuesta formal.
   */
  async calificarProspecto(id) {
    return this._request(`/api/prospectos/${encodeURIComponent(id)}/calificar`, {
      method: 'PATCH'
    });
  }

  /**
   * Cierra el prospecto (ganado o perdido).
   */
  async cerrarProspecto(id, ganado) {
    return this._request(`/api/prospectos/${encodeURIComponent(id)}/cerrar`, {
      method: 'PATCH',
      body: JSON.stringify({ ganado: Boolean(ganado) })
    });
  }

  /**
   * Consulta los eventos auditables de un prospecto.
   */
  async listarEventos(id) {
    return this._request(`/api/prospectos/${encodeURIComponent(id)}/eventos`, {
      method: 'GET'
    });
  }
}

export const nucleoClient = new NucleoClient();
