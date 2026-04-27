# 🗺️ PLAN POR ETAPAS — MejoraWS

> **Objetivo:** Desarrollo rápido con resultados utilizables en cada etapa.
> **Filosofía:** Cada etapa entrega algo que PODES USAR inmediatamente.

---

## VISIÓN GENERAL

```
ETAPA 1 (Días 1-3)    → WhatsApp conectado + mensajes manuales
ETAPA 2 (Días 4-7)    → Bot IA que responde solo
ETAPA 3 (Días 8-12)   → CRM con contactos importados
ETAPA 4 (Días 13-17)  → Campañas automáticas
ETAPA 5 (Días 18-22)  → Dashboard visual con KPIs
ETAPA 6 (Días 23-28)  → Sistema 100% autónomo
```

**Total: 28 días (4 semanas) — más agresivo que las 6 semanas originales.**

---

## ETAPA 1: CONEXIÓN (Días 1-3)

### Objetivo
Que la app se conecte a WhatsApp y puedas enviar/recibir mensajes desde terminal.

### Día 1: Setup del Proyecto
```bash
# Inicializar proyecto
mkdir mejoraws && cd mejoraws
npm init -y
npm install typescript ts-node @types/node --save-dev
npx tsc --init

# Dependencias core
npm install express @types/express
npm install @prisma/client prisma
npm install @whiskeysockets/baileys
npm install baileys-antiban
npm install better-sqlite3 @types/better-sqlite3

# Inicializar Prisma
npx prisma init --datasource-provider sqlite
```

**Archivos a crear:**
```
mejoraws/
├── src/
│   ├── server.ts              # Entry point
│   ├── whatsapp/
│   │   ├── client.ts          # Conexión Baileys
│   │   ├── sender.ts          # Envío de mensajes
│   │   └── receiver.ts        # Recepción de mensajes
│   └── antiban/
│       ├── rate-limiter.ts    # Gaussian jitter
│       └── warmup.ts          # Warm-up 14 días
├── prisma/
│   └── schema.prisma          # Schema mínimo
├── data/                      # SQLite + sesión
├── package.json
└── tsconfig.json
```

### Día 2: Conexión WhatsApp
```typescript
// src/whatsapp/client.ts
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'

export async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./data/session')
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })
  
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', (update) => {
    if (update.connection === 'open') {
      console.log('✅ WhatsApp conectado!')
    }
  })
  
  return sock
}
```

### Día 3: Envío/Recepción + Anti-ban básico
```typescript
// src/antiban/rate-limiter.ts
export function gaussianDelay(mean: number = 10000, stdDev: number = 3000): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return Math.max(5000, Math.round(mean + z * stdDev))
}

// src/whatsapp/sender.ts
export async function sendMessage(sock: any, to: string, text: string) {
  const delay = gaussianDelay()
  console.log(`⏳ Esperando ${delay/1000}s (anti-ban)...`)
  await sleep(delay)
  
  // Typing indicator
  await sock.sendPresenceUpdate('composing', to)
  await sleep(1000 + Math.random() * 2000)
  
  // Enviar
  await sock.sendMessage(to, { text })
  await sock.sendPresenceUpdate('paused', to)
  
  console.log(`✅ Enviado a ${to}`)
}
```

### Entregable Etapa 1
- ✅ App Node.js que se conecta a tu WhatsApp
- ✅ Podés enviar mensajes desde terminal
- ✅ Recibís mensajes y se loggean en consola
- ✅ Anti-ban básico (Gaussian delay + typing)
- ✅ **UTILIZABLE:** Podés enviar mensajes programados manualmente

### Test de la Etapa 1
```bash
npx ts-node src/server.ts
# Escanear QR con tu teléfono
# Enviar mensaje de prueba desde terminal
# Verificar que llega con delay humano
```

---

## ETAPA 2: BOT IA (Días 4-7)

### Objetivo
El bot responde automáticamente a los mensajes como un humano.

### Día 4: Integración Groq API
```bash
npm install groq-sdk
```

