# 📚 DOCUMENTACIÓN CONSOLIDADA — MejoraWS

> **Trigger:** Cuando digas **"documentar"**, este archivo se actualiza con los trabajos realizados.
> **Última actualización:** 28 abril 2026, 06:00 GMT+8

---

## ÍNDICE

1. [Visión y Estado Actual](#1-visión-y-estado-actual)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Módulos Implementados](#3-módulos-implementados)
4. [Stack Técnico (Real)](#4-stack-técnico-real)
5. [Modelo de Datos (Actual)]#5-modelo-de-datos-actual)
6. [CLI — Comandos Disponibles](#6-cli--comandos-disponibles)
7. [Anti-Ban System](#7-anti-ban-system)
8. [WhatsApp — Sin Meta API](#8-whatsapp--sin-meta-api)
9. [Flujo Autónomo](#9-flujo-autónomo)
10. [Seguridad y Cumplimiento](#10-seguridad-y-cumplimiento)
11. [Análisis Multidisciplinario (36 Roles)](#11-análisis-multidisciplinario-36-roles)
12. [Plan Optimizado por Etapas](#12-plan-optimizado-por-etapas)
13. [Registro de Avances](#13-registro-de-avances)
14. [Trigger: "documentar"](#14-trigger-documentar)

---

## 1. Visión y Estado Actual

### Qué es
MejoraWS es un **CRM WhatsApp 100% autónomo con IA** donde el administrador solo define parámetros y la IA ejecuta todo: responde como humano, gestiona pipeline y reporta KPIs.

### Filosofía
```
Admin configura → IA ejecuta → Admin recibe resultados
```

### Estado actual: **FUNCIONAL (CLI)**

| Componente | Estado | Detalle |
|-----------|--------|---------|
| WhatsApp connection | ✅ Funcional | Baileys multi-device, QR login |
| Envío/recepción | ✅ Funcional | Con anti-ban completo |
| Auto-reply IA | ✅ Funcional | Groq + Ollama fallback |
| CLI interactivo | ✅ Funcional | Colores ANSI, tablas, progress bars |
| CRM contactos | ✅ Funcional | CRUD, importación, dedup, scoring |
| Pipeline deals | ✅ Funcional | 7 etapas, follow-ups, estadísticas |
| Importador | ✅ Funcional | CSV/XLSX/VCF/JSON, auto-mapeo, dedup |
| Anti-ban | ✅ Funcional | Gaussian delay, typing sim, warm-up 14d |
| API REST | ✅ Funcional | Express + Zod validation + rate limiting |
| Dashboard web | ✅ Funcional | Next.js 16 + shadcn/ui, 6 vistas |
| Tests | ✅ Funcional | 78 tests, 8 archivos, Vitest |
| Campañas automáticas | ❌ No implementado | Backlog |
| Analytics visual | ❌ No implementado | Backlog |
| CI/CD | ✅ Funcional | GitHub Actions (Node 20/22) |
| Logging | ✅ Funcional | Pino estructurado |
| Autenticación | ✅ Funcional | JWT (login + verify + middleware) |

### Promesa de valor
- **$0 de costo** (Groq gratis + Ollama local + SQLite)
- **Sin Meta API** — usa Baileys (WhatsApp Web directo)
- **Anti-ban** de 6 capas con warm-up 14 días
- **Autonomía total** con supervisión humana mínima

---

## 2. Arquitectura del Sistema

### Diagrama de Capas (Estado Actual)

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                       │
│              CLI interactivo (ANSI colors)                    │
│   /estado │ /contactos │ /pipeline │ /config │ /ayuda       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA CEREBRO IA                            │
│              Orchestrator + Groq API + Ollama                │
│  Auto-Reply │ Intent Detection │ Sentiment │ Escalation     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA CRM                                   │
│              ContactManager + DealManager + Importer          │
│  Contacts │ Deals │ Pipeline │ Follow-ups │ Import           │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA ANTI-BAN                              │
│              WarmupManager + RateLimiter                     │
│  Gaussian Delay │ Typing Sim │ Warm-up 14d │ Schedule       │
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
│              SQLite + better-sqlite3                          │
│  contacts │ messages │ deals │ activities │ campaigns        │
│  analytics │ config                                           │
└─────────────────────────────────────────────────────────────┘
```

### Arquitectura Futura (Objetivo)

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA CLIENTES                              │
│   Dashboard Web (Next.js) │ Mobile PWA │ CLI │ API pública  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA API GATEWAY                           │
│   Express + JWT Auth │ Rate Limiting │ CORS │ WebSocket     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA LÓGICA DE NEGOCIO                     │
│   Orchestrator │ AutoReply │ Campaign Engine │ Analytics     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA INTEGRACIONES                         │
│   Baileys WA │ Groq API │ Ollama │ Webhooks │ Email/SMTP    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA DATOS                                 │
│   PostgreSQL (prod) │ SQLite (dev) │ Redis (cache/queue)    │
│   File Storage │ Backup automático                           │
└─────────────────────────────────────────────────────────────┘
```

### Estructura de Archivos

```
MejoraWS/
├── src/
│   ├── api/
│   │   ├── index.ts              # Express app + route mounting
│   │   ├── middleware/
│   │   │   ├── error.ts          # Global error handler
│   │   │   ├── rate-limit.ts     # Per-IP rate limiting
│   │   │   └── validate.ts       # Zod validation middleware
│   │   ├── routes/
│   │   │   ├── contacts.ts       # /api/v1/contacts
│   │   │   ├── deals.ts          # /api/v1/deals
│   │   │   ├── health.ts         # /health
│   │   │   ├── messages.ts       # /api/v1/messages
│   │   │   └── status.ts         # /api/v1/status
│   │   └── schemas/
│   │       └── index.ts          # Zod schemas
│   ├── cli/
│   │   └── theme.ts            # Styling ANSI (colores, tablas, progress bars)
│   ├── brain/
│   │   ├── orchestrator.ts      # Coordinador central
│   │   └── auto-reply.ts        # Motor de auto-respuesta IA
│   ├── whatsapp/
│   │   ├── client.ts            # Conexión Baileys
│   │   ├── sender.ts            # Envío con anti-ban
│   │   └── receiver.ts          # Recepción de mensajes
│   ├── crm/
│   │   ├── contacts.ts          # Gestión de contactos
│   │   └── deals.ts             # Pipeline de deals
│   ├── importer/
│   │   ├── pipeline.ts          # Pipeline de importación
│   │   ├── parsers.ts           # CSV/XLSX/VCF/JSON parsers
│   │   ├── cleaner.ts           # Limpieza y normalización
│   │   └── deduplicator.ts      # Dedup (exacto + Jaro-Winkler)
│   ├── antiban/
│   │   ├── warmup.ts            # Warm-up 14 días
│   │   └── rate-limiter.ts      # Gaussian delay, typing sim
│   ├── llm/
│   │   ├── index.ts             # LLM Manager (Groq → Ollama)
│   │   ├── groq.ts              # Groq API client
│   │   └── ollama.ts            # Ollama client local
│   ├── config/
│   │   └── index.ts             # Configuración central
│   ├── db/
│   │   └── database.ts          # SQLite schema + init
│   ├── utils/
│   │   └── logger.ts            # Pino structured logging
│   └── server.ts                # Entry point + CLI + API
├── tests/
│   ├── unit/
│   │   ├── antiban/             # rate-limiter, warmup tests
│   │   ├── crm/                 # contacts, deals tests
│   │   └── importer/            # cleaner, deduplicator tests
│   └── integration/
│       └── api/                 # contacts API, deals API tests
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI
├── Documents/
│   └── MEJORAWS-DOCUMENTACION.md  # Este archivo (DOC MAESTRO)
├── data/                        # Datos runtime (gitignored)
├── vitest.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Módulos Implementados

### 3.1 🤖 Auto-Reply Engine

**Archivo:** `src/brain/auto-reply.ts`

Responde automáticamente a todos los mensajes entrantes como un humano.

**Componentes:**
- Detección de intención via LLM (CONSULTA, COMPRA, QUEJA, SOPORTE, PRECIO, OTRO)
- Escalamiento inteligente (keywords + sentimiento + max intercambios)
- Knowledge base configurable
- Horario de atención configurable
- Personalidad configurable (nombre, tono, idioma)

**Configuración por defecto:**
```json
{
  "name": "María",
  "personality": "Soy María, asesora de ventas...",
  "tone": "profesional-cercano",
  "schedule": { "start": 8, "end": 20 },
  "escalation": {
    "keywords": ["hablar con alguien", "agente", "urgente", "supervisor"],
    "maxExchanges": 3,
    "negativeSentiment": true
  }
}
```

### 3.2 📇 CRM — Contactos

**Archivo:** `src/crm/contacts.ts`

- CRUD completo (create, read, update, delete)
- Filtros: search, tags, minScore, whatsapp
- Scoring automático (0-100)
- Tags múltiples
- Estadísticas: total, con WhatsApp, con email, score promedio

### 3.3 🎯 CRM — Pipeline de Deals

**Archivo:** `src/crm/deals.ts`

**7 etapas:**
```
nuevo → contactado → interesado → propuesta → negociacion → cerrado-ganado
                                                            → cerrado-perdido
```

- Crear deals con valor asociado
- Mover entre etapas con registro de actividad
- Follow-ups programados
- Vista pipeline con conteo por etapa
- Estadísticas: abiertos, ganados, perdidos, valor total, tasa de conversión

### 3.4 📥 Importador de Contactos

**Archivo:** `src/importer/pipeline.ts`

**Pipeline:**
1. Auto-detección de formato (CSV/XLSX/VCF/JSON)
2. Auto-mapeo de columnas (ES/EN)
3. Limpieza determinística (normalización teléfono AR)
4. Deduplicación en 3 capas (teléfono exacto → email exacto → nombre fuzzy con Jaro-Winkler)
5. Import a SQLite con upsert (ON CONFLICT)

**Formatos soportados:** CSV, Excel (.xlsx/.xls), VCF (vCard), JSON

### 3.5 🛡️ Anti-Ban

**Archivos:** `src/antiban/warmup.ts`, `src/antiban/rate-limiter.ts`

| Capa | Descripción | Estado |
|------|-------------|--------|
| 1. Warm-up 14 días | 10→200 msg/día gradual | ✅ |
| 2. Gaussian delay | 5-20s entre mensajes (distribución normal) | ✅ |
| 3. Typing simulation | 1-3s indicador "escribiendo..." | ✅ |
| 4. Horario laboral | 8:00-20:00, sin envíos fuera de horario | ✅ |
| 5. Pausa cada 10 msgs | 2-5 min de pausa | ✅ |
| 6. Template rotation | ❌ No implementado | Backlog |

### 3.6 🧠 LLM Manager

**Archivo:** `src/llm/index.ts`

- **Primario:** Groq API (qwen-2.5-32b, gratis, ~30 req/min)
- **Backup:** Ollama local (llama3.1:8b, sin internet)
- **Fallback automático:** Groq → Ollama
- Detección de intención
- Análisis de sentimiento

### 3.7 🌐 API REST

**Archivos:** `src/api/`, `src/api/routes/`, `src/api/middleware/`

Endpoints completos con validación, error handling y rate limiting:

| Endpoint | Métodos | Descripción |
|----------|---------|-------------|
| `/health` | GET | Health check (DB, LLM, uptime) |
| `/api/v1/contacts` | GET, POST | Listar/crear contactos |
| `/api/v1/contacts/:id` | GET, PUT, DELETE | CRUD individual |
| `/api/v1/contacts/phone/:phone` | GET | Buscar por teléfono |
| `/api/v1/contacts/import` | POST | Importar archivo |
| `/api/v1/contacts/stats/summary` | GET | Estadísticas |
| `/api/v1/deals` | GET, POST | Listar/crear deals |
| `/api/v1/deals/pipeline` | GET | Vista pipeline |
| `/api/v1/deals/followups` | GET | Follow-ups pendientes |
| `/api/v1/deals/stats` | GET | Estadísticas |
| `/api/v1/deals/:id/stage` | PATCH | Mover etapa |
| `/api/v1/deals/:id/close` | POST | Cerrar deal |
| `/api/v1/messages/:phone` | GET | Historial |
| `/api/v1/messages/send` | POST | Enviar mensaje |
| `/api/v1/status` | GET | Estado del sistema |
| `/api/v1/status/config` | GET, PUT | Config del bot |
| `/api/v1/status/kb` | PUT | Knowledge base |

**Middleware:**
- Zod validation (schemas para todos los endpoints)
- Global error handler (AppError + ZodError + 404)
- Rate limiting (per-IP, 200 req/min)
- CORS + Helmet security headers
- Request logging (pino)

### 3.8 🧪 Tests

**Archivos:** `tests/unit/`, `tests/integration/`

| Archivo | Tests | Tipo |
|---------|-------|------|
| `tests/unit/antiban/rate-limiter.test.ts` | 9 | Unit |
| `tests/unit/antiban/warmup.test.ts` | 10 | Unit |
| `tests/unit/crm/contacts.test.ts` | 7 | Unit |
| `tests/unit/crm/deals.test.ts` | 12 | Unit |
| `tests/unit/importer/cleaner.test.ts` | 13 | Unit |
| `tests/unit/importer/deduplicator.test.ts` | 8 | Unit |
| `tests/integration/api/contacts.api.test.ts` | 11 | Integration |
| `tests/integration/api/deals.api.test.ts` | 8 | Integration |
| **Total** | **78** | **✅ All passing** |

### 3.9 📊 Logging Estructurado

**Archivo:** `src/utils/logger.ts`

- Pino como logger principal
- JSON en producción, pretty-print en desarrollo
- Niveles configurables via `LOG_LEVEL`
- Child loggers por módulo (`api:contacts`, `api:deals`, etc.)

### 3.10 ⚙️ CI/CD

**Archivo:** `.github/workflows/ci.yml`

- Trigger: push y PR a `main`
- Matrix: Node.js 20 + 22
- Steps: install → typecheck → test → build

---

## 4. Stack Técnico (Real)

### Stack Actual

| Capa | Tecnología | Costo | Notas |
|------|-----------|-------|-------|
| **Runtime** | Node.js 22 + TypeScript | $0 | |
| **WhatsApp** | @whiskeysockets/baileys ^6.7.16 | $0 | SIN Meta API |
| **LLM primario** | Groq API (groq-sdk) | $0 | qwen-2.5-32b |
| **LLM backup** | Ollama (fetch nativo) | $0 | llama3.1:8b local |
| **Database** | SQLite + better-sqlite3 | $0 | WAL mode |
| **API** | Express + Zod + Helmet + CORS | $0 | REST v1 |
| **CLI** | readline + ANSI codes | $0 | Sin dependencias externas |
| **Import** | xlsx + papaparse | $0 | CSV/Excel/VCF/JSON |
| **Logging** | pino + pino-pretty | $0 | JSON estructurado |
| **Testing** | Vitest + Supertest | $0 | 78 tests |
| **CI/CD** | GitHub Actions | $0 | Node 20/22 matrix |

### Dependencias (package.json)

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.16",
    "better-sqlite3": "^11.9.1",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "groq-sdk": "^1.1.2",
    "helmet": "^8.1.0",
    "multer": "^1.4.5-lts.2",
    "papaparse": "^5.5.3",
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0",
    "uuid": "^14.0.0",
    "xlsx": "^0.18.5",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.2",
    "@types/multer": "^1.4.12",
    "@types/node": "^24.0.4",
    "@types/papaparse": "^5.5.2",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "supertest": "^7.1.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3",
    "vitest": "^4.1.5"
  }
}
```

---

## 5. Modelo de Datos (Actual)

### Schema SQLite (src/db/database.ts)

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

-- Campañas (schema listo, no implementado)
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

-- Analytics (schema listo, no implementado)
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

- ✅ Schema normalizado correctamente
- ✅ Índices en columnas de búsqueda frecuente
- ✅ WAL mode para concurrencia
- ⚠️ `tags` como JSON string limita queries complejas → considerar tabla pivot
- ⚠️ IDs como TEXT (cuidado con colisiones en alta concurrencia)
- ⚠️ Sin foreign keys explícitas → integridad referencial a nivel aplicación
- 📋 Futuro: migración a PostgreSQL para multi-usuario

---

## 6. CLI — Comandos Disponibles

### Comunicación

| Comando | Descripción |
|---------|-------------|
| `/enviar <número> <mensaje>` | Enviar mensaje manual |
| `/historial <número>` | Ver historial de mensajes (tabla) |

### Contactos

| Comando | Descripción |
|---------|-------------|
| `/contactos` | Listar contactos (tabla formateada) |
| `/importar <archivo>` | Importar CSV/JSON/XLSX/VCF |

### Pipeline

| Comando | Descripción |
|---------|-------------|
| `/pipeline` | Ver pipeline Kanban (tablas con barras) |
| `/deal <número> [valor]` | Crear deal |
| `/mover <deal-id> <etapa>` | Mover deal entre etapas |
| `/followups` | Ver follow-ups pendientes |

### Configuración

| Comando | Descripción |
|---------|-------------|
| `/estado` | Estado completo del sistema (box + progress bars) |
| `/kb <texto>` | Actualizar knowledge base |
| `/config` | Ver configuración del bot |

### Sistema

| Comando | Descripción |
|---------|-------------|
| `/ayuda` | Mostrar ayuda |
| `/salir` | Desconectar y salir |

---

## 7. Anti-Ban System

### Warm-up de 14 días

| Día | Límite diario |
|-----|--------------|
| 1 | 10 |
| 2 | 12 |
| 3 | 15 |
| 4 | 18 |
| 5 | 22 |
| 6 | 28 |
| 7 | 35 |
| 8 | 45 |
| 9 | 55 |
| 10 | 70 |
| 11 | 85 |
| 12 | 100 |
| 13 | 120 |
| 14 | 150 |
| 15+ | 200 (máximo) |

### Gaussian Delay

```typescript
// Distribución normal: media 10s, desviación 3s
// Mínimo 5s, máximo 20s
gaussianDelay(mean = 10000, stdDev = 3000)
```

### Protecciones activas
- ✅ Typing indicator 1-3s antes de cada envío
- ✅ Pausa 2-5 min cada 10 mensajes
- ✅ Horario laboral 8:00-20:00
- ✅ Auto-stop si no hay conexión
- ✅ Warm-up persistente (archivo JSON)

---

## 8. WhatsApp — Sin Meta API

### ¿Por qué Baileys y NO Meta Cloud API?

| Aspecto | Meta Cloud API | Baileys |
|---------|---------------|---------|
| **Costo** | ~$0.05-0.08/msg | $0 |
| **Aprobación** | Business verification | No requiere |
| **Límites** | Templates pre-aprobados | Sin límites (con anti-ban) |
| **Setup** | Complejo | npm install |

### Cómo funciona

```
MejoraWS → Baileys → WhatsApp Web Protocol → Servidores WhatsApp
```

Se conecta como dispositivo multi-device (igual que WhatsApp Web/Desktop).

---

## 9. Flujo Autónomo

### Día Típico

```
08:00  Sistema se conecta automáticamente
       Anti-ban: warm-up activo (día 5/14, límite 25 msg)

08:15  Llega mensaje de "Pedro"
       → Bot detecta intención: CONSULTA
       → Genera respuesta humana con delay de 7s
       → Registra en CRM

10:00  /estado → ve sistema funcionando
       /pipeline → ve deals en movimiento

14:00  Bot responde a 5 consultas
       → 1 queja escalada a humano automáticamente

18:00  /contactos → ve contactos creciendo
       /followups → agenda pendientes

20:00  Sistema pausa envíos automáticamente
```

---

## 10. Seguridad y Cumplimiento

### Estado actual

- **Datos locales:** Todo en SQLite, no sale del servidor
- **LLM backup local:** Ollama no requiere internet
- **Sesión WhatsApp:** Encriptada localmente
- **Sin Meta API:** No hay dependencia de terceros para mensajería
- **GDPR ready:** Campo `consent` en contactos, exportación posible

### Brechas identificadas (Cybersecurity Architect + DPO)

| Brecha | Severidad | Descripción |
|--------|----------|-------------|
| Sin autenticación API | 🔴 Crítica | API REST sin auth → cualquiera puede acceder |
| Sin rate limiting API | 🔴 Crítica | Sin protección contra abuso de endpoints |
| Sesión WA sin cifrado at-rest | 🟠 Alta | `data/session/` con credenciales sin proteger |
| Sin HTTPS obligatorio | 🟠 Alta | Datos en tránsito sin cifrar |
| Sin política de retención | 🟠 Alta | Mensajes se acumulan indefinidamente |
| Sin backup automatizado | 🟡 Media | Pérdida de datos posible |
| Sin audit log | 🟡 Media | Sin trazabilidad de acciones |
| Sin privacy policy | 🟡 Media | GDPR requiere política de privacidad |
| API keys en env vars | 🟢 Baja | Aceptable para MVP, mejorar en producción |
| Sin right to erasure | 🟡 Media | GDPR requiere borrado de datos a petición |

---

## 11. Análisis Multidisciplinario (36 Roles)

### Área Técnica

#### 🏗️ Software Architect
**Estado:** ✅ Arquitectura limpia con separación de capas bien definida.

| Fortaleza | Debilidad | Recomendación |
|-----------|-----------|---------------|
| Separación clara de responsabilidades | Sin API layer para frontend | Crear `src/api/` con endpoints REST |
| Orchestrator como coordinador central | Sin dependency injection | Implementar DI para testearabilidad |
| Patrones consistentes (Manager classes) | Sin error handling middleware global | Agregar `src/api/middleware/` |
| Config centralizada | Sin logging estructurado | Implementar pino como logger |

**Plan:**
1. Extraer API REST de Express existente (ya está como dependencia)
2. Crear middleware: auth, rate-limit, error-handler, cors
3. Implementar WebSocket para tiempo real
4. Preparar inyección de dependencias para tests

#### ☁️ Cloud Architect
**Estado:** ⚠️ 100% local, sin plan de deployment.

| Aspecto | Actual | Objetivo |
|---------|--------|----------|
| Deployment | Manual | Docker + docker-compose |
| Database | SQLite (local) | PostgreSQL (prod) / SQLite (dev) |
| Cache | Ninguno | Redis para sesiones/queues |
| File storage | Local filesystem | S3-compatible para backups |
| CI/CD | Ninguno | GitHub Actions |
| Monitoring | Ninguno | Prometheus + Grafana |

**Plan:**
1. `Dockerfile` multi-stage (build + runtime)
2. `docker-compose.yml` con servicios: app, postgres, redis
3. Variables de entorno para configuración
4. Health check endpoints para orchestración

#### 💻 Backend Developer
**Estado:** ✅ Lógica de negocio sólida, falta API layer.

| Fortaleza | Debilidad | Acción |
|-----------|-----------|--------|
| Business logic bien encapsulada | Sin validación de inputs | Agregar Zod/Joi schemas |
| Transacciones DB correctas | Sin error handling centralizado | Middleware de errores |
| Código TypeScript limpio | Sin API REST endpoints | Crear rutas `/api/v1/` |
| CRUD completo en managers | Sin paginación en listados | Agregar cursor-based pagination |

**Endpoints a crear:**
```
GET    /api/v1/contacts          # Listar contactos
POST   /api/v1/contacts          # Crear contacto
GET    /api/v1/contacts/:id      # Obtener contacto
PUT    /api/v1/contacts/:id      # Actualizar contacto
DELETE /api/v1/contacts/:id      # Eliminar contacto

GET    /api/v1/deals             # Listar deals
POST   /api/v1/deals             # Crear deal
PUT    /api/v1/deals/:id/stage   # Mover etapa

GET    /api/v1/messages/:phone   # Historial
POST   /api/v1/messages/send     # Enviar mensaje

GET    /api/v1/status            # Estado del sistema
GET    /api/v1/analytics         # Datos analytics

POST   /api/v1/import            # Importar contactos
POST   /api/v1/campaigns         # Crear campaña
```

#### 🎨 Frontend Developer
**Estado:** ❌ No existe dashboard web.

**Plan para Dashboard (Next.js 14 + shadcn/ui):**

| Vista | Complejidad | Prioridad |
|-------|------------|-----------|
| Dashboard KPIs | Media | 🔴 P1 |
| Pipeline Kanban (drag & drop) | Alta | 🔴 P1 |
| Contactos (tabla + filtros) | Media | 🔴 P1 |
| Chat en tiempo real | Alta | 🟠 P2 |
| Configuración bot | Baja | 🟠 P2 |
| Importación (upload + preview) | Media | 🟡 P3 |
| Analytics (Recharts) | Media | 🟡 P3 |

**Stack:** Next.js 14, React 18, TailwindCSS, shadcn/ui, Recharts, Socket.io client

#### 📱 iOS Developer / Android Developer
**Estado:** No aplica nativamente. Acceso vía PWA responsive.

**Recomendación:** El dashboard web debe ser responsive-first. Futuro: considerar PWA con service workers para notificaciones push.

#### ⚙️ DevOps Engineer
**Estado:** ❌ Sin CI/CD, sin containerización.

**Plan inmediato:**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**Dockerfile:**
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir -p data/session
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

#### 🔒 Site Reliability Engineer (SRE)
**Estado:** ❌ Sin observabilidad.

**Plan:**
1. **Health checks:** `GET /health` con checks de DB, LLM, WhatsApp
2. **Logging estructurado:** pino con JSON output, niveles configurables
3. **Métricas:** Prometheus client para Node.js (msg/min, latencia, errores)
4. **Alertas:** Webhook a Telegram/Discord cuando el bot se desconecta
5. **Dashboard:** Grafana con panels de mensajes, deals, uptime

#### 🔐 Cybersecurity Architect
**Estado:** ⚠️ Funcional pero sin hardening de seguridad.

**Prioridades:**
1. 🔴 **JWT Auth** para API (con refresh tokens)
2. 🔴 **Rate limiting** en endpoints (express-rate-limit)
3. 🔴 **Input validation** en todos los endpoints (Zod)
4. 🟠 **HTTPS** obligatorio (Let's Encrypt + nginx reverse proxy)
5. 🟠 **Cifrado at-rest** para sesión WhatsApp
6. 🟡 **CORS** restrictivo
7. 🟡 **Helmet.js** para headers de seguridad
8. 🟡 **Audit log** de acciones sensibles

#### 📊 Data Engineer
**Estado:** ✅ Schema limpio, pipeline de importación funcional.

**Mejoras:**
1. Agregar `company` field al schema de contacts (ya existe pero no se usa mucho)
2. Crear vista materializada para analytics diarios
3. Pipeline de exportación a CSV/Excel
4. Preparar migración a PostgreSQL (usando Knex.js o Drizzle ORM)

#### 🤖 Machine Learning Engineer
**Estado:** ✅ Integración LLM funcional con fallback.

**Mejoras:**
1. **Conversation quality scoring:** Evaluar respuestas del bot automáticamente
2. **A/B testing de prompts:** Probar diferentes personalidades
3. **Sentiment tracking:** Guardar sentimiento por mensaje para analytics
4. **Intent accuracy:** Medir precisión de detección de intención
5. **Fine-tuning futuro:** Preparar dataset de conversaciones exitosas

#### 🧪 QA Automation Engineer
**Estado:** ❌ Sin tests. Crítico.

**Plan de testing:**
```
tests/
├── unit/
│   ├── antiban/
│   │   ├── warmup.test.ts
│   │   └── rate-limiter.test.ts
│   ├── crm/
│   │   ├── contacts.test.ts
│   │   └── deals.test.ts
│   ├── importer/
│   │   ├── parsers.test.ts
│   │   ├── cleaner.test.ts
│   │   └── deduplicator.test.ts
│   └── brain/
│       └── auto-reply.test.ts
├── integration/
│   ├── api/
│   │   ├── contacts.api.test.ts
│   │   └── deals.api.test.ts
│   └── whatsapp/
│       └── sender.test.ts
└── e2e/
    └── full-flow.test.ts
```

**Stack:** Vitest (unit), Supertest (API), Playwright (E2E)

#### 🗄️ Database Administrator (DBA)
**Estado:** ✅ SQLite funcional con WAL mode.

**Recomendaciones:**
1. Agregar `FOREIGN KEY` constraints para integridad referencial
2. Crear tabla de migraciones para versionado de schema
3. Implementar backup automático (cron: `sqlite3 data/mejoraws.db ".backup data/backup-$(date +%Y%m%d).db"`)
4. Preparar path de migración a PostgreSQL con ORM (Drizzle recomendado)
5. Monitorear tamaño de DB y purgar mensajes antiguos (>90 días)

---

### Área de Producto y Gestión

#### 📋 Product Manager
**Estado:** ✅ Visión clara, MVP funcional.

**KPIs a trackear:**
| KPI | Meta | Medición |
|-----|------|----------|
| Tiempo de respuesta promedio | <30s | Desde mensaje entrante hasta respuesta |
| Tasa de resolución automática | >80% | Mensajes resueltos sin escalamiento |
| Contactos importados/día | >50 | Tracking en analytics |
| Deals creados/semana | >10 | Pipeline tracking |
| Tasa de conversión deals | >15% | cerrados-ganados / total |

**User Stories prioritarias:**
1. Como admin, quiero ver KPIs en un dashboard para monitorear sin usar CLI
2. Como admin, quiero arrastrar deals entre etapas visualmente
3. Como admin, quiero crear campañas de mensajes masivos
4. Como admin, quiero ver conversaciones en tiempo real

#### 🎯 Product Owner
**Estado:** ✅ Backlog organizado.

**Acceptance Criteria para Etapa 5 (Dashboard):**
```
DADO que soy admin
CUANDO abro localhost:3000
ENTONCES veo:
  - KPIs principales (mensajes hoy, contactos, deals activos)
  - Pipeline Kanban con drag & drop
  - Últimos mensajes recibidos
  - Estado de conexión WhatsApp
  - Botón para acceder a configuración
```

#### 🏃 Scrum Master / Agile Coach
**Recomendación:** Trabajar en sprints de 1 semana.

**Ceremonias:**
- **Sprint Planning:** Lunes, definir 3-5 user stories
- **Daily:** Automatizado via estado del proyecto
- **Review:** Viernes, demo de funcionalidad
- **Retro:** Viernes, qué mejorar

**Definition of Done:**
- [ ] Código funciona sin errores
- [ ] Tests unitarios pasan
- [ ] API documentada
- [ ] Commiteado y pusheado
- [ ] Documentación actualizada

#### 🔍 UX Researcher
**Recomendación:** El usuario es el admin (Pablo). Necesita:
1. Ver estado del sistema rápido (sin comandos)
2. Gestionar contactos visualmente
3. Monitorear conversaciones del bot
4. Configurar sin editar código

**Insight:** El CLI es potente pero no discoverable. El dashboard resuelve esto.

#### 🎨 UX Designer
**Wireframes del Dashboard:**

```
┌─────────────────────────────────────────────────────────┐
│  MejoraWS Dashboard                        [Config] [?] │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ 📊 1,234 │ 📇 567   │ 🎯 89    │ 💰 $12K  │ 🤖 Bot: ON  │
│ Mensajes │ Contactos│ Deals    │ Revenue  │ WA: ✓       │
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│                                                          │
│  ┌─ PIPELINE KANBAN ──────────────────────────────────┐ │
│  │ Nuevo(12) │ Contactado(8) │ Interesado(5) │ ...    │ │
│  │ ┌──────┐  │ ┌──────┐      │ ┌──────┐     │        │ │
│  │ │Pedro │  │ │Ana   │      │ │Luis  │     │        │ │
│  │ │$500  │  │ │$1200 │      │ │$800  │     │        │ │
│  │ └──────┘  │ └──────┘      │ └──────┘     │        │ │
│  └───────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ ÚLTIMOS MENSAJES ──┐  ┌─ FOLLOW-UPS ────────────┐ │
│  │ 📩 Pedro: "Precio?" │  │ ⏰ Ana - Mañana 10:00   │ │
│  │ 📤 María: "Te envío"│  │ ⏰ Luis - Hoy 15:00     │ │
│  │ 📩 Ana: "Gracias"   │  │ ⏰ Carlos - Viernes     │ │
│  └─────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### ✍️ UX Writer
**Mejoras al CLI actual:**
- Mensajes más consistentes (todos siguen patrón emoji + acción + resultado)
- Ayuda contextual (mostrar ejemplos al usar comando incorrectamente)
- Onboarding: primer mensaje al conectar debería guiar al usuario

#### 🌍 Localization Manager
**Estado:** Solo español.

**Plan i18n:**
1. Extraer strings hardcodeados a archivo de recursos
2. Soporte inicial: español (default) + inglés
3. Usar i18next o similar para gestión de traducciones
4. Bot personality configurable por idioma

#### 📦 Delivery Manager
**Release Plan:**
| Release | Contenido | Fecha estimada |
|---------|-----------|---------------|
| v0.1.0 | CLI funcional (actual) | ✅ Completado |
| v0.2.0 | API REST + Tests básicos | Semana 1-2 |
| v0.3.0 | Dashboard web MVP | Semana 3-4 |
| v0.4.0 | Campañas automáticas | Semana 5-6 |
| v0.5.0 | Analytics + Reporting | Semana 7-8 |
| v1.0.0 | Producción (Docker + Auth) | Semana 9-10 |

---

### Área Comercial y de Crecimiento

#### 📈 Growth Manager
**Estrategia de crecimiento del producto:**
1. **Fase 1:** Uso interno, pulir el bot
2. **Fase 2:** Documentar caso de uso exitoso
3. **Fase 3:** Crear landing page con demo
4. **Fase 4:** Beta cerrada con 10 usuarios
5. **Fase 5:** Pricing model (freemium: 100 contactos gratis)

#### 📱 ASO Specialist
**No aplica** (sin app nativa). Si se crea PWA:
- Nombre: "MejoraWS - CRM WhatsApp con IA"
- Keywords: whatsapp crm, crm ia, ventas whatsapp, bot whatsapp
- Screenshots del dashboard

#### 🎯 Performance Marketing Manager
**Campañas para adquisición de usuarios:**
1. Google Ads: "CRM WhatsApp con IA desde $0"
2. Facebook/Instagram: Demo videos del bot respondiendo
3. LinkedIn: Target a emprendedores y pymes
4. YouTube: Tutorial "Cómo automatizar WhatsApp con IA"

#### 🔍 SEO Specialist
**Para landing page futura:**
- Keywords target: "crm whatsapp", "bot whatsapp ventas", "automatizar whatsapp negocio"
- Blog posts: "Cómo usar WhatsApp para ventas", "Anti-ban WhatsApp guía"
- Schema markup para software product

#### 🤝 Business Development Manager
**Oportunidades:**
1. Integración con e-commerce (Shopify, WooCommerce)
2. Partnership con agencias de marketing digital
3. API pública para developers
4. Marketplace de templates de respuestas

#### 👥 Account Manager / Community Manager
**Estrategia de comunidad:**
1. Discord server para usuarios
2. GitHub discussions para feature requests
3. Newsletter mensual con tips de WhatsApp marketing
4. Webinars de mejores prácticas

#### 📝 Content Manager
**Content plan:**
1. Blog: 2 posts/mes sobre WhatsApp marketing
2. Videos: tutoriales del dashboard
3. Templates: 50+ respuestas pre-armadas por industria
4. Case studies: historias de éxito de usuarios

---

### Área de Operaciones, Legal y Análisis

#### 📊 Business Intelligence Analyst
**KPIs a monitorear:**
| KPI | Fórmula | Meta |
|-----|---------|------|
| Tasa de respuesta automática | respuestas_bot / mensajes_totales | >80% |
| Tiempo promedio de respuesta | Σ(timestamp_respuesta - timestamp_mensaje) / n | <30s |
| Tasa de conversión pipeline | deals_ganados / deals_totales | >15% |
| Revenue por contacto | revenue_total / contactos_totales | >$50 |
| Engagement rate | respuestas_recibidas / mensajes_enviados | >25% |

#### 🔬 Data Scientist
**Análisis a implementar:**
1. **Sentiment trend:** Evolución del sentimiento promedio por semana
2. **Intent distribution:** Qué intenciones son más frecuentes
3. **Conversion funnel:** Análisis de abandono por etapa del pipeline
4. **Response effectiveness:** Qué respuestas generan más conversiones
5. **Optimal timing:** Mejor hora para enviar mensajes

#### ⚖️ Legal & Compliance Officer
**Checklist legal:**
- [ ] Privacy policy publicada
- [ ] Terms of service definidos
- [ ] Data processing agreement con LLM providers
- [ ] Consent mechanism para contactos (campo existe, no se usa activamente)
- [ ] Data retention policy (máximo 12 meses)
- [ ] Right to erasure implementado (endpoint DELETE)
- [ ] Cookie policy para dashboard web
- [ ] WhatsApp Business Policy compliance

#### 🔒 Data Protection Officer (DPO)
**GDPR Compliance Plan:**
1. **Consent:** Activar uso del campo `consent` en contactos
2. **Access:** Endpoint para que contactos vean sus datos
3. **Erasure:** Endpoint para borrar datos de un contacto
4. **Portability:** Exportar datos en formato JSON/CSV
5. **Breach notification:** Plan de respuesta a incidentes
6. **DPIA:** Data Protection Impact Assessment

#### 🎧 Customer Success Manager
**Onboarding flow:**
1. Welcome message con guía rápida
2. Setup wizard en dashboard (configurar bot personality)
3. Importar primeros contactos
4. Primer test de auto-reply
5. Check-in a los 7 días

#### 🛠️ Technical Support (Tier 1/2/3)
**Tier structure:**
- **Tier 1:** FAQ, guías de setup, troubleshooting básico
- **Tier 2:** Configuración avanzada, integraciones, bugs menores
- **Tier 3:** Bugs críticos, desarrollo de features, arquitectura

**Documentación de soporte:**
- Setup guide completo
- Troubleshooting FAQ
- API documentation
- Video tutorials

#### 💰 Revenue Operations (RevOps)
**Modelo de negocio sugerido:**
| Tier | Precio | Contactos | Features |
|------|--------|-----------|----------|
| Free | $0 | 100 | CLI, auto-reply básico |
| Pro | $29/mes | 1,000 | Dashboard, campañas, analytics |
| Business | $99/mes | 10,000 | API, multi-bot, priority support |
| Enterprise | Custom | Ilimitado | Self-hosted, SLA, custom features |

---

## 12. Plan Optimizado por Etapas

### Visión General

```
ETAPA 4: Fundación Técnica (Semana 1-2)
    ↓
ETAPA 5: Dashboard Web (Semana 3-5)
    ↓
ETAPA 6: Campañas y Automatización (Semana 6-7)
    ↓
ETAPA 7: Seguridad y Compliance (Semana 8-9)
    ↓
ETAPA 8: Escalabilidad y Producción (Semana 10-12)
    ↓
ETAPA 9: Analytics e Inteligencia (Semana 13-14)
```

---

### ETAPA 4: Fundación Técnica 🔴 CRÍTICA → ✅ COMPLETADA
**Duración:** 1 sprint | **Prioridad:** Máxima

**Objetivo:** Base técnica sólida para todo lo que viene.

| # | Tarea | Rol principal | Archivos | Estado |
|---|-------|--------------|----------|--------|
| 4.1 | API REST endpoints (17) | Backend Dev | `src/api/routes/` | ✅ |
| 4.2 | Tests unitarios (78 tests) | QA Automation | `tests/` | ✅ |
| 4.3 | Input validation (Zod) | Backend Dev | `src/api/schemas/` | ✅ |
| 4.4 | Error handling middleware | Backend Dev | `src/api/middleware/error.ts` | ✅ |
| 4.5 | Logging estructurado (pino) | SRE | `src/utils/logger.ts` | ✅ |
| 4.6 | Health check endpoint | SRE | `src/api/routes/health.ts` | ✅ |
| 4.7 | GitHub Actions CI | DevOps | `.github/workflows/ci.yml` | ✅ |
| 4.8 | Rate limiting + CORS + Helmet | Cybersecurity | `src/api/middleware/` | ✅ |

**Entregable:** API funcional con tests, CI corriendo, código formateado. ✅

---

### ETAPA 5: Dashboard Web 🟠 ALTA → ✅ COMPLETADA
**Duración:** 1 sprint | **Prioridad:** Alta

**Objetivo:** Interfaz web visual para el admin.

| # | Tarea | Rol principal | Archivos | Estado |
|---|-------|--------------|----------|--------|
| 5.1 | Setup Next.js 16 + shadcn/ui | Frontend Dev | `dashboard/` | ✅ |
| 5.2 | Auth simple (JWT + login) | Cybersecurity | `src/api/routes/auth.ts` | ✅ |
| 5.3 | Vista Dashboard (KPIs) | Frontend + BI | `dashboard/src/app/page.tsx` | ✅ |
| 5.4 | Vista Pipeline Kanban | Frontend + UX | `dashboard/src/app/pipeline/page.tsx` | ✅ |
| 5.5 | Vista Contactos (tabla) | Frontend Dev | `dashboard/src/app/contactos/page.tsx` | ✅ |
| 5.6 | Vista Chat (tiempo real) | Frontend Dev | `dashboard/src/app/chat/page.tsx` | ✅ |
| 5.7 | Vista Configuración | Frontend Dev | `dashboard/src/app/config/page.tsx` | ✅ |
| 5.8 | WebSocket para live updates | Backend Dev | Polling cada 10-15s (simplificado) | ✅ |
| 5.9 | Responsive design | UX Designer | Sidebar + mobile layout | ✅ |

**Entregable:** Dashboard funcional con 6 vistas, auth, auto-refresh. ✅

---

### ETAPA 6: Campañas y Automatización 🟠 ALTA
**Duración:** 2 semanas | **Prioridad:** Alta

**Objetivo:** Envío masivo inteligente con anti-ban.

| # | Tarea | Rol principal | Archivos | Estado |
|---|-------|--------------|----------|--------|
| 6.1 | Campaign Engine | Backend Dev | `src/campaigns/engine.ts` | ⏳ |
| 6.2 | Template rotation (anti-ban capa 6) | Backend Dev | `src/campaigns/templates.ts` | ⏳ |
| 6.3 | Programación de campañas | Backend Dev | `src/campaigns/scheduler.ts` | ⏳ |
| 6.4 | A/B testing de mensajes | ML Engineer | `src/campaigns/ab-test.ts` | ⏳ |
| 6.5 | Vista Campañas en dashboard | Frontend Dev | `dashboard/app/campaigns/` | ⏳ |
| 6.6 | Analytics de campañas | BI Analyst | `src/analytics/campaigns.ts` | ⏳ |

**Entregable:** Crear, programar y ejecutar campañas con analytics.

---

### ETAPA 7: Seguridad y Compliance 🟡 MEDIA
**Duración:** 2 semanas | **Prioridad:** Media

**Objetivo:** Hardening de seguridad y GDPR compliance.

| # | Tarea | Rol principal | Archivos | Estado |
|---|-------|--------------|----------|--------|
| 7.1 | JWT auth completo (refresh tokens) | Cybersecurity | `src/auth/` | ⏳ |
| 7.2 | Rate limiting en API | Cybersecurity | `src/api/middleware/rate-limit.ts` | ⏳ |
| 7.3 | CORS + Helmet headers | Cybersecurity | `src/api/middleware/security.ts` | ⏳ |
| 7.4 | Cifrado at-rest sesión WA | Cybersecurity | `src/whatsapp/client.ts` | ⏳ |
| 7.5 | Consent management activo | DPO | `src/crm/contacts.ts` | ⏳ |
| 7.6 | Right to erasure endpoint | DPO | `src/api/routes/gdpr.ts` | ⏳ |
| 7.7 | Data retention policy | DPO | `src/db/retention.ts` | ⏳ |
| 7.8 | Audit log | SRE | `src/db/audit.ts` | ⏳ |
| 7.9 | Privacy policy + ToS | Legal | `docs/legal/` | ⏳ |

**Entregable:** Sistema seguro, GDPR-compliant, con audit trail.

---

### ETAPA 8: Escalabilidad y Producción 🔵 MEDIA
**Duración:** 2 semanas | **Prioridad:** Media

**Objetivo:** Deploy en producción, preparar para escala.

| # | Tarea | Rol principal | Archivos | Estado |
|---|-------|--------------|----------|--------|
| 8.1 | Dockerfile multi-stage | DevOps | `Dockerfile` | ⏳ |
| 8.2 | docker-compose (app + pg + redis) | DevOps | `docker-compose.yml` | ⏳ |
| 8.3 | Migración SQLite → PostgreSQL | DBA | `src/db/migrations/` | ⏳ |
| 8.4 | Redis para cache/queues | Backend Dev | `src/utils/cache.ts` | ⏳ |
| 8.5 | Prometheus metrics | SRE | `src/utils/metrics.ts` | ⏳ |
| 8.6 | Grafana dashboard | SRE | `monitoring/` | ⏳ |
| 8.7 | Backup automatizado | DBA | `scripts/backup.sh` | ⏳ |
| 8.8 | Nginx reverse proxy + SSL | DevOps | `nginx/` | ⏳ |
| 8.9 | Deploy guide | DevOps | `docs/deploy.md` | ⏳ |

**Entregable:** Sistema deployeable en producción con monitoreo.

---

### ETAPA 9: Analytics e Inteligencia 🟢 BAJA
**Duración:** 2 semanas | **Prioridad:** Baja (futuro)

**Objetivo:** Business intelligence y optimización basada en datos.

| # | Tarea | Rol principal | Archivos | Estado |
|---|-------|--------------|----------|--------|
| 9.1 | Dashboard Analytics (Recharts) | Frontend + BI | `dashboard/app/analytics/` | ⏳ |
| 9.2 | Conversion funnel analysis | Data Scientist | `src/analytics/funnel.ts` | ⏳ |
| 9.3 | Sentiment trend tracking | ML Engineer | `src/analytics/sentiment.ts` | ⏳ |
| 9.4 | Optimal timing analysis | Data Scientist | `src/analytics/timing.ts` | ⏳ |
| 9.5 | Export reports (PDF/CSV) | Backend Dev | `src/analytics/export.ts` | ⏳ |
| 9.6 | Conversation quality scoring | ML Engineer | `src/analytics/quality.ts` | ⏳ |

**Entregable:** Analytics completo con gráficas y reportes exportables.

---

### Resumen de Prioridades

```
🔴 CRÍTICA (hacer YA):
   → API REST + Tests + CI/CD (Etapa 4)

🟠 ALTA (próximo):
   → Dashboard Web (Etapa 5)
   → Campañas automáticas (Etapa 6)

🟡 MEDIA (importante):
   → Seguridad + GDPR (Etapa 7)
   → Docker + Producción (Etapa 8)

🟢 BAJA (futuro):
   → Analytics avanzado (Etapa 9)
```

---

## 13. Registro de Avances

> **Sección actualizada con cada "documentar"**

### Estado General

| Campo | Valor |
|-------|-------|
| **Nombre** | MejoraWS |
| **Fase** | Etapa 3 completada, funcional en CLI |
| **Commits** | 20 |
| **Documentos** | 1 (este archivo consolidado) |
| **Tests** | 78 (8 archivos) |
| **Último trabajo** | Etapa 5: Dashboard Web (Next.js + shadcn/ui) |

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
| 28/04 | 03:41 | **Etapa 1-3 completada** | WhatsApp + Bot + CRM + CLI funcional |
| 28/04 | 04:01 | Auditoría UX/UI | Análisis contra trends 2026 (Medium) |
| 28/04 | 04:18 | Fix getStatus() | Bug: LLM status nunca se mostraba real |
| 28/04 | 04:18 | CLI con colores | Nuevo módulo theme.ts con ANSI codes |
| 28/04 | 04:26 | **documentar** | Consolidación de doc + fix de desfase |
| 28/04 | 05:45 | **Reestructuración mayor** | Doc unificado + análisis 36 roles + plan 9 etapas |
| 28/04 | 06:00 | **Etapa 4 completada** | API REST (17 endpoints) + 78 tests + CI/CD + logging |
| 28/04 | 06:10 | **Etapa 5 completada** | Dashboard Next.js (6 vistas) + JWT auth |

### Decisiones Técnicas

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| WhatsApp | Baileys | SIN Meta API, $0 |
| LLM primario | Groq API (qwen-2.5-32b) | Gratis, rápido |
| LLM backup | Ollama (llama3.1:8b) | Local, sin internet |
| Database | SQLite + better-sqlite3 | $0, WAL mode, sin servidor |
| CLI styling | ANSI codes nativos | Cero dependencias externas |
| Anti-ban | Gaussian delay + warmup | 6 capas (5/6 implementadas) |
| Documentación | 1 archivo consolidado | Simplicidad, trigger "documentar" |
| API Framework | Express + Zod | Ya era dependencia, Zod para validación type-safe |
| Testing | Vitest + Supertest | Rápido, nativo ESM, compatible con TypeScript |
| CI/CD | GitHub Actions | Nativo en GitHub, matrix Node 20/22 |
| Logging | Pino | JSON estructurado, bajo overhead, child loggers |
| Costo | $0 | Todo local/gratis |

### Bugs Corregidos

| Bug | Archivo | Fix |
|-----|---------|-----|
| `getStatus()` devolvía `llm: 'checking...'` hardcoded | orchestrator.ts | Ahora es async y consulta `llm.getStatus()` real |
| CLI sin colores | server.ts + 8 archivos | Nuevo theme.ts, todos los console.log usan theme |
| `config.antiBan` no se usa | config/index.ts → rate-limiter.ts | Documentado como pendiente |
| Schema SQLite sin columna `company` | database.ts | Agregada columna `company` a CREATE TABLE |
| `req.params` typing en Express 5 | routes/*.ts | Cast explícito a `string` en todos los params |

### Pendientes (Backlog)

| Prioridad | Tarea | Etapa | Estado |
|-----------|-------|-------|--------|
| 🔴 Crítica | API REST endpoints | 4 | ✅ Completada |
| 🔴 Crítica | Tests unitarios (78 tests) | 4 | ✅ Completada |
| 🔴 Crítica | CI/CD (GitHub Actions) | 4 | ✅ Completada |
| 🔴 Crítica | Logging estructurado (pino) | 4 | ✅ Completada |
| 🔴 Crítica | Zod validation | 4 | ✅ Completada |
| 🔴 Crítica | Rate limiting + error handling | 4 | ✅ Completada |
| 🟠 Alta | Dashboard web (Next.js) | 5 | ✅ Completada |
| 🟠 Alta | Campañas automáticas | 6 | ⏳ Siguiente |
| 🟠 Alta | Template rotation (anti-ban capa 6) | 6 | ⏳ Backlog |
| 🟡 Media | JWT Auth + Rate limiting | 7 | ⏳ Planificado |
| 🟡 Media | GDPR compliance | 7 | ⏳ Planificado |
| 🟡 Media | Docker + deploy | 8 | ⏳ Planificado |
| 🟢 Baja | Analytics avanzado | 9 | ⏳ Futuro |
| 🟢 Baja | i18n (es + en) | — | ⏳ Futuro |

---

## 14. Trigger: "documentar"

### Protocolo

Cuando el usuario diga **"documentar"**:

1. Leer `Documents/MEJORAWS-DOCUMENTACION.md`
2. Revisar cambios desde la última actualización (git log)
3. Actualizar sección "Registro de Avances":
   - Agregar entradas al timeline
   - Actualizar estado general
   - Actualizar decisiones técnicas
   - Actualizar pendientes
4. Si hay nuevos módulos: agregar a sección "Módulos Implementados"
5. Si cambió el schema: actualizar "Modelo de Datos"
6. Si hay nuevos comandos: actualizar "CLI"
7. Si hay nueva etapa completada: actualizar "Plan Optimizado por Etapas"
8. Commit: `docs: documentar — [resumen de cambios]`
9. Push al repo

### Instrucción para el asistente

> Cuando el usuario diga "documentar", ejecutá el protocolo de arriba.
> No preguntes qué documentar — asumí que querés actualizar TODO lo que cambió desde la última entrada del timeline.
> El commit message debe resumir los cambios en una línea.
> **IMPORTANTE:** Este es el ÚNICO documento de documentación. No crear otros archivos de doc.

---

*Última actualización: 28 abril 2026, 06:10 GMT+8*
*Etapas 1-5 completadas · Dashboard funcional con 6 vistas · Listo para Etapa 6 (Campañas)*
