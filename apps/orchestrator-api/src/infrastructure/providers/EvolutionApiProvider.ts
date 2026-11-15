import {
  formatToJid,
  normalizePhone,
  type ConnectionStatusResult,
  type Contact,
  type IMessagingProvider,
  type OutboundMessageContent,
  type SendResult,
} from '@mejoraws/shared';

export interface EvolutionApiProviderOptions {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  timeoutMs?: number;
}

interface EvolutionSendResponse {
  key?: { id?: string };
  messageId?: string;
}

interface EvolutionRawContact {
  id?: string;
  remoteJid?: string;
  pushName?: string;
  name?: string;
  verifiedName?: string;
  isBusiness?: boolean;
}

interface EvolutionConnectionStateResponse {
  instance?: { state?: string; owner?: string };
  state?: string;
}

interface EvolutionConnectResponse {
  base64?: string;
  code?: string;
  pairingCode?: string;
}

export class EvolutionApiProvider implements IMessagingProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instanceName: string;
  private readonly timeoutMs: number;

  constructor(options: EvolutionApiProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.instanceName = options.instanceName;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private async request<T>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
          ...(init.headers || {}),
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(
          `Evolution API HTTP ${res.status} en ${endpoint}: ${errorText || res.statusText}`
        );
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async sendMessage(
    jid: string,
    content: OutboundMessageContent
  ): Promise<SendResult> {
    const canonicalJid = jid.includes('@') ? jid : formatToJid(jid);
    const isMedia =
      content.contentType === 'IMAGE' ||
      content.contentType === 'PDF' ||
      content.contentType === 'DOCUMENT';

    let response: EvolutionSendResponse;

    if (isMedia) {
      if (!content.mediaUrl) {
        throw new Error(
          `mediaUrl es obligatorio para contentType ${content.contentType}`
        );
      }
      response = await this.request<EvolutionSendResponse>(
        `/message/sendMedia/${this.instanceName}`,
        {
          method: 'POST',
          body: JSON.stringify({
            number: canonicalJid,
            mediatype: content.contentType === 'IMAGE' ? 'image' : 'document',
            media: content.mediaUrl,
            caption: content.text || '',
            fileName: content.mediaFilename || 'adjunto.pdf',
          }),
        }
      );
    } else {
      response = await this.request<EvolutionSendResponse>(
        `/message/sendText/${this.instanceName}`,
        {
          method: 'POST',
          body: JSON.stringify({
            number: canonicalJid,
            text: content.text || '',
            linkPreview: content.linkPreview ?? true,
          }),
        }
      );
    }

    return {
      messageId:
        response.key?.id || response.messageId || `evo_${Date.now()}`,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  async sendPresenceUpdate(
    jid: string,
    type: 'composing' | 'paused' | 'available' | 'unavailable'
  ): Promise<void> {
    const canonicalJid = jid.includes('@') ? jid : formatToJid(jid);
    await this.request<unknown>(
      `/chat/sendPresence/${this.instanceName}`,
      {
        method: 'POST',
        body: JSON.stringify({
          number: canonicalJid,
          presence: type,
          delay: 1500,
        }),
      }
    ).catch(() => undefined);
  }

  async presenceSubscribe(jid: string): Promise<void> {
    const canonicalJid = jid.includes('@') ? jid : formatToJid(jid);
    await this.request<unknown>(
      `/chat/presenceSubscribe/${this.instanceName}`,
      {
        method: 'POST',
        body: JSON.stringify({ number: canonicalJid }),
      }
    ).catch(() => undefined);
  }

  async syncContacts(): Promise<Partial<Contact>[]> {
    const rawContacts = await this.request<EvolutionRawContact[]>(
      `/chat/findContacts/${this.instanceName}`,
      {
        method: 'POST',
        body: JSON.stringify({ where: {} }),
      }
    );

    if (!Array.isArray(rawContacts)) return [];

    const mapped: Partial<Contact>[] = [];
    const broadcastLists = new Set<string>();

    for (const item of rawContacts) {
      const rawJid = item.remoteJid || item.id || '';
      if (rawJid.endsWith('@broadcast')) {
        broadcastLists.add(rawJid);
        continue;
      }
      if (!rawJid.endsWith('@s.whatsapp.net')) continue;

      const phone = normalizePhone(rawJid.split('@')[0]);
      if (!phone) continue;

      mapped.push({
        instance_id: this.instanceName,
        jid: rawJid,
        phone_number: phone,
        push_name: item.pushName || null,
        address_book_name: item.name || item.verifiedName || null,
        is_in_broadcast: broadcastLists.size > 0,
        broadcast_lists: Array.from(broadcastLists),
        metadata: {
          isBusiness: Boolean(item.isBusiness),
          syncedAt: new Date().toISOString(),
        },
      });
    }

    return mapped;
  }

  async getConnectionStatus(): Promise<ConnectionStatusResult> {
    try {
      const stateRes = await this.request<EvolutionConnectionStateResponse>(
        `/instance/connectionState/${this.instanceName}`,
        { method: 'GET' }
      );
      const rawState = stateRes.instance?.state || stateRes.state;

      if (rawState === 'open') {
        return {
          state: 'connected',
          instanceName: this.instanceName,
          phone: stateRes.instance?.owner,
        };
      }

      const connectRes = await this.request<EvolutionConnectResponse>(
        `/instance/connect/${this.instanceName}`,
        { method: 'GET' }
      ).catch(() => null);

      return {
        state: rawState === 'connecting' ? 'connecting' : 'disconnected',
        qrCode: connectRes?.base64 || connectRes?.code,
        instanceName: this.instanceName,
      };
    } catch {
      return {
        state: 'disconnected',
        instanceName: this.instanceName,
      };
    }
  }
}