```typescript
// src/llm/groq.ts
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function generateResponse(
  message: string,
  context: string,
  personality: string
): Promise<string> {
  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: `${personality}\n\nContexto del negocio:\n${context}` },
      { role: 'user', content: message }
    ],
    model: 'qwen-2.5-32b',
    temperature: 0.7,
    max_tokens: 500
  })
  
  return completion.choices[0].message.content || 'Disculpa, no entendí. ¿Podés repetir?'
}
```

### Día 5: Motor de Auto-Respuesta
```typescript
// src/brain/auto-reply.ts
export class AutoReplyEngine {
  private personality: string
  private knowledgeBase: string
  private config: BotConfig
  
  async handleMessage(msg: IncomingMessage): Promise<string> {
    // 1. Detectar intención
    const intent = await this.detectIntent(msg.text)
    
    // 2. Recuperar contexto del contacto
    const context = await this.getContactContext(msg.from)
    
    // 3. Generar respuesta
    const response = await generateResponse(
      msg.text,
      `${this.knowledgeBase}\n\nHistorial: ${context}`,
      this.personality
    )
    
    // 4. Registrar en CRM
    await this.logActivity(msg.from, 'bot_reply', response)
    
    // 5. Verificar escalamiento
    if (this.needsEscalation(msg.text, intent)) {
      return this.escalate(msg.from, response)
    }
    
    return response
  }
  
  private async detectIntent(text: string): Promise<string> {
    const result = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Clasifica la intención: CONSULTA|COMPRA|QUEJA|SALUDO|SOPORTE|PRECIO' },
        { role: 'user', content: text }
      ],
      model: 'qwen-2.5-32b',
      temperature: 0,
      max_tokens: 20
    })
    return result.choices[0].message.content?.trim() || 'CONSULTA'
  }
}
```

### Día 6: Detección de Intención + Escalamiento
```typescript
// src/brain/escalation.ts
const ESCALATION_KEYWORDS = ['hablar con alguien', 'agente', 'urgente', 'supervisor']

export function needsEscalation(text: string, intent: string, exchangeCount: number): boolean {
  if (ESCALATION_KEYWORDS.some(kw => text.toLowerCase().includes(kw))) return true
  if (intent === 'QUEJA') return true
  if (exchangeCount >= 3 && intent === 'CONSULTA') return true
  return false
}
```

### Día 7: Personalidad + Knowledge Base
```json
// config/bot.json
{
  "nombre": "María",
  "personalidad": "Soy María, asesora de ventas de [Negocio]. Respondo de forma clara, amable y profesional. Nunca sueno a robot. Si no sé algo, lo digo honestamente.",
  "horario": "8:00-20:00",
  "tono": "profesional-cercano"
}
```

### Entregable Etapa 2
- ✅ Bot que responde automáticamente a TODOS los mensajes
- ✅ Detección de intención (6 tipos)
- ✅ Personalidad configurable
- ✅ Escalamiento a humano automático
- ✅ **UTILIZABLE:** Tu WhatsApp tiene un bot que contesta solo

### Test de la Etapa 2
```bash
# Mandale un mensaje a tu número desde otro teléfono
# El bot debería responder en 3-15 segundos
# Debería sonar humano, no robótico
# Mandá "hablar con alguien" → debería escalar
```

---

## ETAPA 3: CRM (Días 8-12)

### Objetivo
Contactos importados, pipeline Kanban, seguimiento automático.

### Día 8: Schema Prisma Completo
```prisma
// prisma/schema.prisma
model Contact {
  id        String  @id @default(cuid())
  name      String?
  phone     String  @unique
  email     String?
  whatsapp  Boolean @default(false)
  tags      String  @default("[]")
  score     Int     @default(0)
  source    String?
  consent   Boolean @default(false)
  deals     Deal[]
  messages  Message[]
  activities Activity[]
}

model Deal {
  id          String  @id @default(cuid())
  contactId   String
  contact     Contact @relation(fields: [contactId])
  stage       String  @default("nuevo")
  value       Float?
  probability Int     @default(0)
  nextFollowUp DateTime?
}

// ... (schema completo en 01-DOCUMENTACION-CONSOLIDADA.md)
```

```bash
npx prisma migrate dev --name init
```

### Día 9: Importador CSV/Excel
```bash
npm install xlsx papaparse
```

