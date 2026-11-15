/**
 * @mejoraws/shared — Modelos de Dominio, Tipos y Lógica Pura Anti-Ban 2026
 * Gobernanza: Kendall & Kendall, Clean Architecture (Robert C. Martin), Bukhari / Twilio
 */

// ==============================================================================
// 1. MODELO DE DATOS DE DOMINIO (PostgreSQL 16)
// ==============================================================================

export type AIMode = 'AI_RETENTION' | 'HUMAN_TAKEOVER' | 'MUTED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type SenderType = 'CONTACT' | 'AI_AGENT' | 'HUMAN_OWNER' | 'SYSTEM_API';
export type ContentType = 'TEXT' | 'IMAGE' | 'PDF' | 'DOCUMENT' | 'URL' | 'BROADCAST_CAPTURE';
export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Contact {
  id: string;
  instance_id?: string;
  jid: string;
  phone_number: string;
  push_name: string | null;
  address_book_name: string | null;
  is_in_broadcast: boolean;
  broadcast_lists: string[];
  ai_mode: AIMode;
  ai_muted_until: Date | null;
  is_whitelisted: boolean;
  metadata: Record<string, unknown>;
  last_interaction_at: Date | null;
  created_at: Date;
}

export interface Message {
  id: string;
  instance_id?: string;
  whatsapp_message_id: string;
  contact_id: string;
  direction: MessageDirection;
  sender_type: SenderType;
  content_type: ContentType;
  body: string;
  media_url: string | null;
  media_filename: string | null;
  is_broadcast: boolean;
  status: MessageStatus;
  created_at: Date;
}

export interface ScheduledJobPayload {
  body: string;
  media_url?: string;
  media_filename?: string;
  content_type?: ContentType;
  urgent?: boolean;
}

export interface ScheduledJob {
  id: string;
  instance_id?: string;
  idempotency_key: string | null;
  contact_id: string;
  payload: ScheduledJobPayload;
  scheduled_for: Date;
  effective_send_at: Date;
  status: JobStatus;
  attempts: number;
  error_log: string | null;
  created_at: Date;
}

export interface AIConfig {
  id: number;
  is_global_enabled: boolean;
  system_prompt: string;
  model_name: string;
  max_auto_turns: number;
  handoff_keywords: string[];
  auto_mute_hours_on_human_reply: number;
  alert_webhook_url: string | null;
}

export interface ApiKey {
  id: string;
  label: string;
  key_hash: string;
  is_active: boolean;
  created_at: Date;
}

// ==============================================================================
// 2. CONTRATOS DE PATRÓN ADAPTADOR (Clean Architecture)
// ==============================================================================

export interface OutboundMessageContent {
  text?: string;
  mediaUrl?: string;
  mediaFilename?: string;
  contentType: ContentType;
  linkPreview?: boolean;
}

export interface SendResult {
  messageId: string;
  status: MessageStatus;
  timestamp: Date;
}

export interface ConnectionStatusResult {
  state: 'connecting' | 'connected' | 'disconnected';
  qrCode?: string;
  instanceName: string;
  phone?: string;
}

export interface IMessagingProvider {
  sendMessage(jid: string, content: OutboundMessageContent): Promise<SendResult>;
  sendPresenceUpdate(jid: string, type: 'composing' | 'paused' | 'available' | 'unavailable'): Promise<void>;
  presenceSubscribe(jid: string): Promise<void>;
  syncContacts(): Promise<Partial<Contact>[]>;
  getConnectionStatus(): Promise<ConnectionStatusResult>;
}

// ==============================================================================
// 3. FÓRMULAS MATEMÁTICAS ANTI-BAN & SIMULACIÓN HUMANA 2026
// ==============================================================================

export function normalizePhone(p: string | null | undefined): string {
  return (p || '').toString().replace(/\D/g, '');
}

export function formatToJid(phone: string): string {
  const norm = normalizePhone(phone);
  if (norm.endsWith('@s.whatsapp.net')) return norm;
  // Prefijo argentino 549 si viene con código de área local (ej. 376... -> 549376...)
  if (norm.length === 10 && !norm.startsWith('54')) {
    return `549${norm}@s.whatsapp.net`;
  }
  // Si viene con 54 pero sin el 9 móvil argentino (ej. 543764358152 -> 12 dígitos)
  if (norm.length === 12 && norm.startsWith('54') && !norm.startsWith('549')) {
    return `549${norm.slice(2)}@s.whatsapp.net`;
  }
  return `${norm}@s.whatsapp.net`;
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const jidA = formatToJid(a);
  const jidB = formatToJid(b);
  return Boolean(jidA && jidB && jidA === jidB);
}

