# 📚 DOCUMENTACIÓN CONSOLIDADA — MejoraWS

> **Trigger:** Cuando digas **"documentar"**, este archivo se actualiza con los trabajos realizados.
> **Ubicación:** Todos los documentos en `Documents/`
> **Última actualización:** 27 abril 2026

---

## ÍNDICE

1. [Visión y Filosofía](#1-visión-y-filosofía)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Módulos Autónomos](#3-módulos-autónomos)
4. [Stack Técnico](#4-stack-técnico)
5. [Modelo de Datos](#5-modelo-de-datos)
6. [Parámetros del Admin](#6-parámetros-del-admin)
7. [Anti-Ban System](#7-anti-ban-system)
8. [Flujo Autónomo](#8-flujo-autónomo)
9. [Seguridad y Cumplimiento](#9-seguridad-y-cumplimiento)
10. [Evaluación por Áreas (36 Roles)](#10-evaluación-por-áreas)
11. [Plan de Desarrollo](#11-plan-de-desarrollo)
12. [Registro de Avances](#12-registro-de-avances)

---

## 1. Visión y Filosofía

### Qué es
MejoraWS es un **CRM WhatsApp 100% autónomo con IA** donde el administrador solo define parámetros y la IA ejecuta todo: responde como humano, crea campañas, gestiona pipeline y reporta KPIs.

### Filosofía
```
Admin configura → IA ejecuta → Admin recibe resultados
```

### Promesa de valor
- **$0 de costo** (Groq gratis + Ollama local + SQLite)
- **0 horas/día** de operación manual
- **6 capas anti-ban** para protección del número
- **Autonomía total** con supervisión humana mínima

### Repositorio
| Repo | URL | Estado |
|------|-----|--------|
| Documentación | https://github.com/pabloeckert/MejoraWS | Este repo |
| Importación | https://github.com/pabloeckert/MejoraContactos | Producción v10.0, 174 tests |

---

## 2. Arquitectura del Sistema

### Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                       │
│         Next.js 14 + TailwindCSS + shadcn/ui                │
│  Dashboard │ CRM │ Import │ Marketing │ Analytics │ Config  │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API + WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA DE NEGOCIO                            │
│              Express + TypeScript                             │
│  Contacts │ Deals │ Campaigns │ Bot │ Analytics │ Config    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA CEREBRO IA                            │
│          Orchestrator + Groq API + Ollama                    │
│  Auto-Reply │ Campaign Gen │ Pipeline AI │ Content Creator   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA ANTI-BAN                              │
│              baileys-antiban + Custom                        │
│  Template Rot │ Warmup │ Gaussian │ Typing │ Fail Detect    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA WHATSAPP                              │
│              Baileys (multi-device)                           │
│  Client │ Sender │ Receiver │ Session Manager               │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA DE DATOS                              │
│              SQLite + Prisma ORM                              │
│  contacts │ deals │ campaigns │ activities │ bot_memory      │
│  templates │ reputation │ analytics │ knowledge_base         │
└─────────────────────────────────────────────────────────────┘
```

### Componentes Principales

| Componente | Tecnología | Responsabilidad |
|-----------|-----------|-----------------|
| **Motor Central** | Node.js + Express | Orquestación general |
| **Cerebro IA** | Groq + Ollama | Generación de respuestas, campañas, decisiones |
| **Anti-Ban** | baileys-antiban | Protección del número WhatsApp |
| **WhatsApp** | Baileys | Conexión multi-device |
| **Datos** | SQLite + Prisma | Persistencia local |
| **Frontend** | Next.js | Dashboard administrativo |
| **Cola** | Bull + better-sqlite3 | Queue de envíos |
| **Embeddings** | nomic-embed-text | Búsqueda semántica RAG |

### Flujo de Datos

```
Mensaje entrante → Receiver → Anti-Ban Check → Brain IA → Auto-Reply → Sender → WhatsApp
                                                                      ↓
                                                              CRM Update → DB
                                                                      ↓
                                                              Analytics → Dashboard
```

---

## 3. Módulos Autónomos

### Módulo 0: 📥 Importador de Contactos (MejoraContactos)

**Fuente:** Integración con [pabloeckert/MejoraContactos](https://github.com/pabloeckert/MejoraContactos)

**Pipeline:**
1. Auto-detección de columnas (ES/EN)
2. Limpieza determinística (80%+)
3. Validación IA con scoring 0-100
4. Deduplicación (exacto + Jaro-Winkler)
5. Detección WhatsApp E.164
6. Tags automáticos por fuente/país/calidad

**Formatos soportados:** CSV, Excel (.xlsx), VCF (vCard), JSON, Google Contacts

**Integración:**
```javascript
// Opción A: módulo npm (recomendado)
import { ContactPipeline } from '@mejora/contactos';

// Opción B: API REST
const clean = await fetch('https://util.mejoraok.com/mejoracontactos/api/clean', { method: 'POST', body: formData });

// Opción C: Copiar src/lib/ directamente
```

---

### Módulo 1: 🤖 Auto-Reply Engine

**Función:** Responde TODOS los mensajes entrantes como un humano.

**Componentes:**
- `auto-reply.ts` — Motor principal
- `intention-detector.ts` — Clasificación de intención
- `context-manager.ts` — Historial + knowledge base
- `response-generator.ts` — Generación con Groq/Ollama
- `escalation-handler.ts` — Escalamiento a humano

**Intenciones detectadas:**
- CONSULTA (pregunta sobre producto/servicio)
- COMPRA (intención de adquirir)
- QUEJA (insatisfacción)
- SALUDO (mensaje casual)
- SOPORTE (necesita ayuda técnica)
- PRECIO (pregunta por valor)

**Configuración del admin:**
```json
{
  "nombre_bot": "María",
  "tono": "profesional-cercano",
  "horario": "8:00-20:00",
  "escalamiento": {
    "palabras_clave": ["hablar con alguien", "agente", "urgente"],
    "max_intercambios": 3,
    "sentimiento_negativo": true
  }
}
```

---

### Módulo 2: 📣 Campaign Generator

**Función:** Crea, programa y envía campañas sin intervención manual.

**Componentes:**
- `campaign-generator.ts` — Motor de generación
- `template-engine.ts` — {{variables}} + spintax
- `scheduler.ts` — Programación inteligente
- `segmenter.ts` — Segmentación automática
- `queue-manager.ts` — Cola FIFO con rate limiting

**Flujo:**
1. Admin define objetivo + producto + audiencia
2. IA genera 5-10 variaciones del mensaje
3. Personaliza con datos del contacto
4. Selecciona mejor horario según engagement
5. Aplica anti-ban (6 capas)
6. Envía en lotes con warm-up
7. Trackea: enviado → entregado → leído → respondió
8. Ajusta estrategia según resultados

---

### Módulo 3: 📊 CRM Pipeline AI

**Función:** Gestiona contactos, deals y pipeline automáticamente.

**Etapas del pipeline:**
```
nuevo → contactado → interesado → propuesta → negociación → cerrado-ganado
                                                           → cerrado-perdido
```

**Reglas de auto-movimiento:**
| Desde | Hacia | Trigger |
|-------|-------|---------|
| nuevo | contactado | Bot envía primer mensaje |
| contactado | interesado | Contacto responde positivamente |
| interesado | propuesta | IA detecta intención de compra |
| propuesta | negociación | Contacto pregunta precio/condiciones |
| negociación | cerrado-ganado | Contacto confirma compra |

**Follow-up automático:** Si no responde en 48h → mensaje amigable.

---

### Módulo 4: 🛡️ Anti-Ban Guardian

**Las 6 capas:**

| Capa | Descripción | Implementación |
|------|-------------|----------------|
| 1. Template Rotation | 3-5 variaciones por mensaje, spintax | `template-rotator.ts` |
| 2. Volume Control | Warm-up 14 días (10→200 msg/día) | `warmup.ts` |
| 3. Timing Humanization | Gaussian jitter 8-15s, pausa cada 10 | `rate-limiter.ts` |
| 4. Behavior Simulation | Typing indicator, idle actions | `typing-sim.ts` |
| 5. Failure Detection | Auto-stop 5 fallos o >30% rate | `failure-detector.ts` |
| 6. Contact Reputation | Skip bloqueados, no re-enviar <7d | `reputation.ts` |

**Warm-up schedule:**
```
Día 1-3:   10 msg/día
Día 4-7:   20 msg/día
Día 8-10:  50 msg/día
Día 11-14: 100 msg/día
Día 15+:   200 msg/día (máximo)
```

---

### Módulo 5: 📈 Analytics & Reporting

**KPIs en tiempo real:**
- Mensajes enviados/entregados/leídos/respondidos
- Tasa de apertura y respuesta
- Conversión por campaña
- Pipeline funnel
- Sentimiento de conversaciones
- Salud de sesión WhatsApp
- Estado anti-ban

**Gráficas automáticas:**
- Mensajes por día (línea)
- Apertura por campaña (barra)
- Pipeline funnel (embudo)
- Mejores horarios (heatmap)
- Sentimiento (pie)
- Crecimiento contactos (área)
- ROI por campaña (barra)

---

## 4. Stack Técnico

### Stack Final ($0)

| Capa | Tecnología | Costo | Notas |
|------|-----------|-------|-------|
| **Backend** | Node.js 20 + Express + TypeScript | $0 | Runtime local |
| **WhatsApp** | Baileys + baileys-antiban | $0 | npm, multi-device |
| **LLM primario** | Groq API free tier | $0 | qwen-2.5-32b, ~30 req/min |
| **LLM backup** | Ollama + Llama 3.1 8B | $0 | Local, sin internet |
| **Embeddings** | Ollama + nomic-embed-text | $0 | Para RAG |
| **Vector store** | sqlite-vss | $0 | Búsqueda semántica |
| **Database** | SQLite + Prisma | $0 | Local, sin servidor |
| **Frontend** | Next.js 14 + TailwindCSS + shadcn/ui | $0 | Stack probado |
| **Charts** | Recharts | $0 | npm |
| **Cola** | Bull + better-sqlite3 | $0 | Queue de envíos |
| **Deploy** | Tu PC (dev) / Hetzner $4.50/mes (prod) | $0-54/año | |

### Dependencias Principales

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.x",
    "baileys-antiban": "^1.x",
    "@prisma/client": "^5.x",
    "express": "^4.x",
    "next": "^14.x",
    "react": "^18.x",
    "recharts": "^2.x",
    "groq-sdk": "^0.x",
    "bull": "^4.x",
    "better-sqlite3": "^11.x",
    "xlsx": "^0.x",
    "papaparse": "^5.x"
  }
}
```

---

## 5. Modelo de Datos

### Schema Prisma

```prisma
model Contact {
  id            String    @id @default(cuid())
  name          String?
  phone         String    @unique
  email         String?
  whatsapp      Boolean   @default(false)
  tags          String    @default("[]")  // JSON array
  score         Int       @default(0)     // 0-100
  source        String?
  consentMarketing Boolean @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deals         Deal[]
  activities    Activity[]
  messages      Message[]
}

model Deal {
  id            String    @id @default(cuid())
  contactId     String
  contact       Contact   @relation(fields: [contactId], references: [id])
  stage         String    @default("nuevo")
  value         Float?
  probability   Int       @default(0)
  notes         String?
  nextFollowUp  DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Campaign {
  id            String    @id @default(cuid())
  name          String
  objective     String
  audience      String    // JSON filter
  template      String
  variations    String    @default("[]") // JSON
  status        String    @default("draft")
  scheduledAt   DateTime?
  sentCount     Int       @default(0)
  deliveredCount Int      @default(0)
  readCount     Int       @default(0)
  replyCount    Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Message {
  id            String    @id @default(cuid())
  contactId     String
  contact       Contact   @relation(fields: [contactId], references: [id])
  direction     String    // "inbound" | "outbound"
  content       String
  status        String    @default("sent")
  campaignId    String?
  createdAt     DateTime  @default(now())
}

model Activity {
  id            String    @id @default(cuid())
  contactId     String
  contact       Contact   @relation(fields: [contactId], references: [id])
  type          String    // "message", "call", "note", "stage_change"
  description   String
  metadata      String?   // JSON
  createdAt     DateTime  @default(now())
}

model BotMemory {
  id            String    @id @default(cuid())
  contactId     String    @unique
  context       String    @default("{}") // JSON
  lastInteraction DateTime?
  sentiment     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Template {
  id            String    @id @default(cuid())
  name          String
  category      String
  content       String
  variables     String    @default("[]") // JSON
  spintax       String?
  createdAt     DateTime  @default(now())
}

model Reputation {
  id            String    @id @default(cuid())
  contactId     String    @unique
  score         Int       @default(100)
  blocked       Boolean   @default(false)
  lastMessageAt DateTime?
  failCount     Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model KnowledgeBase {
  id            String    @id @default(cuid())
  category      String
  content       String
  embedding     String?   // JSON vector
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Analytics {
  id            String    @id @default(cuid())
  date          DateTime  @unique
  sent          Int       @default(0)
  delivered     Int       @default(0)
  read          Int       @default(0)
  replied       Int       @default(0)
  dealsCreated  Int       @default(0)
  dealsClosed   Int       @default(0)
  revenue       Float     @default(0)
  createdAt     DateTime  @default(now())
}

model Config {
  id            String    @id @default(cuid())
  key           String    @unique
  value         String    // JSON
  updatedAt     DateTime  @updatedAt
}
```

---

## 6. Parámetros del Admin

### 6.1 Configuración General
```json
{
  "negocio": "Mi Tienda Online",
  "descripcion": "Venta de productos digitales",
  "horario_atencion": "8:00-20:00",
  "zona_horaria": "America/Buenos_Aires",
  "moneda": "ARS"
}
```

### 6.2 Knowledge Base
```json
{
  "productos": [
    {"nombre": "Curso Marketing", "precio": "$5000", "duracion": "8 semanas"},
    {"nombre": "Mentoría 1:1", "precio": "$15000/mes", "sesiones": 4}
  ],
  "faq": [
    {"q": "¿Cómo pago?", "a": "Transferencia, Mercado Pago o efectivo"},
    {"q": "¿Hay garantía?", "a": "Sí, 30 días de devolución"}
  ],
  "politicas": {
    "devolucion": "30 días sin preguntas",
    "envio": "Digital, acceso inmediato"
  }
}
```

### 6.3 Reglas del Bot
```json
{
  "nombre_bot": "María",
  "personalidad": "Profesional, cercana, entusiasta",
  "reglas_especiales": {
    "si_preguntan_precio": "Precio + valor agregado",
    "si_dicen_caro": "Descuento o plan de pago",
    "si_no_responde_48h": "Follow-up amigable",
    "si_queja": "Escalar a humano inmediatamente"
  }
}
```

### 6.4 Reglas de Marketing
```json
{
  "frecuencia_campañas": "2 por semana",
  "max_mensajes_dia": 50,
  "segmentacion_auto": true,
  "warmup_dias": 14,
  "anti_ban_modo": "conservador"
}
```

### 6.5 Reglas del Pipeline
```json
{
  "auto_mover_deals": true,
  "followup_auto": true,
  "priorizar_por": "probabilidad_conversion"
}
```

---

## 7. Anti-Ban System

### 6 Capas Detalladas

#### Capa 1: Template Rotation
- 3-5 variaciones por mensaje
- Spintax: `{Hola|Buenos días|Qué tal}`
- Sinónimos automáticos
- Nunca enviar el mismo texto dos veces seguidas

#### Capa 2: Volume Control
```
Día 1:    10 msg
Día 2:    12 msg
Día 3:    15 msg
Día 4:    18 msg
Día 5:    22 msg
Día 6:    28 msg
Día 7:    35 msg
Día 8:    45 msg
Día 9:    55 msg
Día 10:   70 msg
Día 11:   85 msg
Día 12:   100 msg
Día 13:   120 msg
Día 14:   150 msg
Día 15+:  200 msg (máximo)
```

#### Capa 3: Timing Humanization
- Delay entre mensajes: 8-15 segundos (distribución Gaussiana)
- Pausa cada 10 mensajes: 2-5 minutos
- Horario laboral: 8:00-20:00
- Sin envíos fines de semana (opcional)

#### Capa 4: Behavior Simulation
- Typing indicator antes de cada envío (1-3 segundos)
- "Escribiendo..." visible para el receptor
- Duración variable según longitud del mensaje
- Acciones idle aleatorias (leer status, etc.)

#### Capa 5: Failure Detection
- Auto-stop si 5 fallos consecutivos
- Auto-stop si tasa de fallo >30%
- Alerta al admin
- Backoff exponencial en reconexión

#### Capa 6: Contact Reputation
- Score 0-100 por contacto
- Skip si score <20
- No re-enviar a quien bloqueó (<7 días)
- Incrementar score con interacciones positivas

---

## 8. Flujo Autónomo

### Día Normal del Admin (solo mira)

```
08:00  Sistema se conecta automáticamente
       Anti-ban: warm-up activo (día 5/14, límite 25 msg)

08:15  Llega mensaje de "Pedro" preguntando por un producto
       → Bot detecta intención: CONSULTA
       → Recupera info de la knowledge base
       → Genera respuesta humana con delay de 7s
       → Registra en CRM, mueve deal: nuevo → contactado

09:00  IA genera campaña semanal automáticamente
       → 5 variaciones del mensaje
       → Selecciona 20 contactos (tag: "lead-activo")
       → Programa envío: 10:00-11:00

10:00  Campaña se envía con anti-ban activo
       → 20 mensajes, delay 12-18s entre cada uno
       → Tracking: 18 entregados, 2 fallidos

10:30  "Laura" responde "Me interesa"
       → Bot detecta intención: INTERÉS
       → Responde con detalles + precio
       → Mueve deal: contactado → interesado
       → Agenda follow-up en 24h

14:00  Bot responde a 5 consultas más
       → 3 productos, 1 horarios, 1 queja
       → Queja escalada a humano automáticamente

18:00  Admin abre dashboard
       → Ve: 47 enviados, 12 respuestas, 1 venta
       → Aprueba siguiente paso para "Laura"

20:00  Sistema pausa envíos
       → Backup automático
       → Log del día guardado
```

---

## 9. Seguridad y Cumplimiento

### Protección de Datos
- Todos los datos se almacenan localmente (SQLite)
- No se envían datos a terceros (excepto Groq API para LLM)
- Ollama como backup local (sin datos saliendo)
- Sesión WhatsApp encriptada localmente

### GDPR Consideraciones
- `consent_marketing` en cada contacto
- Opción de eliminación de datos
- Exportación de datos del contacto
- Registro de consentimiento

### Backup
- Backup automático diario de SQLite
- Backup de sesión WhatsApp
- Backup de knowledge base
- Retención configurable (30/60/90 días)

---

## 10. Evaluación por Áreas (36 Roles)

### Área Técnica

| Rol | Evaluación | Prioridad | Notas |
|-----|-----------|-----------|-------|
| **Software Architect** | ⭐⭐⭐⭐⭐ | Crítica | Arquitectura modular limpia, 6 capas desacopladas, patrón plugin. Facilita testing y mantenimiento. |
| **Cloud Architect** | ⭐⭐⭐⭐ | Alta | Local-first es correcto para MVP. Futuro: Docker + Hetzner VPS ($4.50/mes). Evitar vendor lock-in. |
| **Backend Developer** | ⭐⭐⭐⭐⭐ | Crítica | Node.js + TypeScript + Express + Prisma = stack probado. APIs REST claras. |
| **Frontend Developer** | ⭐⭐⭐⭐ | Alta | Next.js + shadcn/ui permite desarrollo rápido. WebSocket para real-time. |
| **iOS Developer** | ⭐⭐ | Baja | No aplica para MVP. Futuro: PWA o React Native wrapper. |
| **Android Developer** | ⭐⭐ | Baja | No aplica para MVP. PWA como opción multi-plataforma. |
| **DevOps Engineer** | ⭐⭐⭐ | Media | Docker Compose para prod. CI/CD con GitHub Actions. Monitoreo básico. |
| **SRE** | ⭐⭐⭐ | Media | Health checks, auto-reconnect, session recovery. Alertas WhatsApp status. |
| **Cybersecurity Architect** | ⭐⭐⭐⭐ | Alta | Anti-ban es security-critical. Sesión WhatsApp encriptada. Sin datos en tránsito (local). |
| **Data Engineer** | ⭐⭐⭐ | Media | SQLite suficiente para MVP. Pipeline ETL para analytics. Futuro: PostgreSQL si escala. |
| **ML Engineer** | ⭐⭐⭐⭐ | Alta | RAG con embeddings, intención detection, sentimiento. Groq + Ollama cubren necesidades. |
| **QA Automation** | ⭐⭐⭐⭐ | Alta | Tests unitarios + integración. Mock Baileys para CI. 174 tests en MejoraContactos como referencia. |
| **DBA** | ⭐⭐⭐ | Media | SQLite + Prisma es simple. Índices en phone, email. Futuro: migrar a PostgreSQL si >100k contactos. |

### Área de Producto y Gestión

| Rol | Evaluación | Prioridad | Notas |
|-----|-----------|-----------|-------|
| **Product Manager** | ⭐⭐⭐⭐⭐ | Crítica | MVP claro, features priorizadas, roadmap de 6 sprints. ROI inmediato. |
| **Product Owner** | ⭐⭐⭐⭐ | Alta | Backlog definido, criterios de aceptación claros por sprint. |
| **Scrum Master** | ⭐⭐⭐⭐ | Alta | Sprints de 1 semana, daily opcional (proyecto personal). Retrospectivas útiles. |
| **UX Researcher** | ⭐⭐⭐ | Media | El usuario es el admin. Testing con uno mismo. Futuro: onboarding flow. |
| **UX Designer** | ⭐⭐⭐⭐ | Alta | Dashboard intuitivo es clave. Flujo: importar → configurar → operar. |
| **UI Designer** | ⭐⭐⭐⭐ | Alta | shadcn/ui da base sólida. KPIs visuales, pipeline Kanban. |
| **UX Writer** | ⭐⭐⭐ | Media | Copy del bot es crítico. Tono humano, no robótico. Templates variados. |
| **Localization Manager** | ⭐⭐⭐ | Media | ES como base. Multi-idioma futuro con i18n. Spintax en español. |
| **Delivery Manager** | ⭐⭐⭐⭐ | Alta | Timeline realista (6 semanas). Riesgos identificados. |

### Área Comercial y de Crecimiento

| Rol | Evaluación | Prioridad | Notas |
|-----|-----------|-----------|-------|
| **Growth Manager** | ⭐⭐⭐⭐ | Alta | El producto ES growth: campañas automáticas, pipeline auto, KPIs. |
| **ASO Specialist** | ⭐ | No aplica | No es app móvil. PWA futuro. |
| **Performance Marketing** | ⭐⭐⭐⭐ | Alta | Campañas con A/B testing implícito (variaciones). ROI tracking. |
| **SEO Specialist** | ⭐ | No aplica | Producto interno, no público. |
| **Business Development** | ⭐⭐⭐ | Media | Potencial de venta a terceros después de MVP. |
| **Account Manager** | ⭐⭐⭐ | Media | CRM pipeline = account management automatizado. |
| **Content Manager** | ⭐⭐⭐⭐ | Alta | Knowledge base = content. Templates = contenido marketing. |
| **Community Manager** | ⭐⭐⭐ | Media | Bot responde en WhatsApp = community management automático. |

### Área de Operaciones, Legal y Análisis

| Rol | Evaluación | Prioridad | Notas |
|-----|-----------|-----------|-------|
| **BI Analyst** | ⭐⭐⭐⭐ | Alta | Dashboard con KPIs, gráficas, reportes automáticos. |
| **Data Scientist** | ⭐⭐⭐ | Media | Análisis de sentimiento, predicción de conversión. Futuro: ML pipeline. |
| **Legal & Compliance** | ⭐⭐⭐⭐ | Alta | GDPR: consent_marketing, eliminación, exportación. Anti-spam compliance. |
| **DPO** | ⭐⭐⭐⭐ | Alta | Datos locales = bajo riesgo. Groq API: revisar DPA. Consentimiento explícito. |
| **Customer Success** | ⭐⭐⭐ | Media | Follow-ups automáticos = customer success proactivo. |
| **Support T1/T2/T3** | ⭐⭐⭐⭐ | Alta | Bot = T1 automático. Escalamiento a humano = T2. Admin = T3. |

### Resumen de Evaluación

| Categoría | Score Promedio | Roles Críticos |
|-----------|---------------|----------------|
| Área Técnica | ⭐⭐⭐⭐ (3.8) | Software Architect, Backend Dev, QA |
| Producto y Gestión | ⭐⭐⭐⭐ (3.7) | Product Manager, Scrum Master |
| Comercial y Crecimiento | ⭐⭐⭐ (2.8) | Growth Manager, Performance Marketing |
| Operaciones y Legal | ⭐⭐⭐⭐ (3.4) | BI Analyst, Legal/Compliance, DPO |

---

## 11. Plan de Desarrollo

### Sprint 1 (Semana 1): Foundation
```
[ ] Setup proyecto (Node.js + TypeScript + Prisma + SQLite)
[ ] Conectar WhatsApp (Baileys + baileys-antiban)
[ ] Anti-ban básico (Gaussian jitter + warmup)
[ ] Recibir y loggear mensajes entrantes
[ ] Enviar mensajes de prueba
```
**Entregable:** App que se conecta a WhatsApp, recibe/envía mensajes con protección básica.

### Sprint 2 (Semana 2): Brain
```
[ ] Integrar Groq API (gratis)
[ ] Motor de auto-respuesta básico
[ ] Sistema de prompts con personalidad
[ ] Detección de intención
[ ] Delay humano + typing indicator
```
**Entregable:** Bot que responde automáticamente como un humano.

### Sprint 3 (Semana 3): CRM + Importación
```
[ ] Integrar MejoraContactos como módulo de importación
[ ] Import CSV/Excel/VCF/JSON con auto-detección
[ ] Schema completo (contacts, deals, activities)
[ ] CRUD contactos + tags
[ ] Pipeline Kanban
[ ] Auto-registro de actividades
[ ] Follow-up automático
```
**Entregable:** CRM funcional con importación masiva de contactos.

### Sprint 4 (Semana 4): Marketing
```
[ ] Motor de campañas
[ ] Template engine ({{var}} + spintax)
[ ] Cola de envío con anti-ban
[ ] Tracking de estados
[ ] Segmentación automática
```
**Entregable:** Sistema de campañas automáticas con protección anti-ban.

### Sprint 5 (Semana 5): Dashboard
```
[ ] Next.js dashboard
[ ] KPIs en tiempo real
[ ] Gráficas (Recharts)
[ ] Configuración de parámetros
[ ] Knowledge base upload
```
**Entregable:** Dashboard visual con KPIs y configuración completa.

### Sprint 6 (Semana 6): Autonomous
```
[ ] Orchestrator (coordinador central)
[ ] Campaign generator autónomo
[ ] Pipeline AI auto-mover deals
[ ] Analytics automáticos
[ ] Testing + polish
```
**Entregable:** Sistema 100% autónomo, listo para operación diaria.

---

## 12. Registro de Avances

> **Sección actualizada con cada "documentar"**

### Estado General

| Campo | Valor |
|-------|-------|
| **Nombre** | MejoraWS |
| **Fase** | Documentación / Pre-desarrollo |
| **Sprint** | No iniciado |
| **Commits** | 9 |
| **Documentos** | 4 (este + PLAN + PROMPT + README) |

### Timeline de Documentación

| Fecha | Hora | Acción | Detalle |
|-------|------|--------|---------|
| 26/04 | 23:46 | Análisis inicial | 17 repos originales |
| 26/04 | 23:55 | +37 bulk senders | 54 repos total |
| 27/04 | 00:01 | +10 anti-ban/gateways | 64 repos, subido a GitHub |
| 27/04 | 00:03 | Consolidación | 9 docs → 1 plan maestro, costo $0 |
| 27/04 | 00:08 | +14 repos nuevos | 78 repos, Groq AI, n8n, warm-up 14d |
| 27/04 | 00:16 | +10 repos + propuesta | 89 repos, 5 módulos autónomos |
| 27/04 | 00:22 | +MejoraContactos | Módulo 0 importación, 6 módulos total |
| 27/04 | 00:25 | **documentar** | Registro de avances actualizado |
| 27/04 | 00:29 | PROMPT.md | Prompt de continuidad de sesión creado |
| 27/04 | 21:36 | Análisis completo | 36 roles evaluados, doc consolidada, plan etapas |

### Decisiones Técnicas

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| WhatsApp | Baileys + baileys-antiban | Más ligero que whatsapp-web.js |
| LLM primario | Groq API free tier | Gratis, rápido, qwen-2.5-32b |
| LLM backup | Ollama + Llama 3.1 8B | Local, sin internet, $0 |
| Database | SQLite + Prisma | $0, sin servidor |
| Frontend | Next.js + Tailwind + shadcn/ui | Stack probado |
| Anti-ban | 6 capas + warm-up 14 días | Estándar ecosistema |
| Importación | MejoraContactos (propio) | 174 tests, producción |
| Costo | $0 dev / $54/año prod | Sin inversión |

### Pendientes (Backlog)

| Prioridad | Tarea | Estado |
|-----------|-------|--------|
| 🔴 Alta | Sprint 1: Setup + WhatsApp + Anti-ban | ⏳ No iniciado |
| 🔴 Alta | Sprint 2: Motor auto-respuesta IA | ⏳ No iniciado |
| 🟠 Media | Sprint 3: CRM + Importación | ⏳ No iniciado |
| 🟠 Media | Sprint 4: Marketing + Campaigns | ⏳ No iniciado |
| 🟡 Baja | Sprint 5: Dashboard + KPIs | ⏳ No iniciado |
| 🟡 Baja | Sprint 6: Autonomous orchestrator | ⏳ No iniciado |

---

*Última actualización: 27 abril 2026 21:36 GMT+8*
*89+ repos analizados · 36 roles evaluados · 6 módulos · Costo $0 · Listo para Sprint 1*
