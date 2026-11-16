import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type {
  AIProviderName,
  AIThinkingLevel,
  MessagingProviderType,
} from '@mejoraws/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../../.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export interface EnvConfig {
  ADMIN_USER: string;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
  MASTER_API_KEY: string;
  APP_PORT: number;
  TZ: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  MESSAGING_PROVIDER: MessagingProviderType;
  EVOLUTION_API_URL: string;
  EVOLUTION_API_KEY: string;
  INSTANCE_NAME: string;
  EVOLUTION_WEBHOOK_SECRET: string;
  META_PHONE_NUMBER_ID: string;
  META_ACCESS_TOKEN: string;
  META_APP_SECRET: string;
  META_VERIFY_TOKEN: string;
  META_API_VERSION: string;
  ENFORCE_WHITELIST: boolean;
  JITTER_MIN_SECONDS: number;
  JITTER_MAX_SECONDS: number;
  BATCH_PAUSE_EVERY_N_MESSAGES: number;
  BATCH_PAUSE_SECONDS: number;
  SAFE_HOURS_START: string;
  SAFE_HOURS_END: string;
  MAX_MESSAGES_PER_HOUR: number;
  AI_PROVIDER: AIProviderName;
  AI_API_KEY: string;
  AI_MODEL: string;
  AI_THINKING_LEVEL: AIThinkingLevel;
  AI_AUTO_MUTE_HOURS_ON_HUMAN_REPLY: number;
  OWNER_ALERT_WEBHOOK_URL: string;
  UPLOADS_DIR: string;
  COOKIE_SECURE: boolean;
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAIProvider(value: string | undefined): AIProviderName {
  const normalized = (value || 'gemini').trim().toLowerCase();
  if (normalized === 'openai' || normalized === 'anthropic') {
    return normalized;
  }
  return 'gemini';
}

function parseThinkingLevel(value: string | undefined): AIThinkingLevel {
  const normalized = (value || 'high').trim().toLowerCase();
  if (
    normalized === 'low' ||
    normalized === 'medium' ||
    normalized === 'high' ||
    normalized === 'xhigh'
  ) {
    return normalized;
  }
  return 'high';
}

function parseMessagingProvider(
  value: string | undefined
): MessagingProviderType {
  const normalized = (value || 'evolution').trim().toLowerCase();
  return normalized === 'meta_cloud' ? 'meta_cloud' : 'evolution';
}

export const env: EnvConfig = {
  ADMIN_USER: process.env.ADMIN_USER || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin_secure_pass_2026!',
  JWT_SECRET:
    process.env.JWT_SECRET ||
    'super_secret_jwt_key_mejoraws_conversational_retention_2026_xyz',
  MASTER_API_KEY:
    process.env.MASTER_API_KEY || 'sk_live_mejoraws_master_key_2026_authorized',
  APP_PORT: toInt(process.env.APP_PORT || process.env.PORT, 3000),
  TZ: process.env.TZ || 'America/Argentina/Buenos_Aires',
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres_secure_pass_2026@postgres:5432/mejoraws',
  REDIS_URL: process.env.REDIS_URL || 'redis://redis:6379/0',
  MESSAGING_PROVIDER: parseMessagingProvider(process.env.MESSAGING_PROVIDER),
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'http://evolution-api:8080',
  EVOLUTION_API_KEY:
    process.env.EVOLUTION_API_KEY || 'evo_internal_secret_key_2026',
  INSTANCE_NAME: process.env.INSTANCE_NAME || 'principal_v1',
  EVOLUTION_WEBHOOK_SECRET: process.env.EVOLUTION_WEBHOOK_SECRET || '',
  META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID || '',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
  META_APP_SECRET: process.env.META_APP_SECRET || '',
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || 'mejoraws_meta_verify_token_2026',
  META_API_VERSION: process.env.META_API_VERSION || 'v21.0',
  ENFORCE_WHITELIST: process.env.ENFORCE_WHITELIST !== 'false',
  JITTER_MIN_SECONDS: toInt(process.env.JITTER_MIN_SECONDS, 4),
  JITTER_MAX_SECONDS: toInt(process.env.JITTER_MAX_SECONDS, 12),
  BATCH_PAUSE_EVERY_N_MESSAGES: toInt(process.env.BATCH_PAUSE_EVERY_N_MESSAGES, 15),
  BATCH_PAUSE_SECONDS: toInt(process.env.BATCH_PAUSE_SECONDS, 60),
  SAFE_HOURS_START: process.env.SAFE_HOURS_START || '08:30',
  SAFE_HOURS_END: process.env.SAFE_HOURS_END || '20:30',
  MAX_MESSAGES_PER_HOUR: toInt(process.env.MAX_MESSAGES_PER_HOUR, 120),
  AI_PROVIDER: parseAIProvider(process.env.AI_PROVIDER),
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || 'gemini-3.8-flash',
  AI_THINKING_LEVEL: parseThinkingLevel(process.env.AI_THINKING_LEVEL),
  AI_AUTO_MUTE_HOURS_ON_HUMAN_REPLY: toInt(
    process.env.AI_AUTO_MUTE_HOURS_ON_HUMAN_REPLY,
    24
  ),
  OWNER_ALERT_WEBHOOK_URL: process.env.OWNER_ALERT_WEBHOOK_URL || '',
  UPLOADS_DIR: process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads'),
  COOKIE_SECURE:
    process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
};