export interface ParsedRecipient {
  telefono: string;
  nombre: string;
  variable: string;
}

/**
 * Parsea texto pegado (copy-paste) o ingresado manualmente.
 * Soporta números simples, líneas con "Nombre, Teléfono", listas por comas, etc.
 */
export function parseRecipientsText(rawText: string | null | undefined): ParsedRecipient[] {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split(/\r?\n/);
  const recipients: ParsedRecipient[] = [];
  const seenPhones = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/[;,\t]/.test(trimmed)) {
      const parts = trimmed.split(/[;,\t]/).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        if (parts.every((p) => normalizePhone(p).length >= 7)) {
          for (const p of parts) {
            const norm = normalizePhone(p);
            if (norm && !seenPhones.has(norm)) {
              seenPhones.add(norm);
              recipients.push({ telefono: p, nombre: '', variable: '' });
            }
          }
          continue;
        }

        const phoneIndex = parts.findIndex((p) => normalizePhone(p).length >= 7);
        if (phoneIndex !== -1) {
          const telefono = parts[phoneIndex];
          const telNorm = normalizePhone(telefono);
          if (telNorm && !seenPhones.has(telNorm)) {
            seenPhones.add(telNorm);
            const otherParts = parts.filter((_, idx) => idx !== phoneIndex);
            const nombre = otherParts[0] || '';
            const variable = otherParts.slice(1).join(' ') || '';
            recipients.push({ telefono, nombre, variable });
          }
          continue;
        }
      }
    }

    const words = trimmed.split(/[\s,;]+/).map((w) => w.trim()).filter(Boolean);
    for (const w of words) {
      const norm = normalizePhone(w);
      if (norm.length >= 7 && !seenPhones.has(norm)) {
        seenPhones.add(norm);
        recipients.push({ telefono: w, nombre: '', variable: '' });
      }
    }
  }

  return recipients;
}

/**
 * Retardo estocástico con distribución Gaussiana / Box-Muller (Jitter Anti-Detección Meta).
 * Concentra la densidad en la media con dispersión orgánica hacia los extremos [min, max].
 */
export function gaussianRandomDelayMs(minSec: number, maxSec: number): number {
  const a = Math.max(1, Number(minSec) || 4);
  const b = Math.max(a, Number(maxSec) || 12);
  if (a === b) return a * 1000;

  const mean = (a + b) / 2;
  const stdDev = (b - a) / 6;

  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

  const val = Math.min(b, Math.max(a, mean + z * stdDev));
  return Math.round(val * 1000);
}

/**
 * Simulación de mecanografía humana (~250 car/min).
 * Acotada orgánicamente entre 1500ms y 4000ms según PRD § 4.2.
 */
export function calculateTypingDurationMs(textLength: number): number {
  const length = Math.max(0, Number(textLength) || 0);
  const duration = 1500 + length * 30;
  return Math.min(4000, Math.max(1500, duration));
}

/**
 * Motor Spintax Polimórfico (Anti-Hash Matching):
 * Resuelve sintaxis {Hola|Buen día|Qué tal} de forma no determinista.
 */
export function parseSpintax(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let current = text;
  const spintaxRegex = /\{([^{}]+?\|[^{}]+?)\}/;

  let match = spintaxRegex.exec(current);
  let guard = 0;
  while (match && guard < 50) {
    const options = match[1].split('|');
    const chosen = options[Math.floor(Math.random() * options.length)];
    current = current.slice(0, match.index) + chosen + current.slice(match.index + match[0].length);
    match = spintaxRegex.exec(current);
    guard++;
  }
  return current;
}

export function renderTemplate(template: string, vars: Record<string, any>): string {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    const val = vars[key];
    return val !== undefined && val !== null ? String(val) : `{${key}}`;
  });
}

/**
 * Clasificador Tri-Banda de Respuestas (Marketing Conversacional David Cancel).
 */
export type ResponseClassification = 'interes_inmediato' | 'postergacion' | 'baja' | 'otro';

export function clasificarRespuesta(texto: string): ResponseClassification {
  if (!texto) return 'otro';
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Desuscripción / Baja
  const patronesBaja = [
    'no me interesa', 'baja', 'sacame', 'borrame', 'no quiero', 'desuscribir',
    'no molestar', 'quien sos', 'equivocado', 'denunciar', 'spam', 'eliminar'
  ];
  if (patronesBaja.some((p) => t.includes(p))) return 'baja';

  // 2. Interés Inmediato
  const patronesInteres = [
    'si', 'dale', 'quiero', 'info', 'informacion', 'contame', 'precio', 'cuanto',
    'costo', 'me interesa', 'llamar', 'llamame', 'coordinar', 'reunion', 'presupuesto'
  ];
  if (patronesInteres.some((p) => t.includes(p))) return 'interes_inmediato';

  // 3. Postergación
  const patronesPostergacion = [
    'ahora no', 'mas adelante', 'semana que viene', 'ocupado', 'despues', 'viajando',
    'complicado', 'escribime luego', 'el mes que viene'
  ];
  if (patronesPostergacion.some((p) => t.includes(p))) return 'postergacion';

  return 'otro';
}

