import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  formatToJid,
  normalizePhone,
  type ConnectionStatusResult,
  type Contact,
  type IMessagingProvider,
  type OutboundMessageContent,
  type SendResult,
} from '../index.js';

export interface MetaCloudApiProviderOptions {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
  appSecret?: string;
  instanceName?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface MetaMessagesApiResponse {
  messages?: Array<{ id?: string; message_status?: string }>;
  error?: { message?: string; code?: number };
}

interface MetaPhoneInfoResponse {
  id?: string;
  verified_name?: string;
  display_phone_number?: string;
  quality_rating?: string;
}

/**
 * Verifica firma HMAC-SHA256 de webhooks oficiales de Meta (`X-Hub-Signature-256`).
 */
export function verifyMetaWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!appSecret || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const providedHex = signatureHeader.slice('sha256='.length).trim();
  const expectedHex = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(providedHex, 'utf8');
  const b = Buffer.from(expectedHex, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Adaptador oficial Meta WhatsApp Cloud API v21.0+ / WhatsApp Coexistence (2026-2027).
 * Permite operar el mismo número en WhatsApp Business Mobile App + Cloud API oficial.
 */
export class MetaCloudApiProvider implements IMessagingProvider {
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly instanceName: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MetaCloudApiProviderOptions) {
    this.phoneNumberId = options.phoneNumberId.trim();
    this.accessToken = options.accessToken.trim();
    this.apiVersion = (options.apiVersion || 'v21.0').replace(/^\/+|\/+$/g, '');
    this.instanceName = options.instanceName || 'meta_cloud_v1';
    this.timeoutMs = options.timeoutMs ?? 12000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private get baseEndpoint(): string {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error(
        'MetaCloudApiProvider requiere META_PHONE_NUMBER_ID y META_ACCESS_TOKEN'
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          ...(init.headers || {}),
        },
      });

      const data = (await res.json().catch(() => ({}))) as T & {
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(
          `Meta Cloud API HTTP ${res.status}: ${data?.error?.message || res.statusText}`
        );
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  private toMetaRecipientDigits(jidOrPhone: string): string {
    const canonical = jidOrPhone.includes('@')
      ? jidOrPhone
      : formatToJid(jidOrPhone);
    return normalizePhone(canonical.split('@')[0]);
  }

  async sendMessage(
    jid: string,
    content: OutboundMessageContent & {
      templateName?: string;
      languageCode?: string;
    }
  ): Promise<SendResult> {
    const to = this.toMetaRecipientDigits(jid);
    if (!to) {
      throw new Error(`Destinatario inválido para Meta Cloud API: ${jid}`);
    }

    let payload: Record<string, unknown>;

    if (content.templateName) {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: content.templateName,
          language: { code: content.languageCode || 'es_AR' },
        },
      };
    } else if (content.contentType === 'IMAGE') {
      if (!content.mediaUrl) {
        throw new Error('mediaUrl es obligatorio para IMAGE en Meta Cloud API');
      }
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'image',
        image: {
          link: content.mediaUrl,
          caption: content.text || undefined,
        },
      };
    } else if (
      content.contentType === 'PDF' ||
      content.contentType === 'DOCUMENT'
    ) {
      if (!content.mediaUrl) {
        throw new Error(
          `mediaUrl es obligatorio para ${content.contentType} en Meta Cloud API`
        );
      }
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: {
          link: content.mediaUrl,
          caption: content.text || undefined,
          filename: content.mediaFilename || 'documento.pdf',
        },
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: content.linkPreview ?? true,
          body: content.text || '',
        },
      };
    }

    const response = await this.request<MetaMessagesApiResponse>(
      `${this.baseEndpoint}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    const waId = response.messages?.[0]?.id || `wamid_${Date.now()}`;
    return {
      messageId: waId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  async sendPresenceUpdate(): Promise<void> {
    // Cloud API oficial usa typing_indicator sobre message_id entrante o lo omite sin error
    return undefined;
  }

  async presenceSubscribe(): Promise<void> {
    return undefined;
  }

  async syncContacts(): Promise<Partial<Contact>[]> {
    // Coexistence / Cloud API alimenta contactos de forma reactiva vía webhooks entrantes y smb_message_echoes
    return [];
  }

  async getConnectionStatus(): Promise<ConnectionStatusResult> {
    if (!this.phoneNumberId || !this.accessToken) {
      return {
        state: 'disconnected',
        instanceName: this.instanceName,
      };
    }
    try {
      const info = await this.request<MetaPhoneInfoResponse>(
        `${this.baseEndpoint}?fields=verified_name,display_phone_number,quality_rating`,
        { method: 'GET' }
      );
      return {
        state: 'connected',
        instanceName: this.instanceName,
        phone: info.display_phone_number
          ? normalizePhone(info.display_phone_number)
          : undefined,
      };
    } catch {
      return {
        state: 'disconnected',
        instanceName: this.instanceName,
      };
    }
  }
}