```typescript
// src/importer/pipeline.ts
export class ContactImporter {
  async importFile(filePath: string): Promise<ImportResult> {
    // 1. Detectar formato
    const format = this.detectFormat(filePath)
    
    // 2. Parsear
    const raw = await this.parse(filePath, format)
    
    // 3. Auto-detectar columnas
    const mapped = this.autoMapColumns(raw)
    
    // 4. Limpiar
    const cleaned = this.clean(mapped)
    
    // 5. Deduplicar
    const unique = this.deduplicate(cleaned)
    
    // 6. Validar WhatsApp
    const validated = await this.validateWhatsApp(unique)
    
    // 7. Importar a DB
    const result = await this.saveToDB(validated)
    
    return result
  }
}
```

### Día 10: CRUD Contactos + Tags
```typescript
// src/crm/contacts.ts
export class ContactManager {
  async list(filter?: ContactFilter): Promise<Contact[]> { ... }
  async get(id: string): Promise<Contact> { ... }
  async update(id: string, data: Partial<Contact>): Promise<Contact> { ... }
  async addTag(id: string, tag: string): Promise<void> { ... }
  async search(query: string): Promise<Contact[]> { ... }
  async getByTag(tag: string): Promise<Contact[]> { ... }
}
```

### Día 11: Pipeline Kanban
```typescript
// src/crm/deals.ts
export class DealManager {
  async create(contactId: string, value?: number): Promise<Deal> { ... }
  async moveStage(dealId: string, newStage: string): Promise<Deal> { ... }
  async getPipeline(): Promise<PipelineView> { ... }
  async getStages(): Promise<StageSummary[]> { ... }
  
  // Auto-movimiento por reglas
  async evaluateAutoMove(contactId: string, trigger: string): Promise<void> {
    const rules = await this.getRules()
    const deal = await this.getActiveDeal(contactId)
    
    if (rules.autoMove) {
      const nextStage = this.calculateNextStage(deal.stage, trigger)
      if (nextStage) await this.moveStage(deal.id, nextStage)
    }
  }
}
```

### Día 12: Follow-up Automático
```typescript
// src/crm/followup.ts
export class FollowUpManager {
  async checkPending(): Promise<void> {
    const pending = await prisma.deal.findMany({
      where: {
        nextFollowUp: { lte: new Date() },
        stage: { notIn: ['cerrado-ganado', 'cerrado-perdido'] }
      }
    })
    
    for (const deal of pending) {
      await this.sendFollowUp(deal)
    }
  }
  
  async scheduleFollowUp(dealId: string, hours: number): Promise<void> {
    const followUp = new Date(Date.now() + hours * 60 * 60 * 1000)
    await prisma.deal.update({
      where: { id: dealId },
      data: { nextFollowUp: followUp }
    })
  }
}
```

### Entregable Etapa 3
- ✅ Base de datos con schema completo
- ✅ Importador CSV/Excel con auto-detección
- ✅ CRUD de contactos con tags
- ✅ Pipeline Kanban con etapas
- ✅ Follow-ups automáticos a 48h
- ✅ **UTILIZABLE:** CRM funcional, importá tus contactos y el bot los gestiona

### Test de la Etapa 3
```bash
# Importar un CSV de contactos
npx ts-node src/importer/pipeline.ts ./test-contacts.csv
# Verificar en DB que se importaron
# Mandar mensaje → ver que se crea deal automáticamente
# Esperar 48h sin respuesta → ver follow-up automático
```

---

## ETAPA 4: MARKETING (Días 13-17)

### Objetivo
Campañas automáticas con protección anti-ban.

### Día 13: Template Engine
```typescript
// src/marketing/template-engine.ts
export class TemplateEngine {
  // Variables: {{nombre}}, {{empresa}}, etc.
  render(template: string, contact: Contact): string {
    return template
      .replace(/\{\{nombre\}\}/g, contact.name || 'amigo')
      .replace(/\{\{empresa\}\}/g, contact.company || '')
  }
  
  // Spintax: {Hola|Buenos días|Qué tal}
  applySpintax(text: string): string {
    return text.replace(/\{([^}]+)\}/g, (_, options) => {
      const choices = options.split('|')
      return choices[Math.floor(Math.random() * choices.length)]
    })
  }
  
  // Generar variaciones
  generateVariations(template: string, count: number): string[] {
    const variations = new Set<string>()
    let attempts = 0
    while (variations.size < count && attempts < 100) {
      variations.add(this.applySpintax(template))
      attempts++
    }
    return Array.from(variations)
  }
}
```

