/**
 * MejoraWS - Cliente de Conexión a MejoraNucleo
 * Orquesta la comunicación con el motor central de persistencia (HTTP / Direct DB Fallback).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_NUCLEO_URL = process.env.NUCLEO_URL || 'http://127.0.0.1:5001';
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
        const connError = new Error(`MejoraNucleo inalcanzable en ${this.baseUrl}. ¿Está el servidor iniciado en el puerto 5001?`);
        connError.status = 503;
        throw connError;
      }
      throw err;
    }
  }

  /**
   * Consulta el estado de salud de MejoraNucleo.
   */
  async checkHealth() {
    return this._request('/health', { method: 'GET' });
  }

  // ========================================================
  // Contactos (CRUD)
  // ========================================================

  async crearContacto(contactoData) {
    return this._request('/api/nucleo/contactos', {
      method: 'POST',
      body: JSON.stringify(contactoData)
    });
  }

  async listarContactos(query = {}) {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    if (query.buscar) params.set('buscar', String(query.buscar));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this._request(`/api/nucleo/contactos${qs}`, { method: 'GET' });
  }

  async obtenerContacto(id) {
    return this._request(`/api/nucleo/contactos/${Number(id)}`, { method: 'GET' });
  }

  async actualizarContacto(id, contactoData) {
    return this._request(`/api/nucleo/contactos/${Number(id)}`, {
      method: 'PUT',
      body: JSON.stringify(contactoData)
    });
  }

  async eliminarContacto(id) {
    return this._request(`/api/nucleo/contactos/${Number(id)}`, { method: 'DELETE' });
  }

  // ========================================================
  // Usuarios / Identidad (CRUD)
  // ========================================================

  async crearUsuario(usuarioData) {
    return this._request('/api/nucleo/usuarios', {
      method: 'POST',
      body: JSON.stringify(usuarioData)
    });
  }

  async listarUsuarios() {
    return this._request('/api/nucleo/usuarios', { method: 'GET' });
  }

  async obtenerUsuario(id) {
    return this._request(`/api/nucleo/usuarios/${Number(id)}`, { method: 'GET' });
  }

  async actualizarUsuario(id, usuarioData) {
    return this._request(`/api/nucleo/usuarios/${Number(id)}`, {
      method: 'PUT',
      body: JSON.stringify(usuarioData)
    });
  }

  async eliminarUsuario(id) {
    return this._request(`/api/nucleo/usuarios/${Number(id)}`, { method: 'DELETE' });
  }
}

export const nucleoClient = new NucleoClient();