/**
 * Verificación de Horario Humano Seguro (SAFE_HOURS)
 */
export function isWithinSafeHours(date: Date, startHHMM: string, endHHMM: string): boolean {
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  const [startH, startM] = (startHHMM || '08:30').split(':').map(Number);
  const [endH, endM] = (endHHMM || '20:30').split(':').map(Number);

  const startMinutes = (Number.isFinite(startH) ? startH : 8) * 60 + (Number.isFinite(startM) ? startM : 30);
  const endMinutes = (Number.isFinite(endH) ? endH : 20) * 60 + (Number.isFinite(endM) ? endM : 30);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Ajusta una fecha a la próxima ventana horaria segura (SAFE_HOURS) si cae fuera de rango.
 */
export function clampDateToSafeHours(
  date: Date,
  safeHoursStart = '08:30',
  safeHoursEnd = '20:30'
): Date {
  const result = new Date(date.getTime());
  if (isWithinSafeHours(result, safeHoursStart, safeHoursEnd)) {
    return result;
  }

  const [rawStartH, rawStartM] = (safeHoursStart || '08:30').split(':').map(Number);
  const [rawEndH, rawEndM] = (safeHoursEnd || '20:30').split(':').map(Number);
  const startH = Number.isFinite(rawStartH) ? rawStartH : 8;
  const startM = Number.isFinite(rawStartM) ? rawStartM : 30;
  const endH = Number.isFinite(rawEndH) ? rawEndH : 20;
  const endM = Number.isFinite(rawEndM) ? rawEndM : 30;

  const currentMinutes = result.getHours() * 60 + result.getMinutes();
  const endMinutes = endH * 60 + endM;

  if (currentMinutes > endMinutes) {
    result.setDate(result.getDate() + 1);
  }
  result.setHours(startH, startM, 0, 0);
  return result;
}

// ==============================================================================
// 4. CONTRATOS Y UTILIDADES DEL MOTOR DE IA DE RETENCIÓN Y HANDOFF INVISIBLE (PRD § 3)
// ==============================================================================

export type AIProviderName = 'openai' | 'gemini' | 'anthropic';

export type EscalationReason =
  | 'KEYWORD_MATCH'
  | 'MAX_TURNS_REACHED'
  | 'OPT_OUT_REQUEST';

export interface OwnerAlertPayload {
  contactId: string;
  contactName: string;
  jid: string;
  phone: string;
  reason: EscalationReason;
  summaryTwoLines: string;
  chatUrl: string;
  timestamp: string;
}

export interface AIRetentionDecision {
  shouldReply: boolean;
  replyText: string | null;
  escalated: boolean;
  escalationReason: EscalationReason | null;
  nextMode: AIMode;
  mutedUntil: Date | null;
  alertPayload: OwnerAlertPayload | null;
  scheduledJob?: ScheduledJob;
  outboundMessage?: Message;
}

/**
 * Sanitizador anti-jerga robótica y anti-avisos de transferencia (PRD § 3):
 * Elimina frases como "Como modelo de lenguaje...", "Soy una IA...",
 * "Te transfiero con un asesor..." para mantener un traspaso 100% invisible.
 */
export function sanitizeRoboticPhrases(text: string): string {
  if (!text || typeof text !== 'string') return '';

  const forbiddenPatterns: RegExp[] = [
    /como\s+(un\s+)?modelo\s+de\s+lenguaje[^.,;\n]*[.,;\n]?/gi,
    /como\s+inteligencia\s+artificial[^.,;\n]*[.,;\n]?/gi,
    /soy\s+(un\s+asistente\s+virtual|una\s+ia|un\s+bot|una\s+inteligencia\s+artificial)[^.,;\n]*[.,;\n]?/gi,
    /te\s+(transfiero|derivo|paso|comunico)\s+con\s+(un\s+)?(asesor|humano|representante|agente|operador)[^.,;\n]*[.,;\n]?/gi,
    /un\s+(asesor|agente|humano)\s+tomar[áa]\s+tu\s+caso[^.,;\n]*[.,;\n]?/gi,
  ];

  let cleaned = text;
  for (const regex of forbiddenPatterns) {
    cleaned = cleaned.replace(regex, '');
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned || '¡Gracias por escribirnos! En breve te confirmo los detalles por acá.';
}