### Día 14: Cola de Envío + Anti-ban
```typescript
// src/marketing/queue-manager.ts
import Queue from 'bull'

const sendQueue = new Queue('whatsapp-sends', {
  limiter: {
    max: 1, // 1 mensaje a la vez
    duration: gaussianDelay() // delay variable
  }
})

sendQueue.process(async (job) => {
  const { phone, message, campaignId } = job.data
  
  // Anti-ban: warm-up check
  if (!warmup.canSend()) {
    throw new Error('Warm-up: límite diario alcanzado')
  }
  
  // Anti-ban: typing simulation
  await sock.sendPresenceUpdate('composing', phone)
  await sleep(1000 + Math.random() * 2000)
  
  // Enviar
  await sock.sendMessage(phone, { text: message })
  
  // Anti-ban: pausa cada 10 mensajes
  if (warmup.sentToday % 10 === 0) {
    await sleep(120000 + Math.random() * 180000) // 2-5 min
  }
  
  // Tracking
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { sentCount: { increment: 1 } }
  })
})
```

### Día 15: Campaign Generator
```typescript
// src/marketing/campaign-generator.ts
export class CampaignGenerator {
  async createCampaign(config: CampaignConfig): Promise<Campaign> {
    // 1. Generar variaciones del mensaje
    const variations = await this.generateVariations(config)
    
    // 2. Seleccionar audiencia
    const audience = await this.selectAudience(config.audience)
    
    // 3. Programar envío
    const scheduled = this.scheduleSend(config.schedule)
    
    // 4. Crear campaña en DB
    const campaign = await prisma.campaign.create({
      data: {
        name: config.name,
        objective: config.objective,
        template: config.template,
        variations: JSON.stringify(variations),
        audience: JSON.stringify(audience),
        scheduledAt: scheduled,
        status: 'scheduled'
      }
    })
    
    return campaign
  }
}
```

### Día 16: Segmentación Automática
```typescript
// src/marketing/segmenter.ts
export class AudienceSegmenter {
  async segment(filter: AudienceFilter): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: {
        whatsapp: true,
        consent: true,
        tags: { contains: filter.tags?.[0] || '' },
        score: { gte: filter.minScore || 0 }
      },
      orderBy: { score: 'desc' },
      take: filter.maxContacts || 100
    })
  }
}
```

### Día 17: Tracking de Estados
```typescript
// src/marketing/tracker.ts
export class CampaignTracker {
  async trackDelivery(messageId: string, status: string): Promise<void> {
    await prisma.message.update({
      where: { id: messageId },
      data: { status }
    })
    
    // Actualizar contadores de campaña
    const message = await prisma.message.findUnique({ where: { id: messageId } })
    if (message?.campaignId) {
      const field = `${status}Count`
      await prisma.campaign.update({
        where: { id: message.campaignId },
        data: { [field]: { increment: 1 } }
      })
    }
  }
}
```

### Entregable Etapa 4
- ✅ Motor de campañas con spintax
- ✅ Cola de envío con anti-ban completo
- ✅ Segmentación automática de audiencia
- ✅ Tracking: enviado → entregado → leído → respondió
- ✅ **UTILIZABLE:** Creá campañas y el sistema las envía protegido

### Test de la Etapa 4
```bash
# Crear campaña de prueba con 10 contactos
# Verificar que se envían con delays variables
# Verificar que el tracking se actualiza
# Verificar warm-up (no exceder límite diario)
```

---

## ETAPA 5: DASHBOARD (Días 18-22)

### Objetivo
Dashboard visual con KPIs, gráficas y configuración.

### Día 18: Setup Next.js
```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app
npm install shadcn-ui recharts lucide-react
npx shadcn-ui init
```

