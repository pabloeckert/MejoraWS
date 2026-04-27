# 📚 DOCUMENTACIÓN CONSOLIDADA — MejoraWS

> **Trigger:** Cuando digas **"documentar"**, este archivo se actualiza con los trabajos realizados.
> **Última actualización:** 28 abril 2026

---

## ÍNDICE

1. [Visión y Filosofía](#1-visión-y-filosofía)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Módulos Autónomos](#3-módulos-autónomos)
4. [Stack Técnico](#4-stack-técnico)
5. [Modelo de Datos](#5-modelo-de-datos)
6. [Parámetros del Admin](#6-parámetros-del-admin)
7. [Anti-Ban System](#7-anti-ban-system)
8. [WhatsApp Business — Sin Meta API](#8-whatsapp-business--sin-meta-api)
9. [Flujo Autónomo](#9-flujo-autónomo)
10. [Seguridad y Cumplimiento](#10-seguridad-y-cumplimiento)
11. [Evaluación por Áreas (36 Roles)](#11-evaluación-por-áreas)
12. [Plan por Etapas (28 días)](#12-plan-por-etapas)
13. [Proyecto Desktop (MCC)](#13-proyecto-desktop-mcc)
14. [Registro de Avances](#14-registro-de-avances)

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
- **Sin Meta API** — usa Baileys (WhatsApp Web directo)

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
│              Baileys (multi-device) — SIN Meta API           │
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
| **WhatsApp** | Baileys | Conexión multi-device (SIN Meta API) |
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
| **WhatsApp** | Baileys + baileys-antiban | $0 | **SIN Meta API**, multi-device |
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

## 8. WhatsApp Business — Sin Meta API

### Decisión de diseño: Baileys, NO Meta Cloud API

**MejoraWS NO usa la API oficial de Meta/WhatsApp Business.** Usa Baileys, que es una librería open-source que se conecta directamente a WhatsApp Web.

### ¿Por qué NO la Meta Cloud API?

| Aspecto | Meta Cloud API | Baileys (nuestra elección) |
|---------|---------------|---------------------------|
| **Costo** | ~$0.05-0.08/msg | $0 |
| **Aprobación** | Requiere verificación Business | No requiere nada |
| **Límites** | Templates pre-aprobados | Sin límites (con anti-ban) |
| **Velocidad** | Dependiente de Meta | Directo, sin intermediarios |
| **Bulk messaging** | Restricciones estrictas | Libre (con protección) |
| **Flexibilidad** | Solo templates aprobados | Cualquier mensaje |
| **Setup** | Complejo (Business Manager, verificación) | Simple (npm install) |

### Cómo funciona Baileys

```
Tu servidor ──→ WhatsApp Web Protocol ──→ Servidores WhatsApp
                    │
                    └── Misma conexión que tu navegador
                        cuando usas web.whatsapp.com
```

**Baileys** se conecta como un dispositivo multi-device más (igual que WhatsApp Web/Desktop). No necesita aprobación de Meta ni pago alguno.

### Protección: baileys-antiban

Para que Baileys no bloquee tu número, usamos **baileys-antiban** que aplica:
- Gaussian jitter en delays
- Warm-up gradual (14 días)
- Typing simulation
- Template rotation
- Volume control
- Reputation tracking

### Limitaciones conocidas

| Limitación | Mitigación |
|-----------|------------|
| Sin API oficial = riesgo de ban | 6 capas anti-ban + warm-up 14 días |
| Requiere sesión activa | Auto-reconnect + session backup |
| Sin webhooks oficiales | Polling + event listeners nativos |
| Un número por instancia | Multi-session futuro |

### Alternativas descartadas

| Alternativa | Por qué no |
|------------|------------|
| **Meta Cloud API** | Costo por mensaje, verificación compleja, templates restrictivos |
| **Twilio WhatsApp** | $0.005/msg + markup, dependiente de Meta |
| **360dialog** | Requiere Business verification, planes de pago |
| **wppconnect** | Menos maduro que Baileys |

---

## 9. Flujo Autónomo

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

## 10. Seguridad y Cumplimiento

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

## 11. Evaluación por Áreas (36 Roles)

### Área Técnica

| Rol | Evaluación | Prioridad | Notas |
|-----|-----------|-----------|-------|
| **Software Architect** | ⭐⭐⭐⭐⭐ | Crítica | Arquitectura modular limpia, 6 capas desacopladas |
| **Cloud Architect** | ⭐⭐⭐⭐ | Alta | Local-first correcto para MVP |
| **Backend Developer** | ⭐⭐⭐⭐⭐ | Crítica | Node.js + TypeScript + Express + Prisma |
| **Frontend Developer** | ⭐⭐⭐⭐ | Alta | Next.js + shadcn/ui permite desarrollo rápido |
| **DevOps Engineer** | ⭐⭐⭐ | Media | Docker Compose para prod |
| **Cybersecurity Architect** | ⭐⭐⭐⭐ | Alta | Anti-ban es security-critical |
| **ML Engineer** | ⭐⭐⭐⭐ | Alta | RAG con embeddings, intención detection |
| **QA Automation** | ⭐⭐⭐⭐ | Alta | Tests unitarios + integración |

### Área de Producto y Gestión

| Rol | Evaluación | Prioridad | Notas |
|-----|-----------|-----------|-------|
| **Product Manager** | ⭐⭐⭐⭐⭐ | Crítica | MVP claro, features priorizadas |
| **UX Designer** | ⭐⭐⭐⭐ | Alta | Dashboard intuitivo es clave |
| **UI Designer** | ⭐⭐⭐⭐ | Alta | shadcn/ui da base sólida |
| **Delivery Manager** | ⭐⭐⭐⭐ | Alta | Timeline realista |

### Área Comercial y de Crecimiento

| Rol | Evaluación | Prioridad | Notas |
|-----|-----------|-----------|-------|
| **Growth Manager** | ⭐⭐⭐⭐ | Alta | El producto ES growth |
| **Performance Marketing** | ⭐⭐⭐⭐ | Alta | Campañas con A/B testing implícito |
| **Content Manager** | ⭐⭐⭐⭐ | Alta | Knowledge base = content |

### Área de Operaciones, Legal y Análisis

| Rol | Evaluación | Prioridad | Notas |
|-----|-----------|-----------|-------|
| **BI Analyst** | ⭐⭐⭐⭐ | Alta | Dashboard con KPIs |
| **Legal & Compliance** | ⭐⭐⭐⭐ | Alta | GDPR compliance |
| **DPO** | ⭐⭐⭐⭐ | Alta | Datos locales = bajo riesgo |

### Resumen de Evaluación

| Categoría | Score Promedio | Roles Críticos |
|-----------|---------------|----------------|
| Área Técnica | ⭐⭐⭐⭐ (3.8) | Software Architect, Backend Dev, QA |
| Producto y Gestión | ⭐⭐⭐⭐ (3.7) | Product Manager, Scrum Master |
| Comercial y Crecimiento | ⭐⭐⭐ (2.8) | Growth Manager, Performance Marketing |
| Operaciones y Legal | ⭐⭐⭐⭐ (3.4) | BI Analyst, Legal/Compliance, DPO |

---

## 12. Plan por Etapas

### Visión General

```
ETAPA 1 (Días 1-3)    → WhatsApp conectado + mensajes manuales
ETAPA 2 (Días 4-7)    → Bot IA que responde solo
ETAPA 3 (Días 8-12)   → CRM con contactos importados
ETAPA 4 (Días 13-17)  → Campañas automáticas
ETAPA 5 (Días 18-22)  → Dashboard visual con KPIs
ETAPA 6 (Días 23-28)  → Sistema 100% autónomo
```

**Total: 28 días (4 semanas)**

---

### ETAPA 1: CONEXIÓN (Días 1-3)

**Objetivo:** Que la app se conecte a WhatsApp y puedas enviar/recibir mensajes desde terminal.

**Día 1: Setup del Proyecto**
```bash
mkdir mejoraws && cd mejoraws
npm init -y
npm install typescript ts-node @types/node --save-dev
npx tsc --init
npm install express @types/express
npm install @prisma/client prisma
npm install @whiskeysockets/baileys
npm install baileys-antiban
npm install better-sqlite3 @types/better-sqlite3
npx prisma init --datasource-provider sqlite
```

**Día 2: Conexión WhatsApp**
```typescript
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'

export async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./data/session')
  const sock = makeWASocket({ auth: state, printQRInTerminal: true })
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', (update) => {
    if (update.connection === 'open') console.log('✅ WhatsApp conectado!')
  })
  return sock
}
```

**Día 3: Envío/Recepción + Anti-ban básico**
```typescript
export function gaussianDelay(mean = 10000, stdDev = 3000): number {
  const u1 = Math.random(), u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return Math.max(5000, Math.round(mean + z * stdDev))
}
```

**Entregable:** App que se conecta a WhatsApp, envía/recibe con protección básica.

---

### ETAPA 2: BOT IA (Días 4-7)

**Objetivo:** El bot responde automáticamente como un humano.

**Día 4:** Integración Groq API
**Día 5:** Motor de auto-respuesta
**Día 6:** Detección de intención + escalamiento
**Día 7:** Personalidad + knowledge base

**Entregable:** Bot que responde automáticamente a TODOS los mensajes.

---

### ETAPA 3: CRM (Días 8-12)

**Objetivo:** Contactos importados, pipeline Kanban, seguimiento automático.

**Día 8:** Schema Prisma completo
**Día 9:** Importador CSV/Excel
**Día 10:** CRUD contactos + tags
**Día 11:** Pipeline Kanban
**Día 12:** Follow-up automático

**Entregable:** CRM funcional con importación masiva.

---

### ETAPA 4: MARKETING (Días 13-17)

**Objetivo:** Campañas automáticas con protección anti-ban.

**Día 13:** Template engine ({{var}} + spintax)
**Día 14:** Cola de envío + anti-ban completo
**Día 15:** Campaign generator
**Día 16:** Segmentación automática
**Día 17:** Tracking de estados

**Entregable:** Sistema de campañas automáticas protegido.

---

### ETAPA 5: DASHBOARD (Días 18-22)

**Objetivo:** Dashboard visual con KPIs, gráficas y configuración.

**Día 18:** Setup Next.js
**Día 19:** Páginas principales (7 vistas)
**Día 20:** KPIs en tiempo real
**Día 21:** Gráficas (Recharts)
**Día 22:** Configuración + knowledge base upload

**Entregable:** Panel visual para monitorear todo.

---

### ETAPA 6: AUTONOMÍA (Días 23-28)

**Objetivo:** Sistema 100% autónomo.

**Día 23-24:** Orchestrator central
**Día 25:** Campaign generator autónomo
**Día 26:** Pipeline AI auto-movimiento
**Día 27:** Analytics automáticos
**Día 28:** Testing + polish

**Entregable:** Sistema 100% autónomo, solo mirás el dashboard.

---

### Resumen de Entregables

| Etapa | Días | Entregable | Se puede usar para... |
|-------|------|-----------|----------------------|
| 1 | 1-3 | WhatsApp + envío/recepción | Enviar mensajes programados |
| 2 | 4-7 | Bot IA auto-reply | Tu WhatsApp responde solo |
| 3 | 8-12 | CRM + importador | Gestionar contactos y deals |
| 4 | 13-17 | Campañas automáticas | Enviar marketing masivo |
| 5 | 18-22 | Dashboard visual | Monitorear todo en tiempo real |
| 6 | 23-28 | Sistema autónomo | Cero intervención manual |

### Prioridades Críticas

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

### Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Bloqueo de WhatsApp | Media | Crítico | 6 capas anti-ban + warm-up 14d |
| Groq rate limit | Baja | Alto | Ollama como backup local |
| Baileys breaking changes | Media | Medio | Fijar versión, tests |
| SQLite performance | Baja | Bajo | Suficiente para <100k contactos |
| Pérdida de sesión | Media | Alto | Auto-backup de sesión |

---

## 13. Proyecto Desktop (MCC)

### MejoraWS Command Center

App desktop personal (Electron + React + TypeScript) que complementa MejoraWS.

**Funcionalidades:**
1. **MejoraWS Manager** — start/stop/monitor sin terminal
2. **AI Chat** — chat directo con Groq/Ollama desde desktop
3. **Notificaciones nativas** — alertas del sistema
4. **Pomodoro Timer** — productividad integrada
5. **Tasks & Notes** — gestión de tareas
6. **System tray** — siempre accesible

**Stack:** Electron 28 + React 18 + TypeScript + TailwindCSS + Framer Motion + Zustand

**Plan de desarrollo:** 17 días en 5 fases

**Costo:** $0 (todo open source)

---

## 14. Registro de Avances

> **Sección actualizada con cada "documentar"**

### Estado General

| Campo | Valor |
|-------|-------|
| **Nombre** | MejoraWS |
| **Fase** | Documentación consolidada / Pre-desarrollo |
| **Sprint** | No iniciado |
| **Commits** | 9 |
| **Documentos** | 1 (este documento maestro) |

### Timeline

| Fecha | Hora | Acción | Detalle |
|-------|------|--------|---------|
| 26/04 | 23:46 | Análisis inicial | 17 repos originales |
| 26/04 | 23:55 | +37 bulk senders | 54 repos total |
| 27/04 | 00:01 | +10 anti-ban/gateways | 64 repos |
| 27/04 | 00:03 | Consolidación | 9 docs → 1 plan maestro |
| 27/04 | 00:08 | +14 repos nuevos | 78 repos |
| 27/04 | 00:16 | +10 repos + propuesta | 89 repos, 5 módulos |
| 27/04 | 00:22 | +MejoraContactos | 6 módulos total |
| 27/04 | 00:25 | **documentar** | Registro actualizado |
| 27/04 | 00:29 | PROMPT.md | Prompt de continuidad |
| 27/04 | 21:36 | Análisis completo | 36 roles evaluados |
| 28/04 | 03:41 | **Consolidación final** | 5 docs → 1 documento maestro optimizado |

### Decisiones Técnicas

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| WhatsApp | Baileys + baileys-antiban | **SIN Meta API**, $0, sin verificación |
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

*89+ repos analizados · 36 roles evaluados · 6 módulos · Costo $0 · Sin Meta API · Listo para Sprint 1*
*Última actualización: 28 abril 2026 03:41 GMT+8*
