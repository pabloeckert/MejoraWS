import {
  MultiProviderLLMAdapter as SharedMultiProviderLLMAdapter,
  OwnerWebhookNotifier as SharedOwnerWebhookNotifier,
  type MultiProviderLLMOptions,
} from '@mejoraws/shared/server';
import { env } from '../../config/env.js';

export type { MultiProviderLLMOptions };

export class MultiProviderLLMAdapter extends SharedMultiProviderLLMAdapter {
  constructor(options: MultiProviderLLMOptions = {}) {
    super({
      provider: options.provider ?? env.AI_PROVIDER,
      apiKey: options.apiKey ?? env.AI_API_KEY,
      defaultModel: options.defaultModel ?? env.AI_MODEL,
      thinkingLevel: options.thinkingLevel ?? env.AI_THINKING_LEVEL,
      timeoutMs: options.timeoutMs ?? 15000,
      maxRetries: options.maxRetries ?? 2,
      fetchImpl: options.fetchImpl,
    });
  }
}

export class OwnerWebhookNotifier extends SharedOwnerWebhookNotifier {
  constructor(
    defaultWebhookUrl = env.OWNER_ALERT_WEBHOOK_URL,
    fetchImpl: typeof fetch = globalThis.fetch
  ) {
    super(defaultWebhookUrl, fetchImpl);
  }
}
