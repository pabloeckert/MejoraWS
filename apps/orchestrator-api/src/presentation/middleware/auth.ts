import { createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import type { IDataStore } from '../../domain/ports.js';

export const AUTH_COOKIE_NAME = 'mejoraws_token';

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function extractCookieValue(
  cookieHeader: string | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function createAuthMiddleware(dataStore: IDataStore) {
  return async function authenticateRequest(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // 1. Verificar x-api-key para integraciones externas
    const rawApiKey = request.headers['x-api-key'];
    if (typeof rawApiKey === 'string' && rawApiKey.trim().length > 0) {
      if (rawApiKey === env.MASTER_API_KEY) {
        return;
      }
      const keyHash = hashApiKey(rawApiKey);
      const valid = await dataStore.validateApiKeyHash(keyHash);
      if (valid) {
        return;
      }
    }

    // 2. Verificar Bearer JWT o Cookie HttpOnly emitida al Dashboard
    const authHeader = request.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    const cookieToken = extractCookieValue(
      request.headers.cookie,
      AUTH_COOKIE_NAME
    );

    const token = bearerToken || cookieToken;
    if (token) {
      try {
        const decoded = await request.server.jwt.verify<{
          user: string;
          role: string;
        }>(token);
        request.user = decoded;
        return;
      } catch {
        // Token inválido o expirado -> cae a 401
      }
    }

    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Se requiere x-api-key válida o sesión JWT autenticada.',
    });
  };
}