### Día 19: Páginas Principales
```
frontend/
├── app/
│   ├── page.tsx              # Dashboard principal
│   ├── contacts/page.tsx     # Lista de contactos
│   ├── pipeline/page.tsx     # Kanban pipeline
│   ├── campaigns/page.tsx    # Campañas
│   ├── chat/page.tsx         # Conversaciones
│   ├── analytics/page.tsx    # KPIs y gráficas
│   └── settings/page.tsx     # Configuración
```

### Día 20: KPIs en Tiempo Real
```typescript
// components/Dashboard/KPICard.tsx
export function KPICards() {
  const { data } = useSWR('/api/analytics/summary', fetcher, {
    refreshInterval: 30000 // cada 30s
  })
  
  return (
    <div className="grid grid-cols-4 gap-4">
      <KPICard title="Enviados" value={data.sent} icon={Send} />
      <KPICard title="Entregados" value={data.delivered} icon={Check} />
      <KPICard title="Leídos" value={data.read} icon={Eye} />
      <KPICard title="Respuestas" value={data.replied} icon={MessageSquare} />
    </div>
  )
}
```

### Día 21: Gráficas
```typescript
// components/Charts/MessagesChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

export function MessagesChart({ data }) {
  return (
    <LineChart width={600} height={300} data={data}>
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="sent" stroke="#3b82f6" />
      <Line type="monotone" dataKey="replied" stroke="#22c55e" />
    </LineChart>
  )
}
```

### Día 22: Configuración + Knowledge Base
```typescript
// app/settings/page.tsx
export default function Settings() {
  return (
    <div>
      <BusinessConfig />
      <BotPersonality />
      <KnowledgeBaseUpload />
      <MarketingRules />
      <PipelineRules />
      <AntiBanSettings />
    </div>
  )
}
```

### Entregable Etapa 5
- ✅ Dashboard con KPIs en tiempo real
- ✅ 7 páginas: Dashboard, Contactos, Pipeline, Campañas, Chat, Analytics, Config
- ✅ Gráficas automáticas (Recharts)
- ✅ Configuración completa desde UI
- ✅ **UTILIZABLE:** Panel visual para monitorear todo

### Test de la Etapa 5
```bash
cd frontend && npm run dev
# Abrir http://localhost:3000
# Verificar KPIs se actualizan
# Verificar gráficas renderizan
# Verificar configuración se guarda
```

---

## ETAPA 6: AUTONOMÍA (Días 23-28)

### Objetivo
Sistema 100% autónomo que funciona sin intervención.

### Día 23-24: Orchestrator Central
```typescript
// src/brain/orchestrator.ts
export class Orchestrator {
  async start(): Promise<void> {
    // 1. Conectar WhatsApp
    await this.whatsapp.connect()
    
    // 2. Iniciar motor de auto-respuesta
    this.autoReply.start()
    
    // 3. Iniciar scheduler de campañas
    this.campaignScheduler.start()
    
    // 4. Iniciar checker de follow-ups
    this.followUpChecker.start()
    
    // 5. Iniciar analytics collector
    this.analytics.start()
    
    // 6. Iniciar anti-ban monitor
    this.antiBanMonitor.start()
    
    console.log('🚀 MejoraWS autónomo iniciado')
  }
}
```

### Día 25: Campaign Generator Autónomo
```typescript
// src/brain/auto-campaign.ts
export class AutoCampaignGenerator {
  async generateWeekly(): Promise<void> {
    // 1. Analizar qué productos tuvieron más engagement
    const topProducts = await this.getTopProducts()
    
    // 2. Generar mensaje con IA
    const message = await this.generateMessage(topProducts[0])
    
    // 3. Seleccionar mejor horario
    const bestTime = await this.getBestSendTime()
    
    // 4. Crear campaña
    await this.campaignManager.create({
      name: `Auto - ${new Date().toISOString().split('T')[0]}`,
      template: message,
      schedule: bestTime,
      audience: { tags: ['lead-activo'], minScore: 50 }
    })
  }
}
```

