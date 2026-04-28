// src/utils/metrics.ts
// Prometheus metrics para MejoraWS
// Endpoint: GET /metrics

import { childLogger } from './logger'

const log = childLogger('metrics')

interface MetricValue {
  value: number
  labels?: Record<string, string>
  timestamp?: number
}

interface Metric {
  name: string
  help: string
  type: 'counter' | 'gauge' | 'histogram'
  values: MetricValue[]
}

class MetricsRegistry {
  private metrics: Map<string, Metric> = new Map()

  /**
   * Registra un counter (solo incrementa)
   */
  counter(name: string, help: string): Counter {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { name, help, type: 'counter', values: [{ value: 0 }] })
    }
    return new Counter(this, name)
  }

  /**
   * Registra un gauge (sube y baja)
   */
  gauge(name: string, help: string): Gauge {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { name, help, type: 'gauge', values: [{ value: 0 }] })
    }
    return new Gauge(this, name)
  }

  /**
   * Incrementa un metric
   */
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name)
    if (!metric) return

    if (labels) {
      const key = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')
      const existing = metric.values.find(v =>
        v.labels && Object.entries(v.labels).map(([k, val]) => `${k}="${val}"`).join(',') === key
      )
      if (existing) {
        existing.value += value
      } else {
        metric.values.push({ value, labels })
      }
    } else {
      metric.values[0].value += value
    }
  }

  /**
   * Setea el valor de un gauge
   */
  set(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name)
    if (!metric) return

    if (labels) {
      const key = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')
      const existing = metric.values.find(v =>
        v.labels && Object.entries(v.labels).map(([k, val]) => `${k}="${val}"`).join(',') === key
      )
      if (existing) {
        existing.value = value
      } else {
        metric.values.push({ value, labels })
      }
    } else {
      metric.values[0].value = value
    }
  }

  /**
   * Exporta todas las métricas en formato Prometheus text
   */
  render(): string {
    const lines: string[] = []

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`)
      lines.push(`# TYPE ${metric.name} ${metric.type}`)

      for (const val of metric.values) {
        const labelStr = val.labels
          ? '{' + Object.entries(val.labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
          : ''
        const ts = val.timestamp ? ` ${val.timestamp}` : ''
        lines.push(`${metric.name}${labelStr} ${val.value}${ts}`)
      }
    }

    return lines.join('\n') + '\n'
  }
}

class Counter {
  constructor(private registry: MetricsRegistry, private name: string) {}
  inc(value: number = 1, labels?: Record<string, string>): void {
    this.registry.increment(this.name, value, labels)
  }
}

class Gauge {
  constructor(private registry: MetricsRegistry, private name: string) {}
  set(value: number, labels?: Record<string, string>): void {
    this.registry.set(this.name, value, labels)
  }
  inc(value: number = 1, labels?: Record<string, string>): void {
    this.registry.increment(this.name, value, labels)
  }
}

// === Singleton registry ===
export const metrics = new MetricsRegistry()

// === Métricas de MejoraWS ===

// Mensajes
export const messagesTotal = metrics.counter('mejoraws_messages_total', 'Total messages processed')
export const messagesInbound = metrics.counter('mejoraws_messages_inbound_total', 'Total inbound messages')
export const messagesOutbound = metrics.counter('mejoraws_messages_outbound_total', 'Total outbound messages')

// WhatsApp
export const whatsappConnected = metrics.gauge('mejoraws_whatsapp_connected', 'WhatsApp connection status (1=connected)')

// LLM
export const llmRequests = metrics.counter('mejoraws_llm_requests_total', 'Total LLM requests')
export const llmErrors = metrics.counter('mejoraws_llm_errors_total', 'Total LLM errors')
export const llmLatency = metrics.gauge('mejoraws_llm_latency_ms', 'LLM request latency in ms')

// Auto-reply
export const autoReplies = metrics.counter('mejoraws_auto_replies_total', 'Total auto-replies sent')
export const escalations = metrics.counter('mejoraws_escalations_total', 'Total escalations to human')

// CRM
export const contactsTotal = metrics.gauge('mejoraws_contacts_total', 'Total contacts in CRM')
export const dealsOpen = metrics.gauge('mejoraws_deals_open', 'Open deals')
export const dealsClosed = metrics.counter('mejoraws_deals_closed_total', 'Total deals closed')

// Campaigns
export const campaignsSent = metrics.counter('mejoraws_campaigns_sent_total', 'Total campaign messages sent')
export const campaignsDelivered = metrics.counter('mejoraws_campaigns_delivered_total', 'Total campaign messages delivered')

// Anti-ban
export const warmupDay = metrics.gauge('mejoraws_warmup_day', 'Current warm-up day')
export const dailyLimit = metrics.gauge('mejoraws_daily_limit', 'Current daily message limit')
export const sentToday = metrics.gauge('mejoraws_sent_today', 'Messages sent today')

// API
export const httpRequests = metrics.counter('mejoraws_http_requests_total', 'Total HTTP requests')
export const httpErrors = metrics.counter('mejoraws_http_errors_total', 'Total HTTP errors')

// System
export const uptime = metrics.gauge('mejoraws_uptime_seconds', 'System uptime in seconds')
export const dbSize = metrics.gauge('mejoraws_db_size_bytes', 'Database file size in bytes')

log.info('Metrics registry initialized')
