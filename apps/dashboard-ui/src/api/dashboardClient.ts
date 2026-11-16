import {
  clampDateToSafeHours,
  formatToJid,
  isWithinSafeHours,
  type AIConfig,
  type AIMode,
  type ApiKey,
  type ConnectionStatusResult,
  type Contact,
  type ContentType,
  type JobStatus,
  type Message,
  type ScheduledJob,
} from '@mejoraws/shared';

export interface SystemHealthResponse {
  ok: boolean;
  instanceName: string;
  whatsapp: ConnectionStatusResult;
  queuePaused: boolean;
  metrics: {
    sentToday: number;
    receivedToday: number;
    pendingJobs: number;
    failedToday: number;
  };
  enforceWhitelist: boolean;
}

export interface SenderBadgeInfo {
  label: string;
  badgeClass: string;
  bubbleClass: string;
  align: 'left' | 'right';
}

export function getSenderBadge(msg: Pick<Message, 'direction' | 'sender_type' | 'is_broadcast' | 'body'>): SenderBadgeInfo {
  if (msg.direction === 'INBOUND' || msg.sender_type === 'CONTACT') {
    return {
      label: msg.is_broadcast ? '[Contacto · Difusión]' : '[Contacto]',
      badgeClass: 'bg-slate-700 text-slate-200 border-slate-600',
      bubbleClass: 'bg-slate-800/90 border-slate-700 text-slate-100',
      align: 'left',
    };
  }

  if (msg.sender_type === 'AI_AGENT') {
    return {
      label: '[IA · Retención]',
      badgeClass: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
      bubbleClass: 'bg-violet-950/60 border-violet-700/50 text-violet-50',
      align: 'right',
    };
  }

  if (msg.sender_type === 'HUMAN_OWNER') {
    const isFromPhone = msg.body?.includes('[Mensaje desde celular físico]');
    return {
      label: isFromPhone ? '[Tú - Celular]' : '[Tú - Web / Celular]',
      badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
      bubbleClass: 'bg-emerald-950/60 border-emerald-700/50 text-emerald-50',
      align: 'right',
    };
  }

  return {
    label: '[Sistema · Smart Drip]',
    badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
    bubbleClass: 'bg-sky-950/60 border-sky-700/50 text-sky-50',
    align: 'right',
  };
}

export interface AIModeBadgeInfo {
  code: AIMode;
  label: string;
  description: string;
  badgeClass: string;
}

export function getAIModeBadge(mode: AIMode): AIModeBadgeInfo {
  if (mode === 'AI_RETENTION') {
    return {
      code: 'AI_RETENTION',
      label: 'IA Retención Activa',
      description: 'El copiloto IA responde, califica y alerta ante intención comercial.',
      badgeClass: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
    };
  }
  if (mode === 'HUMAN_TAKEOVER') {
    return {
      code: 'HUMAN_TAKEOVER',
      label: 'Control Humano (IA Silenciada)',
      description: 'Intervención del dueño activa; la IA no responde encima tuyo.',
      badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    };
  }
  return {
    code: 'MUTED',
    label: 'Silenciado / Baja',
    description: 'IA desactivada permanentemente o baja solicitada por el contacto.',
    badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
  };
}

export interface SmartDripEstimate {
  recipientCount: number;
  batchPausesCount: number;
  minTotalSeconds: number;
  maxTotalSeconds: number;
  outsideSafeHours: boolean;
  effectiveFirstSendAt: Date;
}

