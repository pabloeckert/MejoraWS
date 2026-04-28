// src/brain/conversation-quality.ts
// Conversation quality scoring — measures how well the bot handles conversations

import Database, { Database as DatabaseType } from 'better-sqlite3'

export interface ConversationScore {
  phone: string
  contactName: string | null
  totalMessages: number
  inboundMessages: number
  outboundMessages: number
  avgResponseTimeMs: number | null
  autoResolved: boolean
  escalated: boolean
  intents: Record<string, number>
  sentiment: 'positive' | 'neutral' | 'negative'
  qualityScore: number // 0-100
  summary: string
}

export interface QualityStats {
  totalConversations: number
  avgQualityScore: number
  autoResolutionRate: number
  escalationRate: number
  avgResponseTimeMs: number | null
  intentDistribution: Record<string, number>
  sentimentDistribution: Record<string, number>
  topConversations: ConversationScore[]
  worstConversations: ConversationScore[]
}

export class ConversationQualityScorer {
  private db: DatabaseType

  constructor(db: DatabaseType) {
    this.db = db
  }

  /**
   * Score a single conversation
   */
  scoreConversation(phone: string): ConversationScore | null {
    // Get all messages for this contact
    const messages = this.db.prepare(`
      SELECT direction, content, created_at
      FROM messages
      WHERE contact_phone = ?
      ORDER BY created_at ASC
    `).all(phone) as any[]

    if (messages.length === 0) return null

    // Get contact info
    const contact = this.db.prepare('SELECT name FROM contacts WHERE phone = ?').get(phone) as any

    // Get activities (intents)
    const activities = this.db.prepare(`
      SELECT type, metadata
      FROM activities
      WHERE contact_phone = ? AND type = 'bot_reply'
      ORDER BY created_at ASC
    `).all(phone) as any[]

    const inbound = messages.filter(m => m.direction === 'inbound')
    const outbound = messages.filter(m => m.direction === 'outbound')

    // Calculate intent distribution
    const intents: Record<string, number> = {}
    for (const act of activities) {
      try {
        const meta = JSON.parse(act.metadata || '{}')
        if (meta.intent) {
          intents[meta.intent] = (intents[meta.intent] || 0) + 1
        }
      } catch {}
    }

    // Calculate average response time (time between inbound and next outbound)
    let totalResponseTime = 0
    let responseCount = 0
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].direction === 'inbound' && messages[i + 1].direction === 'outbound') {
        const diff = new Date(messages[i + 1].created_at).getTime() - new Date(messages[i].created_at).getTime()
        if (diff > 0 && diff < 300000) { // < 5 min (reasonable response time)
          totalResponseTime += diff
          responseCount++
        }
      }
    }
    const avgResponseTimeMs = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : null

    // Detect escalation (last message is human takeover)
    const lastOutbound = outbound[outbound.length - 1]
    const escalated = lastOutbound?.content?.includes('asesor humano') ||
                      lastOutbound?.content?.includes('conectándote') || false

    // Auto-resolved = has bot responses and wasn't escalated
    const autoResolved = outbound.length > 0 && !escalated

    // Simple sentiment (count positive/negative intents)
    const positiveIntents = (intents['COMPRA'] || 0) + (intents['CONSULTA'] || 0)
    const negativeIntents = (intents['QUEJA'] || 0)
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral'
    if (positiveIntents > negativeIntents + 1) sentiment = 'positive'
    else if (negativeIntents > positiveIntents) sentiment = 'negative'

    // Quality score (0-100)
    let qualityScore = 50 // base
    if (autoResolved) qualityScore += 20
    if (escalated) qualityScore -= 10
    if (avgResponseTimeMs && avgResponseTimeMs < 10000) qualityScore += 15 // fast response
    if (outbound.length > 0) qualityScore += 10 // bot responded
    if (sentiment === 'positive') qualityScore += 10
    if (sentiment === 'negative') qualityScore -= 15
    if (inbound.length > 1 && outbound.length >= inbound.length) qualityScore += 5 // engaged
    qualityScore = Math.max(0, Math.min(100, qualityScore))

    // Summary
    const summary = escalated
      ? `Conversación escalada a humano después de ${outbound.length} respuestas automáticas`
      : autoResolved
        ? `Resuelta automáticamente. ${Object.keys(intents).length > 0 ? `Intención principal: ${Object.entries(intents).sort((a, b) => b[1] - a[1])[0][0]}` : 'Sin intención detectada'}`
        : 'Conversación sin respuestas del bot'

    return {
      phone,
      contactName: contact?.name || null,
      totalMessages: messages.length,
      inboundMessages: inbound.length,
      outboundMessages: outbound.length,
      avgResponseTimeMs,
      autoResolved,
      escalated,
      intents,
      sentiment,
      qualityScore,
      summary,
    }
  }

  /**
   * Get quality statistics across all conversations
   */
  getStats(limit: number = 10): QualityStats {
    // Get unique contact phones from messages
    const phones = this.db.prepare(`
      SELECT DISTINCT contact_phone FROM messages ORDER BY contact_phone
    `).all() as any[]

    const scores: ConversationScore[] = []
    for (const { contact_phone } of phones) {
      const score = this.scoreConversation(contact_phone)
      if (score) scores.push(score)
    }

    if (scores.length === 0) {
      return {
        totalConversations: 0,
        avgQualityScore: 0,
        autoResolutionRate: 0,
        escalationRate: 0,
        avgResponseTimeMs: null,
        intentDistribution: {},
        sentimentDistribution: {},
        topConversations: [],
        worstConversations: [],
      }
    }

    // Aggregate stats
    const avgQualityScore = Math.round(scores.reduce((s, c) => s + c.qualityScore, 0) / scores.length)
    const autoResolutionRate = Math.round((scores.filter(c => c.autoResolved).length / scores.length) * 100)
    const escalationRate = Math.round((scores.filter(c => c.escalated).length / scores.length) * 100)

    const responseTimes = scores.filter(c => c.avgResponseTimeMs !== null).map(c => c.avgResponseTimeMs!)
    const avgResponseTimeMs = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length)
      : null

    // Intent distribution
    const intentDistribution: Record<string, number> = {}
    for (const score of scores) {
      for (const [intent, count] of Object.entries(score.intents)) {
        intentDistribution[intent] = (intentDistribution[intent] || 0) + count
      }
    }

    // Sentiment distribution
    const sentimentDistribution: Record<string, number> = {}
    for (const score of scores) {
      sentimentDistribution[score.sentiment] = (sentimentDistribution[score.sentiment] || 0) + 1
    }

    // Top/worst conversations
    const sorted = [...scores].sort((a, b) => b.qualityScore - a.qualityScore)

    return {
      totalConversations: scores.length,
      avgQualityScore,
      autoResolutionRate,
      escalationRate,
      avgResponseTimeMs,
      intentDistribution,
      sentimentDistribution,
      topConversations: sorted.slice(0, limit),
      worstConversations: sorted.slice(-limit).reverse(),
    }
  }
}
