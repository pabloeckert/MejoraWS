# 📚 DOCUMENTACIÓN CONSOLIDADA — MejoraWS

> **Trigger:** Cuando digas **"documentar"**, este archivo se actualiza con los trabajos realizados.
> **Última actualización:** 28 abril 2026, 04:26 GMT+8

---

## ÍNDICE

1. [Visión y Estado Actual](#1-visión-y-estado-actual)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Módulos Implementados](#3-módulos-implementados)
4. [Stack Técnico (Real)](#4-stack-técnico-real)
5. [Modelo de Datos (Actual)](#5-modelo-de-datos-actual)
6. [CLI — Comandos Disponibles](#6-cli--comandos-disponibles)
7. [Anti-Ban System](#7-anti-ban-system)
8. [WhatsApp — Sin Meta API](#8-whatsapp--sin-meta-api)
9. [Flujo Autónomo](#9-flujo-autónomo)
10. [Seguridad y Cumplimiento](#10-seguridad-y-cumplimiento)
11. [Plan por Etapas](#11-plan-por-etapas)
12. [Registro de Avances](#12-registro-de-avances)
13. [Trigger: "documentar"](#13-trigger-documentar)

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
| Dashboard web | ❌ No implementado | **Siguiente etapa** |
| Campañas automáticas | ❌ No implementado | Backlog |
| Analytics visual | ❌ No implementado | Backlog |

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

### Estructura de Archivos

```
MejoraWS/
├── src/
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
│   └── server.ts                # Entry point + CLI
├── Documents/
│   ├── 01-DOCUMENTACION-CONSOLIDADA.md  # Este archivo
│   └── PROMPT.md                        # Prompt de continuidad
├── data/                        # Datos runtime (gitignored)
│   ├── mejoraws.db              # SQLite database
│   ├── session/                 # Sesión WhatsApp
│   └── warmup.json              # Estado warm-up
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
| **CLI** | readline + ANSI codes | $0 | Sin dependencias externas |
| **Import** | xlsx + papaparse | $0 | CSV/Excel/VCF/JSON |
| **Server** | Express | $0 | Listo para API REST |

### Dependencias (package.json)

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.16",
    "better-sqlite3": "^11.9.1",
    "express": "^4.21.2",
    "groq-sdk": "^1.1.2",
    "papaparse": "^5.5.3",
    "pino": "^9.6.0",
    "uuid": "^14.0.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/express": "^5.0.2",
    "@types/node": "^24.0.4",
    "@types/papaparse": "^5.5.2",
    "@types/uuid": "^10.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3"
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

### CLI Theme (src/cli/theme.ts)

El CLI usa ANSI codes nativos (sin dependencias) para:
- Colores por contexto (verde=ok, rojo=error, amarillo=warning, cyan=info)
- Tablas con headers, separadores y alignment
- Progress bars visuales (`███░░░ 60%`)
- Box drawing decorativo para secciones importantes
- Status indicators con emoji + color

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

- **Datos locales:** Todo en SQLite, no sale del servidor
- **LLM backup local:** Ollama no requiere internet
- **Sesión WhatsApp:** Encriptada localmente
- **Sin Meta API:** No hay dependencia de terceros para mensajería
- **GDPR ready:** Campo `consent` en contactos, exportación posible

---

## 11. Plan por Etapas

### Estado de cada etapa

| Etapa | Días | Entregable | Estado |
|-------|------|-----------|--------|
| **1** | 1-3 | WhatsApp + envío/recepción + anti-ban | ✅ COMPLETADA |
| **2** | 4-7 | Bot IA auto-reply + orchestrator | ✅ COMPLETADA |
| **3** | 8-12 | CRM + importador + pipeline | ✅ COMPLETADA |
| **4** | 13-17 | Campañas automáticas | ⏳ Backlog |
| **5** | 18-22 | Dashboard web (React/Next.js) | ⏳ **SIGUIENTE** |
| **6** | 23-28 | Sistema 100% autónomo | ⏳ Backlog |

### Etapa 5: Dashboard Web (Plan)

**Objetivo:** Dashboard visual con KPIs, pipeline Kanban drag & drop, chat view en tiempo real.

**Stack:**
- Next.js 14 + React 18
- TailwindCSS + shadcn/ui
- Recharts para gráficas
- WebSocket para tiempo real
- API REST desde Express existente

**Vistas:**
1. **Dashboard** — KPIs principales, gráficas de mensajes/envíos
2. **Pipeline** — Kanban visual drag & drop
3. **Contactos** — Tabla con búsqueda, filtros, detalle
4. **Chat** — Vista de conversaciones en tiempo real
5. **Config** — Knowledge base, bot personality, horarios
6. **Import** — Upload y preview de importación
7. **Analytics** — Gráficas de conversión, sentimiento, ROI

---

## 12. Registro de Avances

> **Sección actualizada con cada "documentar"**

### Estado General

| Campo | Valor |
|-------|-------|
| **Nombre** | MejoraWS |
| **Fase** | Etapa 3 completada, funcional en CLI |
| **Commits** | 10 |
| **Documentos** | 2 (este + PROMPT.md) |
| **Último trabajo** | Fix getStatus() + CLI con colores ANSI |

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

### Decisiones Técnicas

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| WhatsApp | Baileys | SIN Meta API, $0 |
| LLM primario | Groq API (qwen-2.5-32b) | Gratis, rápido |
| LLM backup | Ollama (llama3.1:8b) | Local, sin internet |
| Database | SQLite + better-sqlite3 | $0, WAL mode, sin servidor |
| CLI styling | ANSI codes nativos | Cero dependencias externas |
| Anti-ban | Gaussian delay + warmup | 6 capas (5/6 implementadas) |
| Costo | $0 | Todo local/gratis |

### Bugs Corregidos

| Bug | Archivo | Fix |
|-----|---------|-----|
| `getStatus()` devolvía `llm: 'checking...'` hardcoded | orchestrator.ts | Ahora es async y consulta `llm.getStatus()` real |
| CLI sin colores | server.ts + 8 archivos | Nuevo theme.ts, todos los console.log usan theme |
| `config.antiBan` no se usa | config/index.ts → rate-limiter.ts | Documentado como pendiente |

### Pendientes (Backlog)

| Prioridad | Tarea | Estado |
|-----------|-------|--------|
| 🔴 Alta | Dashboard web (Next.js) | ⏳ Siguiente etapa |
| 🔴 Alta | Config anti-ban integrado con config.ts | ⏳ Pendiente |
| 🟠 Media | Campañas automáticas (Módulo 2) | ⏳ Backlog |
| 🟠 Media | Template rotation (anti-ban capa 6) | ⏳ Backlog |
| 🟠 Media | Tests unitarios e integración | ⏳ Backlog |
| 🟡 Baja | Analytics y gráficas | ⏳ Backlog |
| 🟡 Baja | Orchestrator autónomo (campañas auto) | ⏳ Backlog |

---

## 13. Trigger: "documentar"

### Protocolo

Cuando el usuario diga **"documentar"**:

1. Leer `Documents/01-DOCUMENTACION-CONSOLIDADA.md`
2. Revisar cambios desde la última actualización (git log)
3. Actualizar sección "Registro de Avances":
   - Agregar entradas al timeline
   - Actualizar estado general
   - Actualizar decisiones técnicas
   - Actualizar pendientes
4. Si hay nuevos módulos: agregar a sección "Módulos Implementados"
5. Si cambió el schema: actualizar "Modelo de Datos"
6. Si hay nuevos comandos: actualizar "CLI"
7. Commit: `docs: documentar — [resumen de cambios]`
8. Push al repo

### Instrucción para el asistente

> Cuando el usuario diga "documentar", ejecutá el protocolo de arriba.
> No preguntes qué documentar — asumí que querés actualizar TODO lo que cambió desde la última entrada del timeline.
> El commit message debe resumir los cambios en una línea.

---

*Última actualización: 28 abril 2026, 04:26 GMT+8*
*Etapas 1-3 completadas · CLI funcional con colores · Listo para Etapa 5 (Dashboard)*