export function estimateSmartDripWindow(
  recipientCount: number,
  scheduledForIso: string,
  urgent = false,
  safeHoursStart = '08:30',
  safeHoursEnd = '20:30'
): SmartDripEstimate {
  const count = Math.max(1, Number(recipientCount) || 1);
  const parsedDate = scheduledForIso ? new Date(scheduledForIso) : new Date();
  const baseDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const outsideSafeHours =
    !urgent && !isWithinSafeHours(baseDate, safeHoursStart, safeHoursEnd);
  const effectiveFirstSendAt = outsideSafeHours
    ? clampDateToSafeHours(baseDate, safeHoursStart, safeHoursEnd)
    : baseDate;

  const transitions = Math.max(0, count - 1);
  const batchPausesCount = Math.floor(transitions / 15);
  const normalTransitions = transitions - batchPausesCount;

  const minTotalSeconds = normalTransitions * 4 + batchPausesCount * 45;
  const maxTotalSeconds = normalTransitions * 12 + batchPausesCount * 90;

  return {
    recipientCount: count,
    batchPausesCount,
    minTotalSeconds,
    maxTotalSeconds,
    outsideSafeHours,
    effectiveFirstSendAt,
  };
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function contactsToCsv(contacts: Contact[]): string {
  const headers = [
    'ID',
    'Telefono',
    'JID',
    'NombreAgenda',
    'NombreWhatsApp',
    'ModoIA',
    'Whitelist',
    'EnDifusion',
    'ListasDifusion',
  ];

  const rows = contacts.map((c) =>
    [
      c.id,
      c.phone_number,
      c.jid || formatToJid(c.phone_number),
      c.address_book_name || '',
      c.push_name || '',
      c.ai_mode,
      c.is_whitelisted ? 'SI' : 'NO',
      c.is_in_broadcast ? 'SI' : 'NO',
      (c.broadcast_lists || []).join(';'),
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export interface DashboardApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class DashboardApiClient {
  private readonly baseUrl: string;
  private apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DashboardApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl || '').replace(/\/+$/, '');
    this.apiKey = options.apiKey || '';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim();
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (data as { message?: string; error?: string })?.message ||
        (data as { error?: string })?.error ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data as T;
  }

  async login(
    username: string,
    password: string
  ): Promise<{ ok: boolean; user: string; token: string }> {
    return this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async logout(): Promise<{ ok: boolean }> {
    return this.request('/api/v1/auth/logout', { method: 'POST' });
  }

  async getHealth(): Promise<SystemHealthResponse> {
    return this.request('/api/v1/system/health', { method: 'GET' });
  }

  async toggleQueue(
    paused?: boolean
  ): Promise<{ ok: boolean; paused: boolean }> {
    return this.request('/api/v1/queue/toggle', {
      method: 'POST',
      body: JSON.stringify(paused !== undefined ? { paused } : {}),
    });
  }

  async listContacts(filters?: {
    isInBroadcast?: boolean;
    aiMode?: AIMode;
    search?: string;
  }): Promise<{ contacts: Contact[] }> {
    const params = new URLSearchParams();
    if (filters?.isInBroadcast !== undefined) {
      params.set('isInBroadcast', String(filters.isInBroadcast));
    }
    if (filters?.aiMode) {
      params.set('aiMode', filters.aiMode);
    }
    if (filters?.search?.trim()) {
      params.set('search', filters.search.trim());
    }
    const qs = params.toString();
    return this.request(`/api/v1/contacts${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  }

  async createContact(input: {
    phone: string;
    name?: string;
    is_whitelisted?: boolean;
  }): Promise<{ ok: boolean; contact: Contact }> {
    return this.request('/api/v1/contacts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async setContactWhitelist(
    contactId: string,
    is_whitelisted: boolean
  ): Promise<{ ok: boolean; contact: Contact }> {
    return this.request(`/api/v1/contacts/${contactId}/whitelist`, {
      method: 'PATCH',
      body: JSON.stringify({ is_whitelisted }),
    });
  }

  async syncContacts(): Promise<{
    ok: boolean;
    synced: number;
    contacts: Contact[];
  }> {
    return this.request('/api/v1/contacts/sync', { method: 'POST' });
  }

  async getConversationMessages(
    contactId: string
  ): Promise<{ contact: Contact; messages: Message[] }> {
    return this.request(`/api/v1/conversations/${contactId}/messages`, {
      method: 'GET',
    });
  }

  async sendManualReply(
    contactId: string,
    payload: {
      text?: string;
      mediaUrl?: string;
      mediaFilename?: string;
      contentType?: ContentType;
    }
  ): Promise<{ ok: boolean; message: Message }> {
    return this.request(`/api/v1/conversations/${contactId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async setConversationMode(
    contactId: string,
    mode: AIMode,
    muteHours?: number
  ): Promise<{ ok: boolean; contact: Contact }> {
    return this.request(`/api/v1/conversations/${contactId}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode, muteHours }),
    });
  }

  async sendMessageNow(payload: {
    contactId?: string;
    phone?: string;
    text?: string;
    mediaUrl?: string;
    mediaFilename?: string;
    contentType?: ContentType;
    idempotency_key?: string;
    urgent?: boolean;
  }): Promise<{
    ok: boolean;
    duplicated: boolean;
    job: ScheduledJob;
    messageId?: string;
  }> {
    return this.request('/api/v1/messages/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async scheduleMessages(payload: {
    phones?: string[];
    contactIds?: string[];
    phone?: string;
    text?: string;
    mediaUrl?: string;
    mediaFilename?: string;
    contentType?: ContentType;
    scheduledFor: string;
    idempotency_key?: string;
    urgent?: boolean;
  }): Promise<{
    ok: boolean;
    duplicated: boolean;
    count: number;
    jobs: ScheduledJob[];
  }> {
    return this.request('/api/v1/messages/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listScheduledJobs(
    status?: JobStatus
  ): Promise<{ jobs: ScheduledJob[] }> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request(`/api/v1/messages/scheduled${qs}`, { method: 'GET' });
  }

  async cancelScheduledJob(
    jobId: string
  ): Promise<{ ok: boolean; job: ScheduledJob }> {
    return this.request(`/api/v1/messages/scheduled/${jobId}`, {
      method: 'DELETE',
    });
  }

  async getAIConfig(): Promise<{ config: AIConfig }> {
    return this.request('/api/v1/ai/config', { method: 'GET' });
  }

  async updateAIConfig(
    patch: Partial<AIConfig>
  ): Promise<{ ok: boolean; config: AIConfig }> {
    return this.request('/api/v1/ai/config', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  }

  async listApiKeys(): Promise<{ keys: ApiKey[] }> {
    return this.request('/api/v1/keys', { method: 'GET' });
  }

  async createApiKey(
    label: string
  ): Promise<{ ok: boolean; apiKey: string; record: ApiKey }> {
    return this.request('/api/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ label }),
    });
  }

  async uploadMedia(file: File): Promise<{
    ok: boolean;
    url: string;
    filename: string;
    contentType: ContentType;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${this.baseUrl}/api/v1/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `Error subiendo archivo: ${res.statusText}`);
    }
    return res.json();
  }

  createEventSource(onEvent: (event: unknown) => void): () => void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return () => {};
    }
    const url = `${this.baseUrl}/api/v1/events`;
    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch {
        // ignore
      }
    };

    const eventTypes = [
      'qr.updated',
      'connection.updated',
      'message.created',
      'message.received',
      'message.status',
      'contact.mode_updated',
      'ai.alert',
      'queue.toggled',
    ];

    for (const evt of eventTypes) {
      es.addEventListener(evt, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          onEvent(parsed);
        } catch {
          // ignore
        }
      });
    }

    return () => {
      es.close();
    };
  }
}