### Día 26: Pipeline AI Auto-Movimiento
```typescript
// src/brain/pipeline-ai.ts
export class PipelineAI {
  async evaluateConversation(contactId: string, messages: Message[]): Promise<void> {
    // Analizar sentimiento y intención
    const analysis = await this.analyzeConversation(messages)
    
    // Determinar si hay que mover el deal
    const deal = await this.dealManager.getActiveDeal(contactId)
    if (!deal) return
    
    const nextStage = this.calculateStage(deal.stage, analysis)
    if (nextStage !== deal.stage) {
      await this.dealManager.moveStage(deal.id, nextStage)
      
      // Programar follow-up si es necesario
      if (nextStage === 'interesado') {
        await this.followUp.schedule(deal.id, 24)
      }
    }
  }
}
```

### Día 27: Analytics Automáticos
```typescript
// src/analytics/collector.ts
export class AnalyticsCollector {
  async collectDaily(): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const stats = await prisma.message.groupBy({
      by: ['status'],
      where: { createdAt: { gte: today } },
      _count: true
    })
    
    await prisma.analytics.upsert({
      where: { date: today },
      create: { date: today, ...this.formatStats(stats) },
      update: this.formatStats(stats)
    })
  }
}
```

### Día 28: Testing + Polish
```typescript
// tests/integration.test.ts
describe('MejoraWS Integration', () => {
  test('WhatsApp connection', async () => { ... })
  test('Auto-reply responds to messages', async () => { ... })
  test('Campaign sends with anti-ban', async () => { ... })
  test('Pipeline auto-moves on intent', async () => { ... })
  test('Dashboard shows real-time KPIs', async () => { ... })
})
```

### Entregable Etapa 6
- ✅ Orchestrator que coordina todos los módulos
- ✅ Campañas generadas automáticamente cada semana
- ✅ Pipeline se mueve solo según conversaciones
- ✅ Analytics se recopilan automáticamente
- ✅ **UTILIZABLE:** Sistema 100% autónomo, solo mirás el dashboard

### Test Final
```bash
# Iniciar sistema completo
npx ts-node src/server.ts

# El sistema debería:
# 1. Conectar WhatsApp automáticamente
# 2. Responder a mensajes entrantes
# 3. Generar campaña semanal
# 4. Mover deals en el pipeline
# 5. Mostrar KPIs en el dashboard
# 6. Todo sin intervención manual
```

---

## RESUMEN DE ENTREGABLES POR ETAPA

| Etapa | Días | Entregable | Se puede usar para... |
|-------|------|-----------|----------------------|
| 1 | 1-3 | WhatsApp + envío/recepción | Enviar mensajes programados |
| 2 | 4-7 | Bot IA auto-reply | Tu WhatsApp responde solo |
| 3 | 8-12 | CRM + importador | Gestionar contactos y deals |
| 4 | 13-17 | Campañas automáticas | Enviar marketing masivo |
| 5 | 18-22 | Dashboard visual | Monitorear todo en tiempo real |
| 6 | 23-28 | Sistema autónomo | Cero intervención manual |

## CRÍTICO: QUÉ NO PUEDE ESPERAR

| Prioridad | Módulo | Razón |
|-----------|--------|-------|
| 🔴 1 | Anti-ban | Sin esto, te bloquean en días |
| 🔴 2 | WhatsApp connection | Sin esto, nada funciona |
| 🔴 3 | Auto-reply | El valor principal del producto |
| 🟠 4 | CRM básico | Necesitás saber quién es quién |
| 🟠 5 | Importador | Sin contactos, no hay negocio |
| 🟡 6 | Campañas | Marketing es secundario al bot |
| 🟡 7 | Dashboard | Podés usar terminal al principio |
| 🟢 8 | Autonomía total | El lujo de no hacer nada |

---

## RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Bloqueo de WhatsApp | Media | Crítico | 6 capas anti-ban + warm-up 14d |
| Groq rate limit | Baja | Alto | Ollama como backup local |
| Baileys breaking changes | Media | Medio | Fijar versión, tests |
| SQLite performance | Baja | Bajo | Suficiente para <100k contactos |
| Pérdida de sesión | Media | Alto | Auto-backup de sesión |

---

*Plan generado: 27 abril 2026*
*4 semanas · 6 etapas · Resultados utilizables en cada una*
