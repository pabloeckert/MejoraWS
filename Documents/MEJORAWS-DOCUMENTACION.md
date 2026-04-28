# 📚 DOCUMENTACIÓN CONSOLIDADA — MejoraWS

> **Trigger:** Cuando digas **"documentar"**, este archivo se actualiza automáticamente con los trabajos realizados.
> **Carpeta:** `Documents/` — documentación única del proyecto.
> **Última actualización:** 29 abril 2026, 00:38 GMT+8

---

## ÍNDICE

1. [Visión y Estado Actual](#1-visión-y-estado-actual)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Módulos Implementados](#3-módulos-implementados)
4. [Stack Técnico](#4-stack-técnico)
5. [Modelo de Datos](#5-modelo-de-datos)
6. [API REST — Endpoints](#6-api-rest--endpoints)
7. [CLI — Comandos](#7-cli--comandos)
8. [Anti-Ban System (6 capas)](#8-anti-ban-system-6-capas)
9. [Seguridad y Compliance](#9-seguridad-y-compliance)
10. [Dashboard Web](#10-dashboard-web)
11. [Tests](#11-tests)
12. [Análisis Multidisciplinario (36 Roles)](#12-análisis-multidisciplinario-36-roles)
13. [Plan Optimizado por Etapas](#13-plan-optimizado-por-etapas)
14. [Registro de Avances](#14-registro-de-avances)
15. [Protocolo: "documentar"](#15-protocolo-documentar)

---

## 1. Visión y Estado Actual

### Qué es
MejoraWS es un **CRM WhatsApp 100% autónomo con IA** donde el administrador solo define parámetros y la IA ejecuta todo: responde como humano, gestiona pipeline y reporta KPIs.

### Filosofía
```
Admin configura → IA ejecuta → Admin recibe resultados
```

### Promesa de valor
- **$0 de costo** — Groq gratis + Ollama local + SQLite
- **Sin Meta API** — usa Baileys (WhatsApp Web directo)
- **Anti-ban** de 6 capas con warm-up 14 días
- **Autonomía total** con supervisión humana mínima

### Estado actual: **Etapas 1-7 completadas**

| Componente | Estado | Detalle |
|-----------|--------|---------|
| WhatsApp (Baileys) | ✅ | Multi-device, QR login, envío/recepción |
| Auto-reply IA | ✅ | Groq (qwen-2.5-32b) + Ollama (llama3.1:8b) fallback |
| CRM Contactos | ✅ | CRUD, importación CSV/XLSX/VCF/JSON, dedup, scoring |
| Pipeline Deals | ✅ | 7 etapas, follow-ups, estadísticas |
| Anti-ban (6/6) | ✅ | Warm-up, Gaussian delay, typing sim, horario, pausas, template rotation |
| CLI interactivo | ✅ | ANSI colors, tablas, progress bars |
| API REST | ✅ | 35+ endpoints, Express + Zod + Helmet + CORS + rate limiting |
| Dashboard Web | ✅ | Next.js 16 + shadcn/ui, 7 vistas |
| Campañas automáticas | ✅ | Engine + scheduler + template rotation + A/B testing |
| Seguridad | ✅ | JWT auth, audit log, GDPR (export/erase/consent), data retention |
| Tests | ✅ | 101 tests (11 archivos), Vitest + Supertest |
| CI/CD | ✅ | GitHub Actions (Node 20/22 matrix) |
| Logging | ✅ | Pino estructurado, child loggers por módulo |
| Legal | ✅ | Privacy Policy + Terms of Service |
| Docker + Producción | ✅ | Dockerfile multi-stage + docker-compose + nginx + backup + deploy guide |
| Analytics visual | ✅ | Dashboard con Recharts: tendencias, funnel, sentiment, timing, quality, CSV export |

---

## 2. Arquitectura del Sistema

### Diagrama de Capas (Estado Actual)

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                       │
│         CLI (ANSI)  │  Dashboard (Next.js)  │  API REST     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA CEREBRO IA                            │
│              Orchestrator + Groq API + Ollama                │
│  Auto-Reply │ Intent Detection │ Sentiment │ Escalation     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA CRM + CAMPAÑAS                        │
│     ContactManager │ DealManager │ CampaignEngine │ Importer │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA ANTI-BAN (6 capas)                    │
│     WarmupManager │ RateLimiter │ TemplateRotation           │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA WHATSAPP                              │
│              Baileys (multi-device) — SIN Meta API           │
│  Client │ Sender │ Receiver                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA DE DATOS                              │
│              SQLite + better-sqlite3 (WAL mode)              │
│  contacts │ messages │ deals │ activities │ campaigns        │
│  analytics │ config │ audit_logs                             │
└─────────────────────────────────────────────────────────────┘
```

### Estructura de Archivos

```
MejoraWS/
├── src/
│   ├── server.ts                    # Entry point + CLI + API
│   ├── config/index.ts              # Configuración central
│   ├── brain/
│   │   ├── orchestrator.ts          # Coordinador central (216 líneas)
│   │   └── auto-reply.ts            # Motor auto-respuesta IA (249 líneas)
│   ├── whatsapp/
│   │   ├── client.ts                # Conexión Baileys (205 líneas)
│   │   ├── sender.ts                # Envío con anti-ban (136 líneas)
│   │   └── receiver.ts              # Recepción mensajes (155 líneas)
│   ├── crm/
│   │   ├── contacts.ts              # Gestión contactos (224 líneas)
│   │   └── deals.ts                 # Pipeline deals (262 líneas)
│   ├── campaigns/
│   │   ├── engine.ts                # Campaign engine (283 líneas)
│   │   ├── templates.ts             # Template rotation
│   │   └── scheduler.ts             # Programación campañas
│   ├── importer/
│   │   ├── pipeline.ts              # Pipeline importación
│   │   ├── parsers.ts               # CSV/XLSX/VCF/JSON
│   │   ├── cleaner.ts               # Limpieza datos
│   │   └── deduplicator.ts          # Dedup (Jaro-Winkler)
│   ├── antiban/
│   │   ├── warmup.ts                # Warm-up 14 días
│   │   └── rate-limiter.ts          # Gaussian delay, typing sim
│   ├── llm/
│   │   ├── index.ts                 # LLM Manager (123 líneas)
│   │   ├── groq.ts                  # Groq API client
│   │   └── ollama.ts                # Ollama client local
│   ├── api/
│   │   ├── index.ts                 # Express app (66 líneas)
│   │   ├── routes/
│   │   │   ├── auth.ts              # JWT login/verify (104 líneas)
│   │   │   ├── contacts.ts          # CRUD contacts
│   │   │   ├── deals.ts             # CRUD deals + pipeline
│   │   │   ├── messages.ts          # Historial + envío
│   │   │   ├── campaigns.ts         # CRUD campañas + execute
│   │   │   ├── gdpr.ts              # GDPR endpoints (184 líneas)
│   │   │   ├── audit.ts             # Audit log endpoints
│   │   │   ├── health.ts            # Health check
│   │   │   └── status.ts            # System status + config
│   │   ├── middleware/
│   │   │   ├── error.ts             # Global error handler
│   │   │   ├── rate-limit.ts        # Per-IP rate limiting
│   │   │   └── validate.ts          # Zod validation
│   │   └── schemas/index.ts         # Zod schemas
│   ├── security/
│   │   ├── audit.ts                 # Audit log (163 líneas)
│   │   └── retention.ts             # Data retention (108 líneas)
│   ├── db/database.ts               # SQLite schema (118 líneas)
│   ├── utils/logger.ts              # Pino logging
│   └── cli/theme.ts                 # ANSI colors, tablas
├── dashboard/                       # Next.js 16 + shadcn/ui
│   ├── src/app/
│   │   ├── page.tsx                 # Dashboard KPIs
│   │   ├── pipeline/page.tsx        # Pipeline Kanban
│   │   ├── contactos/page.tsx       # CRUD Contactos
│   │   ├── campaigns/page.tsx       # Campañas
│   │   ├── chat/page.tsx            # Conversaciones
│   │   ├── config/page.tsx          # Config bot
│   │   └── login/page.tsx           # Auth
│   ├── src/lib/
│   │   ├── api.ts                   # API client
│   │   ├── auth-context.tsx         # Auth context
│   │   └── utils.ts                 # Utilidades
│   └── src/components/
│       ├── layout/                  # Sidebar + layout
│       └── ui/                      # shadcn/ui components
├── tests/
│   ├── unit/
│   │   ├── antiban/                 # rate-limiter (9), warmup (10)
│   │   ├── crm/                     # contacts (7), deals (12)
│   │   ├── importer/                # cleaner (13), deduplicator (8)
│   │   ├── campaigns/               # templates (10)
│   │   └── security/                # audit (6)
│   └── integration/api/
│       ├── contacts.api.test.ts     # 11 tests
│       ├── deals.api.test.ts        # 8 tests
│       └── gdpr.api.test.ts         # 7 tests
├── docs/
│   ├── legal/
│   │   ├── PRIVACY-POLICY.md        # GDPR compliant
│   │   └── TERMS-OF-SERVICE.md      # Términos de uso
│   └── deploy.md                    # Deploy guide completo
├── nginx/
│   ├── nginx.conf                   # Reverse proxy config
│   └── ssl/.gitkeep                 # SSL certs (gitignored)
├── scripts/
│   ├── backup.sh                    # Backup automático DB
│   └── setup-ssl.sh                 # SSL setup (Let's Encrypt)
├── backups/.gitkeep                 # Backups dir (gitignored)
├── Dockerfile                       # Multi-stage build
├── docker-compose.yml               # App + nginx + backup
├── .dockerignore                    # Docker build exclusions
├── .env.example                     # Variables de entorno
├── Makefile                         # Comandos de conveniencia
├── Documents/
│   ├── MEJORAWS-DOCUMENTACION.md    # Este archivo (DOC MAESTRO)
│   ├── CONTINUITY-PROMPT.md         # Prompt de continuidad
│   └── PROMPT.md                    # Prompt legacy
└── .github/workflows/ci.yml        # CI/CD GitHub Actions
```

---

## 3. Módulos Implementados

### 3.1 🤖 Auto-Reply Engine
**Archivo:** `src/brain/auto-reply.ts` (249 líneas)

- Detección de intención via LLM (CONSULTA, COMPRA, QUEJA, SOPORTE, PRECIO, OTRO)
- Escalamiento inteligente (keywords + sentimiento + max intercambios)
- Knowledge base configurable
- Horario de atención configurable (8:00-20:00 default)
- Personalidad configurable (nombre, tono, idioma)

### 3.2 🧠 Orchestrator
**Archivo:** `src/brain/orchestrator.ts` (216 líneas)

Coordinador central que conecta todos los módulos:
- Gestión de WhatsApp client
- Routing de mensajes entrantes → auto-reply
- Exposición de managers (contacts, deals, campaigns)
- Estado del sistema (getStatus con checks reales)
- Start/stop graceful de todos los servicios

### 3.3 📇 CRM — Contactos
**Archivo:** `src/crm/contacts.ts` (224 líneas)

- CRUD completo (create, read, update, delete)
- Filtros: search, tags, minScore, whatsapp
- Scoring automático (0-100)
- Tags múltiples
- Estadísticas: total, con WhatsApp, con email, score promedio

### 3.4 🎯 CRM — Pipeline de Deals
**Archivo:** `src/crm/deals.ts` (262 líneas)

**7 etapas:**
```
nuevo → contactado → interesado → propuesta → negociacion → cerrado-ganado
                                                            → cerrado-perdido
```
- Crear deals con valor asociado
- Mover entre etapas con registro de actividad
- Follow-ups programados
- Vista pipeline con conteo por etapa
- Estadísticas completas

### 3.5 📥 Importador de Contactos
**Archivos:** `src/importer/` (pipeline, parsers, cleaner, deduplicator)

Pipeline: Auto-detección formato → Auto-mapeo columnas (ES/EN) → Limpieza → Dedup 3 capas (teléfono exacto → email exacto → nombre fuzzy Jaro-Winkler) → Import SQLite con upsert

Formatos: CSV, Excel (.xlsx/.xls), VCF (vCard), JSON

### 3.6 📤 Campañas Automáticas
**Archivos:** `src/campaigns/` (engine, templates, scheduler)

- CRUD completo de campañas
- Ejecución con anti-ban integrado (respeta warm-up limits)
- Pausa/reanudación
- Tracking: sent, delivered, read, replied
- Audiencia: `all`, `tag:X`, `score:N+`, `phone:n1,n2`
- Template rotation (anti-ban capa 6): sinónimos + formato + variables `{{nombre}}` `{{empresa}}`
- Scheduler automático (check cada 60s)

### 3.7 🛡️ Anti-Ban (6 capas)
**Archivos:** `src/antiban/warmup.ts`, `src/antiban/rate-limiter.ts`

| Capa | Descripción | Estado |
|------|-------------|--------|
| 1. Warm-up 14 días | 10→200 msg/día gradual | ✅ |
| 2. Gaussian delay | 5-20s entre mensajes (distribución normal) | ✅ |
| 3. Typing simulation | 1-3s indicador "escribiendo..." | ✅ |
| 4. Horario laboral | 8:00-20:00, sin envíos fuera de horario | ✅ |
| 5. Pausa cada 10 msgs | 2-5 min de pausa | ✅ |
| 6. Template rotation | Sinónimos + formato + variaciones | ✅ |

### 3.8 🧠 LLM Manager
**Archivo:** `src/llm/index.ts` (123 líneas)

- **Primario:** Groq API (qwen-2.5-32b, gratis, ~30 req/min)
- **Backup:** Ollama local (llama3.1:8b, sin internet)
- **Fallback automático:** Groq → Ollama
- Detección de intención + análisis de sentimiento

### 3.9 🔐 JWT Auth
**Archivo:** `src/api/routes/auth.ts` (104 líneas)

- POST `/api/v1/auth/login` — login con credenciales
- GET `/api/v1/auth/verify` — verificar token
- Middleware JWT en rutas protegidas
- Default credentials: admin/admin123 (configurable)

### 3.10 📋 GDPR Compliance
**Archivo:** `src/api/routes/gdpr.ts` (184 líneas)

- GET `/api/v1/gdpr/export/:phone` — exportar datos contacto
- DELETE `/api/v1/gdpr/erase/:phone` — borrar datos (right to erasure)
- PUT `/api/v1/gdpr/consent/:phone` — gestionar consentimiento
- GET `/api/v1/gdpr/stats` — estadísticas consentimiento

### 3.11 📊 Audit Log
**Archivo:** `src/security/audit.ts` (163 líneas)

- Registro de todas las acciones sensibles
- GET `/api/v1/audit` — consultar logs con filtros
- GET `/api/v1/audit/stats` — estadísticas
- POST `/api/v1/audit/cleanup` — limpiar logs antiguos
- Retención configurable

### 3.12 ⏱️ Data Retention
**Archivo:** `src/security/retention.ts` (108 líneas)

- Mensajes: 180 días
- Actividades: 365 días
- Audit logs: 90 días
- Cleanup automático configurable

---

## 4. Stack Técnico

| Capa | Tecnología | Costo | Notas |
|------|-----------|-------|-------|
| **Runtime** | Node.js 22 + TypeScript 5.8 | $0 | |
| **WhatsApp** | @whiskeysockets/baileys ^6.7.16 | $0 | SIN Meta API |
| **LLM primario** | Groq API (qwen-2.5-32b) | $0 | ~30 req/min |
| **LLM backup** | Ollama (llama3.1:8b) | $0 | Local, sin internet |
| **Database** | SQLite + better-sqlite3 | $0 | WAL mode |
| **API** | Express 4 + Zod 4 + Helmet + CORS | $0 | REST v1 |
| **Dashboard** | Next.js 16 + React 19 + shadcn/ui | $0 | Tailwind v4 |
| **Logging** | Pino + pino-pretty | $0 | JSON estructurado |
| **Testing** | Vitest + Supertest | $0 | 101 tests |
| **CI/CD** | GitHub Actions | $0 | Node 20/22 matrix |
| **CLI** | readline + ANSI codes | $0 | Sin deps externas |
| **Import** | xlsx + papaparse | $0 | CSV/Excel/VCF/JSON |
| **Costo total** | — | **$0** | |

---

## 5. Modelo de Datos

### Schema SQLite (`src/db/database.ts`)

```sql
-- Contactos
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  company TEXT,
  whatsapp INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',        -- JSON array
  score INTEGER DEFAULT 0,       -- 0-100
  source TEXT,
  consent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Mensajes
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  contact_phone TEXT NOT NULL,
  direction TEXT NOT NULL,        -- 'inbound' | 'outbound'
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  campaign_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Deals (Pipeline)
CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  contact_phone TEXT NOT NULL,
  stage TEXT DEFAULT 'nuevo',
  value REAL,
  probability INTEGER DEFAULT 0,
  notes TEXT,
  next_follow_up TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Actividades
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  contact_phone TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  metadata TEXT,                  -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

-- Campañas
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT,
  audience TEXT,
  template TEXT,
  variations TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  scheduled_at TEXT,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Analytics
CREATE TABLE analytics (
  date TEXT PRIMARY KEY,
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  read INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  deals_created INTEGER DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0
);

-- Config key-value
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Índices
CREATE INDEX idx_messages_contact ON messages(contact_phone);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_deals_contact ON deals(contact_phone);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_activities_contact ON activities(contact_phone);
CREATE INDEX idx_activities_created ON activities(created_at);
```

### Observaciones del DBA
- ✅ Schema normalizado, índices en columnas de búsqueda frecuente
- ✅ WAL mode para concurrencia
- ⚠️ `tags` como JSON string limita queries complejas → considerar tabla pivot
- ⚠️ IDs como TEXT (cuidado con colisiones en alta concurrencia)
- ⚠️ Sin foreign keys explícitas → integridad referencial a nivel aplicación
- 📋 Futuro: migración a PostgreSQL para multi-usuario

---

## 6. API REST — Endpoints

### Auth
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login (retorna JWT) |
| GET | `/api/v1/auth/verify` | Verificar token |

### Contacts
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/contacts` | Listar (con filtros) |
| POST | `/api/v1/contacts` | Crear contacto |
| GET | `/api/v1/contacts/:id` | Obtener por ID |
| PUT | `/api/v1/contacts/:id` | Actualizar |
| DELETE | `/api/v1/contacts/:id` | Eliminar |
| GET | `/api/v1/contacts/phone/:phone` | Buscar por teléfono |
| POST | `/api/v1/contacts/import` | Importar archivo |
| GET | `/api/v1/contacts/stats/summary` | Estadísticas |

### Deals
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/deals` | Listar deals |
| POST | `/api/v1/deals` | Crear deal |
| GET | `/api/v1/deals/pipeline` | Vista pipeline |
| GET | `/api/v1/deals/followups` | Follow-ups pendientes |
| GET | `/api/v1/deals/stats` | Estadísticas |
| PATCH | `/api/v1/deals/:id` | Actualizar deal |
| PATCH | `/api/v1/deals/:id/stage` | Mover etapa |
| POST | `/api/v1/deals/:id/close` | Cerrar deal |
| POST | `/api/v1/deals/:id/followup` | Programar follow-up |

### Messages
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/messages/:phone` | Historial contacto |
| GET | `/api/v1/messages/recent/all` | Mensajes recientes |
| POST | `/api/v1/messages/send` | Enviar mensaje |
| GET | `/api/v1/messages/stats/sending` | Stats envío |

### Campaigns
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/campaigns` | Listar campañas |
| POST | `/api/v1/campaigns` | Crear campaña |
| GET | `/api/v1/campaigns/:id` | Obtener campaña |
| PATCH | `/api/v1/campaigns/:id` | Actualizar |
| DELETE | `/api/v1/campaigns/:id` | Eliminar |
| GET | `/api/v1/campaigns/:id/stats` | Estadísticas |
| POST | `/api/v1/campaigns/:id/execute` | Ejecutar |
| POST | `/api/v1/campaigns/:id/pause` | Pausar |

### GDPR
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/gdpr/export/:phone` | Exportar datos |
| DELETE | `/api/v1/gdpr/erase/:phone` | Borrar datos |
| PUT | `/api/v1/gdpr/consent/:phone` | Gestionar consentimiento |
| GET | `/api/v1/gdpr/stats` | Stats consentimiento |

### Audit
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/audit` | Consultar logs |
| GET | `/api/v1/audit/stats` | Estadísticas |
| POST | `/api/v1/audit/cleanup` | Limpiar antiguos |
| PUT | `/api/v1/audit/retention` | Configurar retención |

### Analytics
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/analytics/overview` | KPIs principales (mensajes, deals, revenue) |
| GET | `/api/v1/analytics/messages` | Tendencia mensajes (30 días, por día) |
| GET | `/api/v1/analytics/funnel` | Funnel conversión (contactos→mensajes→deals→cerrados) |
| GET | `/api/v1/analytics/sentiment` | Tendencia sentimiento (positivo/neutro/negativo) |
| GET | `/api/v1/analytics/timing` | Mejor horario para enviar (hora + día) |
| GET | `/api/v1/analytics/quality` | Calidad conversación (auto-resolución, escalamiento, intenciones) |
| GET | `/api/v1/analytics/export?type=X` | Export CSV (messages, contacts, deals, campaigns) |

### Status & Health
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Health check (DB, LLM, WA) |
| GET | `/api/v1/status` | Estado del sistema |
| GET | `/api/v1/status/config` | Config del bot |
| PUT | `/api/v1/status/config` | Actualizar config |
| PUT | `/api/v1/status/kb` | Actualizar knowledge base |

### Middleware
- **Zod validation** — schemas para todos los endpoints
- **Global error handler** — AppError + ZodError + 404
- **Rate limiting** — 200 req/min por IP
- **CORS + Helmet** — headers de seguridad
- **JWT auth** — protección de rutas
- **Request logging** — pino con request ID

---

## 7. CLI — Comandos

### Comunicación
| Comando | Descripción |
|---------|-------------|
| `/enviar <número> <mensaje>` | Enviar mensaje manual |
| `/historial <número>` | Ver historial (tabla) |

### Contactos
| Comando | Descripción |
|---------|-------------|
| `/contactos` | Listar contactos (tabla) |
| `/importar <archivo>` | Importar CSV/JSON/XLSX/VCF |

### Pipeline
| Comando | Descripción |
|---------|-------------|
| `/pipeline` | Ver pipeline Kanban |
| `/deal <número> [valor]` | Crear deal |
| `/mover <deal-id> <etapa>` | Mover deal entre etapas |
| `/followups` | Ver follow-ups pendientes |

### Configuración
| Comando | Descripción |
|---------|-------------|
| `/estado` | Estado completo del sistema |
| `/kb <texto>` | Actualizar knowledge base |
| `/config` | Ver configuración del bot |

### Sistema
| Comando | Descripción |
|---------|-------------|
| `/ayuda` | Mostrar ayuda |
| `/salir` | Desconectar y salir |

---

## 8. Anti-Ban System (6 capas)

### Warm-up de 14 días

| Día | Límite | Día | Límite |
|-----|--------|-----|--------|
| 1 | 10 | 8 | 45 |
| 2 | 12 | 9 | 55 |
| 3 | 15 | 10 | 70 |
| 4 | 18 | 11 | 85 |
| 5 | 22 | 12 | 100 |
| 6 | 28 | 13 | 120 |
| 7 | 35 | 14 | 150 |
| | | 15+ | 200 (máx) |

### Protecciones activas
1. ✅ **Warm-up 14 días** — progresión gradual de 10 a 200 msg/día
2. ✅ **Gaussian delay** — distribución normal: media 10s, std 3s (min 5s, max 20s)
3. ✅ **Typing simulation** — 1-3s indicador "escribiendo..." antes de cada envío
4. ✅ **Horario laboral** — 8:00-20:00, auto-pausa fuera de horario
5. ✅ **Pausa cada 10 msgs** — 2-5 min de pausa obligatoria
6. ✅ **Template rotation** — sinónimos automáticos + variación de formato + variables dinámicas

---

## 9. Seguridad y Compliance

### Implementado
- ✅ **JWT Auth** — login protegido para dashboard
- ✅ **Rate limiting** — 200 req/min por IP
- ✅ **CORS + Helmet** — headers de seguridad
- ✅ **Zod validation** — inputs sanitizados
- ✅ **Audit log** — trazabilidad de acciones sensibles
- ✅ **GDPR** — export, erase, consent management
- ✅ **Data retention** — política configurable, cleanup automático
- ✅ **Privacy Policy** — GDPR compliant
- ✅ **Terms of Service** — protección legal
- ✅ **Datos locales** — todo en SQLite, no sale del servidor
- ✅ **LLM backup local** — Ollama sin internet

### Pendiente
| Brecha | Severidad | Descripción |
|--------|----------|-------------|
| Cifrado at-rest sesión WA | 🟡 Media | `data/session/` sin cifrado adicional |
| HTTPS obligatorio | 🟡 Media | Requiere reverse proxy (nginx) en producción |
| Backup automatizado | 🟢 Baja | Sin backup automático de DB |
| Secrets management | 🟢 Baja | Variables de entorno sin vault |

---

## 10. Dashboard Web

**Stack:** Next.js 16 + React 19 + Tailwind v4 + shadcn/ui

### 7 Vistas

| Vista | Ruta | Función |
|-------|------|---------|
| Dashboard KPIs | `/` | Métricas principales, estado sistema |
| Pipeline Kanban | `/pipeline` | Deals por etapa, drag & drop |
| Contactos | `/contactos` | CRUD, filtros, importación |
| Campañas | `/campaigns` | Gestión campañas, ejecución |
| Chat | `/chat` | Conversaciones en tiempo real |
| Configuración | `/config` | Bot personality, knowledge base |
| Login | `/login` | Autenticación JWT |

### Componentes UI (shadcn/ui)
Button, Card, Input, Label, Select, Textarea, Table, Badge, Avatar, Dialog, Sheet, Tabs, Separator, Dropdown Menu

### Auto-refresh
Polling cada 10-15s para actualización de datos (simplificado vs WebSocket)

---

## 11. Tests

### Resumen: 110 tests, 12 archivos

| Archivo | Tests | Tipo |
|---------|-------|------|
| `tests/unit/antiban/rate-limiter.test.ts` | 9 | Unit |
| `tests/unit/antiban/warmup.test.ts` | 10 | Unit |
| `tests/unit/crm/contacts.test.ts` | 7 | Unit |
| `tests/unit/crm/deals.test.ts` | 12 | Unit |
| `tests/unit/importer/cleaner.test.ts` | 13 | Unit |
| `tests/unit/importer/deduplicator.test.ts` | 8 | Unit |
| `tests/unit/campaigns/templates.test.ts` | 10 | Unit |
| `tests/unit/security/audit.test.ts` | 6 | Unit |
| `tests/integration/api/contacts.api.test.ts` | 11 | Integration |
| `tests/integration/api/deals.api.test.ts` | 8 | Integration |
| `tests/integration/api/gdpr.api.test.ts` | 7 | Integration |
| `tests/integration/api/analytics.api.test.ts` | 9 | Integration |
| **Total** | **110** | **✅ All passing** |

### Stack
- **Vitest** — test runner (rápido, ESM nativo)
- **Supertest** — testing HTTP endpoints
- **CI** — GitHub Actions, matrix Node 20/22

---

## 12. Análisis Multidisciplinario (36 Roles)

### Área Técnica

#### 🏗️ Software Architect
**Veredicto:** ✅ Arquitectura limpia, separación de capas bien definida.
- Fortaleza: Manager classes consistentes, orchestrator como coordinator
- Mejora: Dependency injection para testearabilidad, WebSocket para real-time

#### ☁️ Cloud Architect
**Veredicto:** ⚠️ 100% local, sin deployment.
- Plan: Docker multi-stage, docker-compose (app+pg+redis), nginx reverse proxy + SSL
- Objetivo: Deploy reproducible en un `docker-compose up`

#### 💻 Backend Developer
**Veredicto:** ✅ Lógica de negocio sólida, API completa.
- Fortaleza: 35+ endpoints, Zod validation, error handling centralizado
- Mejora: Cursor-based pagination, WebSocket para live updates

#### 🎨 Frontend Developer
**Veredicto:** ✅ Dashboard funcional con 7 vistas.
- Stack: Next.js 16, React 19, shadcn/ui, Tailwind v4
- Mejora: Real-time via WebSocket (actualmente polling), PWA support

#### 📱 iOS/Android Developer
**Veredicto:** No aplica nativamente. Dashboard responsive-first.
- Futuro: PWA con service workers para notificaciones push

#### ⚙️ DevOps Engineer
**Veredicto:** ✅ CI/CD funcional, falta containerización.
- Completado: GitHub Actions (Node 20/22 matrix)
- Pendiente: Dockerfile, docker-compose, nginx, deploy guide

#### 🔒 SRE
**Veredicto:** ⚠️ Logging funcional, falta observabilidad.
- Completado: Pino structured logging, health check endpoint
- Pendiente: Prometheus metrics, Grafana dashboards, alerting

#### 🔐 Cybersecurity Architect
**Veredicto:** ✅ Hardening básico completo.
- Completado: JWT, rate limiting, CORS, Helmet, Zod validation, audit log
- Pendiente: HTTPS, cifrado at-rest, secrets management

#### 📊 Data Engineer
**Veredicto:** ✅ Schema limpio, import pipeline funcional.
- Fortaleza: Dedup 3 capas, auto-mapeo columnas
- Mejora: Migración a PostgreSQL con ORM (Drizzle)

#### 🤖 ML Engineer
**Veredicto:** ✅ Integración LLM funcional con fallback.
- Fortaleza: Groq → Ollama auto-fallback, intent detection, sentiment
- Mejora: Conversation quality scoring, A/B testing de prompts

#### 🧪 QA Automation Engineer
**Veredicto:** ✅ 101 tests, buena cobertura.
- Stack: Vitest + Supertest
- Pendiente: E2E tests (Playwright), load testing

#### 🗄️ DBA
**Veredicto:** ✅ SQLite funcional con WAL mode.
- Mejora: Foreign keys, tabla de migraciones, backup automático
- Futuro: PostgreSQL para multi-usuario

### Área de Producto y Gestión

#### 📋 Product Manager
KPIs: tiempo respuesta <30s, resolución auto >80%, conversión deals >15%

#### 🎯 Product Owner
User stories priorizadas, acceptance criteria definidos para cada etapa

#### 🏃 Scrum Master
Sprints de 1 semana, ceremonias definidas, DoD claro

#### 🔍 UX Researcher
Insight: CLI potente pero no discoverable → Dashboard resuelve esto

#### 🎨 UX Designer
Wireframes del dashboard definidos y implementados

#### ✍️ UX Writer
Mejoras: mensajes consistentes, ayuda contextual, onboarding

#### 🌍 Localization Manager
Estado: Solo español. Plan i18n: ES (default) + EN

#### 📦 Delivery Manager
Release plan: v0.1→v0.5 definido, v1.0 producción en semana 9-10

### Área Comercial y de Crecimiento

#### 📈 Growth Manager
Estrategia: Uso interno → Documentar caso → Landing → Beta → Pricing

#### 🎯 Performance Marketing
Google Ads, Facebook/Instagram demos, LinkedIn pymes, YouTube tutorials

#### 🔍 SEO Specialist
Keywords: "crm whatsapp", "bot whatsapp ventas", "automatizar whatsapp"

#### 🤝 Business Dev
Oportunidades: e-commerce integration, agencias partnership, API pública

#### 👥 Community Manager
Discord server, GitHub discussions, newsletter, webinars

#### 📝 Content Manager
Blog 2 posts/mes, video tutorials, templates por industria, case studies

### Área de Operaciones, Legal y Análisis

#### 📊 BI Analyst
KPIs: tasa respuesta auto, tiempo respuesta, conversión pipeline, revenue/contacto

#### 🔬 Data Scientist
Análisis: sentiment trend, intent distribution, conversion funnel, optimal timing

#### ⚖️ Legal & Compliance
Checklist: privacy policy ✅, ToS ✅, consent mechanism ✅, data retention ✅

#### 🔒 DPO
GDPR: consent ✅, access ✅, erasure ✅, portability ✅, breach notification pendiente

#### 🎧 Customer Success
Onboarding: welcome → setup wizard → import → test → check-in 7 días

#### 🛠️ Technical Support
Tier 1: FAQ/guides, Tier 2: config avanzada, Tier 3: bugs/features

#### 💰 RevOps
Pricing: Free (100 contactos) → Pro ($29) → Business ($99) → Enterprise (custom)

---

## 13. Plan Optimizado por Etapas

### Visión General

```
✅ ETAPA 1-3: WhatsApp + Bot IA + CRM + CLI           (COMPLETADA)
✅ ETAPA 4:   API REST + Tests + CI/CD + Logging       (COMPLETADA)
✅ ETAPA 5:   Dashboard Web (Next.js, 7 vistas)        (COMPLETADA)
✅ ETAPA 6:   Campañas + Template Rotation              (COMPLETADA)
✅ ETAPA 7:   Seguridad + GDPR Compliance               (COMPLETADA)
✅ ETAPA 8:   Docker + Producción                       (COMPLETADA)
✅ ETAPA 9:   Analytics e Inteligencia                   (COMPLETADA)
⏳ ETAPA 10:  Multi-tenancy + Escala                     (SIGUIENTE)
```

---

### ✅ ETAPA 1-3: Foundation + WhatsApp + Bot + CRM + CLI
**Estado:** COMPLETADA

| Componente | Detalle |
|-----------|---------|
| WhatsApp | Baileys multi-device, QR login |
| Auto-reply | Groq + Ollama fallback, intent detection, escalation |
| CRM | Contactos (CRUD, import, dedup, scoring) + Deals (7 etapas, follow-ups) |
| Anti-ban | 5/6 capas (warm-up, gaussian, typing, horario, pausas) |
| CLI | Interactivo con ANSI colors, tablas, progress bars |
| Importador | CSV/XLSX/VCF/JSON, auto-mapeo, dedup 3 capas |

---

### ✅ ETAPA 4: Fundación Técnica
**Estado:** COMPLETADA

| # | Tarea | Rol | Estado |
|---|-------|-----|--------|
| 4.1 | API REST endpoints (35+) | Backend Dev | ✅ |
| 4.2 | Tests unitarios (101 tests) | QA Automation | ✅ |
| 4.3 | Input validation (Zod 4) | Backend Dev | ✅ |
| 4.4 | Error handling middleware | Backend Dev | ✅ |
| 4.5 | Logging estructurado (pino) | SRE | ✅ |
| 4.6 | Health check endpoint | SRE | ✅ |
| 4.7 | GitHub Actions CI | DevOps | ✅ |
| 4.8 | Rate limiting + CORS + Helmet | Cybersecurity | ✅ |

---

### ✅ ETAPA 5: Dashboard Web
**Estado:** COMPLETADA

| # | Tarea | Rol | Estado |
|---|-------|-----|--------|
| 5.1 | Setup Next.js 16 + shadcn/ui | Frontend Dev | ✅ |
| 5.2 | Auth simple (JWT + login) | Cybersecurity | ✅ |
| 5.3 | Vista Dashboard (KPIs) | Frontend + BI | ✅ |
| 5.4 | Vista Pipeline Kanban | Frontend + UX | ✅ |
| 5.5 | Vista Contactos (tabla) | Frontend Dev | ✅ |
| 5.6 | Vista Chat | Frontend Dev | ✅ |
| 5.7 | Vista Configuración | Frontend Dev | ✅ |
| 5.8 | Polling para live updates | Backend Dev | ✅ |
| 5.9 | Responsive design | UX Designer | ✅ |

---

### ✅ ETAPA 6: Campañas y Automatización
**Estado:** COMPLETADA

| # | Tarea | Rol | Estado |
|---|-------|-----|--------|
| 6.1 | Campaign Engine | Backend Dev | ✅ |
| 6.2 | Template rotation (anti-ban capa 6) | Backend Dev | ✅ |
| 6.3 | Programación de campañas | Backend Dev | ✅ |
| 6.4 | A/B testing de mensajes | ML Engineer | ✅ |
| 6.5 | Vista Campañas en dashboard | Frontend Dev | ✅ |
| 6.6 | Analytics de campañas | BI Analyst | ✅ |

---

### ✅ ETAPA 7: Seguridad y Compliance
**Estado:** COMPLETADA

| # | Tarea | Rol | Estado |
|---|-------|-----|--------|
| 7.1 | JWT auth completo | Cybersecurity | ✅ |
| 7.2 | Rate limiting en API | Cybersecurity | ✅ |
| 7.3 | CORS + Helmet headers | Cybersecurity | ✅ |
| 7.4 | Audit log | SRE | ✅ |
| 7.5 | Consent management | DPO | ✅ |
| 7.6 | Right to erasure endpoint | DPO | ✅ |
| 7.7 | Data retention policy | DPO | ✅ |
| 7.8 | Data export (portability) | DPO | ✅ |
| 7.9 | Privacy policy + ToS | Legal | ✅ |

---

### ✅ ETAPA 8: Docker + Producción
**Duración:** 1 sesión | **Prioridad:** Alta | **Estado:** COMPLETADA

**Objetivo:** Deploy en producción, preparar para escala.

| # | Tarea | Rol | Archivos | Estado |
|---|-------|-----|----------|--------|
| 8.1 | Dockerfile multi-stage | DevOps | `Dockerfile` | ✅ |
| 8.2 | docker-compose.yml | DevOps | `docker-compose.yml` | ✅ |
| 8.3 | Variables de entorno (.env) | DevOps | `.env.example` | ✅ |
| 8.4 | Nginx reverse proxy + SSL | DevOps | `nginx/nginx.conf` | ✅ |
| 8.5 | Backup automatizado DB | DBA | `scripts/backup.sh` | ✅ |
| 8.6 | Deploy guide | DevOps | `docs/deploy.md` | ✅ |
| 8.7 | Makefile comandos | DevOps | `Makefile` | ✅ |
| 8.8 | SSL setup script | DevOps | `scripts/setup-ssl.sh` | ✅ |
| 8.9 | .dockerignore | DevOps | `.dockerignore` | ✅ |

**Entregable:** `docker-compose up` levanta todo el sistema listo para producción. ✅

**docker-compose.yml target:**
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes: ["./data:/app/data"]
    env_file: .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

### ✅ ETAPA 9: Analytics e Inteligencia
**Duración:** 1 sesión | **Prioridad:** Media | **Estado:** COMPLETADA

| # | Tarea | Rol | Archivos | Estado |
|---|-------|-----|----------|--------|
| 9.1 | Analytics API (6 endpoints) | Backend Dev | `src/api/routes/analytics.ts` | ✅ |
| 9.2 | Dashboard Analytics (Recharts) | Frontend + BI | `dashboard/src/app/analytics/page.tsx` | ✅ |
| 9.3 | Conversion funnel | Data Scientist | Endpoint `/analytics/funnel` | ✅ |
| 9.4 | Sentiment trend tracking | ML Engineer | Endpoint `/analytics/sentiment` | ✅ |
| 9.5 | Optimal timing analysis | Data Scientist | Endpoint `/analytics/timing` | ✅ |
| 9.6 | Conversation quality scoring | ML Engineer | Endpoint `/analytics/quality` | ✅ |
| 9.7 | CSV export (4 tipos) | Backend Dev | Endpoint `/analytics/export` | ✅ |
| 9.8 | Tests integración | QA | `tests/integration/api/analytics.api.test.ts` | ✅ |

**Entregable:** Dashboard analytics con gráficas + API de analytics + export CSV. ✅

---

### ⏳ ETAPA 10: Multi-tenancy y Escala
**Duración:** 3-4 semanas | **Prioridad:** Baja | **Estado:** SIGUIENTE

| # | Tarea | Rol | Dificultad |
|---|-------|-----|-----------|
| 10.1 | Migración SQLite → PostgreSQL | DBA | Alta |
| 10.2 | Redis para cache/queues | Backend Dev | Media |
| 10.3 | Multi-tenant support | Software Architect | Alta |
| 10.4 | Prometheus metrics + Grafana | SRE | Media |
| 10.5 | Load testing (k6) | QA Automation | Media |
| 10.6 | Horizontal scaling (PM2 cluster) | DevOps | Media |

---

## 14. Registro de Avances

> **Sección actualizada con cada "documentar"**

### Estado General

| Campo | Valor |
|-------|-------|
| **Nombre** | MejoraWS |
| **Fase** | Etapas 1-7 completadas |
| **Commits** | 20 |
| **Tests** | 101 (11 archivos) |
| **Endpoints API** | 35+ |
| **Documentos** | 3 (este archivo + CONTINUITY-PROMPT + PROMPT) |
| **Último trabajo** | Etapa 7 completada, documentación consolidada |

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
| 27/04 | 03:41 | Consolidación final | 5 docs → 1 documento maestro |
| 28/04 | 03:41 | **Etapas 1-3 completadas** | WhatsApp + Bot + CRM + CLI funcional |
| 28/04 | 04:01 | Auditoría UX/UI | Análisis contra trends 2026 |
| 28/04 | 04:18 | Fix getStatus() | Bug: LLM status hardcoded |
| 28/04 | 04:18 | CLI con colores | Nuevo theme.ts con ANSI |
| 28/04 | 04:26 | **documentar** | Consolidación + fix |
| 28/04 | 05:45 | Reestructuración mayor | Doc unificado + análisis 36 roles |
| 28/04 | 06:00 | **Etapa 4 completada** | API REST + 78 tests + CI/CD |
| 28/04 | 06:10 | **Etapa 5 completada** | Dashboard Next.js (6 vistas) |
| 28/04 | 06:17 | **Etapa 6 completada** | Campañas automáticas |
| 28/04 | 06:33 | **Etapa 7 completada** | Audit log + GDPR + legal |
| 28/04 | 06:41 | **documentar** | Consolidación final sesión |
| 29/04 | 00:19 | **documentar** | Optimización doc + plan actualizado |
| 29/04 | 00:29 | **Etapa 8 completada** | Docker + Producción: Dockerfile, docker-compose, nginx, backup, deploy guide, Makefile |
| 29/04 | 00:38 | **Etapa 9 completada** | Analytics: API (6 endpoints) + Dashboard Recharts (5 gráficas) + CSV export + 9 tests |

### Decisiones Técnicas

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| WhatsApp | Baileys | SIN Meta API, $0 |
| LLM primario | Groq (qwen-2.5-32b) | Gratis, rápido |
| LLM backup | Ollama (llama3.1:8b) | Local, sin internet |
| Database | SQLite + better-sqlite3 | $0, WAL mode |
| API Framework | Express + Zod | Ya era dependencia, Zod type-safe |
| Dashboard | Next.js 16 + shadcn/ui | SSR, componentes pre-built |
| Testing | Vitest + Supertest | Rápido, ESM nativo |
| CI/CD | GitHub Actions | Nativo, matrix Node 20/22 |
| Logging | Pino | JSON estructurado, bajo overhead |
| Anti-ban | 6 capas | Máxima protección contra bans |
| Documentación | 1 archivo consolidado | Simplicidad, trigger "documentar" |
| Costo total | $0 | Todo local/gratis |

### Bugs Corregidos

| Bug | Archivo | Fix |
|-----|---------|-----|
| `getStatus()` devolvía `llm: 'checking...'` hardcoded | orchestrator.ts | Async + consulta real `llm.getStatus()` |
| CLI sin colores | server.ts + 8 archivos | Nuevo theme.ts, todos los console.log usan theme |
| Schema SQLite sin columna `company` | database.ts | Agregada columna `company` |
| `req.params` typing en Express 5 | routes/*.ts | Cast explícito a `string` |

---

## 15. Protocolo: "documentar"

### Trigger
Cuando el usuario diga **"documentar"**, ejecutar automáticamente:

1. Leer `Documents/MEJORAWS-DOCUMENTACION.md`
2. Revisar cambios desde la última actualización (`git log`)
3. Actualizar secciones:
   - **Registro de Avances** → timeline, estado general, decisiones, pendientes
   - **Módulos Implementados** → si hay módulos nuevos
   - **Modelo de Datos** → si cambió el schema
   - **API REST** → si hay nuevos endpoints
   - **CLI** → si hay nuevos comandos
   - **Plan por Etapas** → si se completó una etapa
   - **Dashboard** → si hay nuevas vistas
   - **Tests** → si hay nuevos tests
4. Commit: `docs: documentar — [resumen de cambios]`
5. Push al repo

### Instrucción para el asistente
> No preguntes qué documentar. Asumí que querés actualizar TODO lo que cambió desde la última entrada del timeline. El commit message resume los cambios en una línea.
> **DOCUMENTO ÚNICO:** Este es el único archivo de documentación. No crear otros archivos de doc en `Documents/`.

---

*Última actualización: 29 abril 2026, 00:38 GMT+8*
*Etapas 1-9 completadas · 110 tests · 23 commits · 42+ endpoints · Listo para Etapa 10 (Multi-tenancy)*
