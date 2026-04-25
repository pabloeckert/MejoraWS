# 📋 MejoraWS — Documentación Maestra

> **Última actualización:** 26 abril 2026
> **Repos analizados:** 64
> **Veredicto:** MVP VIABLE — Uso personal, costo mínimo $0

---

## Cómo usar este documento

Cuando digas **"documentar"**, este archivo se actualiza automáticamente con los avances realizados. Es la fuente única de verdad del proyecto.

---

# PARTE I — ANÁLISIS

## 1. Repositorios Analizados (64 total)

### Tier 1 — Core (imprescindibles para el MVP)

| Repo | Qué aporta | Reutilización |
|------|-----------|---------------|
| [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js) | Lib Node.js para WhatsApp Web (15k+ stars) | **Core del bot** — conexión WhatsApp |
| [Baileys](https://github.com/WhiskeySockets/Baileys) | WebSocket nativo, sin Chrome | Alternativa más ligera |
| [baileys-antiban](https://github.com/kobie3717/baileys-antiban) | Middleware anti-ban npm (Gaussian jitter, warmup 7d, session health) | **OBLIGATORIO** — capa anti-ban |
| [workshop-crm](https://github.com/byebye19996/workshop-crm) | CRM multi-tenant, Kanban, WhatsApp integration | Modelo de datos CRM |
| [whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) | MCP server + bridge Go, memoria local SQLite | Arquitectura bot con IA |

### Tier 2 — Referencia de alto valor

| Repo | Qué aporta |
|------|-----------|
| [WhatsApp-Campaign-Bot](https://github.com/AbdelrahmanBedo/WhatsApp-Campaign-Bot) | 6 capas anti-ban completas (Python+Selenium) |
| [WhatsApp-RPA-Chrome-Extension](https://github.com/bhumika-04/WhatsApp-RPA-Chrome-Extension) | Multi-usuario + AI auto-reply + scheduling |
| [dk1307/whatsapp-bulk-sender](https://github.com/dk1307/whatsapp-bulk-sender) | Web UI, WebSocket, anti-ban, PDF personalizado |
| [vSender](https://github.com/vyakritisoft/vSender) | Chrome Extension, queue FIFO, rate limiting con jitter |
| [wagate](https://github.com/PT-Perkasa-Pilar-Utama/wagate) | Gateway REST dual-client anti-ban |
| [whatsapp_api](https://github.com/SantiagoCTB/whatsapp_api) | Flask + API oficial de Meta |
| [SendStack](https://github.com/mohamed-arabi16/SendStack) | Multi-canal Email+WhatsApp, {{variables}}, spin syntax |
| [ossiqn/whatsapp-bulk-sender-pro](https://github.com/ossiqn/whatsapp-bulk-sender-pro) | Spintax anidado, REST API, simula typing |
| [whatsapp-bulk-sender-dashboard](https://github.com/kunaldevelopers/whatsapp-bulk-sender-dashboard) | React+Node, dashboard completo, import XLSX |
| [MedicareAI](https://github.com/mugwe88-ops/MedicareAI) | Bot IA médico + citas + WhatsApp |

### Tier 3 — Valor menor / scripts simples

35 repos de bulk senders simples (scripts sin UI, forks, repos mínimos). Todos siguen el patrón: CSV → QR → delay → send.

### ⚠️ Repos peligrosos (evitar)

| Repo | Riesgo |
|------|--------|
| zwerkenm/Muck-MASS-SMS-Sender-Whatsapp-Boomber | **MALWARE** — SMS bomber + SmartScreen bypass |
| januzzstores/JaNuzz-Store | Venta de "anti-ban panels", no es código real |

---

## 2. Patrones Consolidados

### Anti-Ban (6 capas — estándar del ecosistema)

```
Capa 1 — Template Rotation
  → 3-5 variaciones de mensaje, una aleatoria por contacto
  → Spintax: {Hola|Hola!|Hey|Buenas}
  → Sinónimos: ~15% de palabras reemplazadas

Capa 2 — Volume Control (Warm-up)
  → Día 1: 10 mensajes
  → Día 3: 30 mensajes
  → Día 7: 50 mensajes
  → Día 14+: 100-200 mensajes (máximo personal)

Capa 3 — Timing Humanization (Gaussian Jitter)
  → Delay base: 8-15 segundos
  → Jitter: ±5s con distribución Gaussiana
  → Pausa cada 10 mensajes: 2-5 minutos
  → Nunca delay fijo predecible

Capa 4 — Behavior Simulation
  → Simular "typing..." antes de enviar (1-3 seg)
  → Abrir conversación antes de escribir
  → Scroll aleatorio en chats
  → Leer mensajes pendientes ocasionalmente

Capa 5 — Failure Detection
  → Auto-stop: 5 fallos consecutivos
  → Auto-stop: >30% failure rate en últimos 20
  → Pausa 30 minutos ante primer warning
  → Alertar al usuario

Capa 6 — Contact Reputation
  → Skip números que bloquearon antes
  → No re-enviar al mismo contacto en <7 días
  → Marcar "inválidos" para no repetir
```

### Autorespuesta IA Humana

```
Principios:
1. Nunca suene a bot — usar lenguaje natural, coloquial
2. Contexto de conversaciones previas (memoria)
3. Delay humano antes de responder (3-15 seg, variable)
4. Typing indicator mientras "piensa"
5. Escalamiento inteligente a humano
6. Tono adaptable al contacto (formal/informal)

Implementación:
→ RAG con knowledge base propia
→ pgvector para memoria semántica
→ System prompt con personalidad definida
→ Histórico de conversación por contacto
→ Detección de intención → routing
→ "No sé" honesto > inventar
```

---

## 3. Viabilidad — Veredicto por Área

| Área | Viable ✅ | Con Riesgos ⚠️ | No Viable ❌ |
|------|-----------|----------------|--------------|
| Técnica | 10 | 2 | 0 |
| Producto | 9 | 2 | 0 |
| Comercial | 3 | 3 | 0 |
| Legal/Operaciones | 7 | 3 | 0 |
| **TOTAL** | **29** | **10** | **0** |

**Conclusión: VIABLE desde las 36 perspectivas evaluadas.**

---

## 4. Marco Legal

### Lo esencial para uso personal

- ✅ Solo contactos con **consentimiento explícito**
- ✅ Opción **"envía STOP"** en cada campaña
- ✅ Volumen bajo: **< 50 mensajes/día**
- ✅ Horarios humanos: **8am-10pm**
- ✅ **No scraping** de números
- ✅ Registro de consentimiento por contacto
- ⚠️ WhatsApp ToS prohíbe automatización — mitigable con bajo volumen
- ⚠️ Leyes anti-spam varían por país — siempre incluir opt-out

---

# PARTE II — ARQUITECTURA (Costo $0)

## 5. Stack de Costo Cero

Para uso personal, **todo corre en tu propia máquina**. Sin VPS, sin servicios de pago.

| Componente | Solución $0 | Alternativa pagada |
|------------|-------------|-------------------|
| **Servidor** | Tu PC/laptop (Linux/Mac/Windows) | VPS $5-12/mes |
| **Base de datos** | **SQLite** (con Prisma) | PostgreSQL $0 (también local) |
| **Cache** | **better-sqlite3** en memoria | Redis $0 (local) |
| **LLM** | **Ollama + Llama 3.1 8B** (local, gratis) | OpenAI $2-10/mes |
| **Embeddings** | **Ollama + nomic-embed-text** (local) | OpenAI $0.50-2/mes |
| **Vector DB** | **sqlite-vss** extensión SQLite | pgvector $0 |
| **Dominio** | No necesario (acceso local) | Dominio $10/año |
| **SSL** | No necesario (localhost) | Let's Encrypt $0 |
| **Email** | No necesario para MVP | — |
| **Total** | **$0** | $7-25/mes |

### Stack final $0

```
Runtime:     Node.js 20+ (gratis)
WhatsApp:    Baileys + baileys-antiban (gratis, npm)
Database:    SQLite + Prisma (gratis, local)
LLM:         Ollama + Llama 3.1 8B (gratis, local, ~5GB disco)
Embeddings:  Ollama + nomic-embed-text (gratis, local)
Vector:      sqlite-vss o almacenamiento JSON (gratis)
Frontend:    Next.js (gratis, localhost:3000)
Cola:        Bull con better-sqlite3 (gratis)
```

### Requisitos de tu máquina

```
Mínimo:
  CPU: 4 cores (para Ollama)
  RAM: 8GB (4GB para Ollama, 4GB para el resto)
  Disco: 10GB libres

Recomendado:
  CPU: 8 cores
  RAM: 16GB
  GPU: cualquier NVIDIA con 4GB+ VRAM (acelera Ollama x10)
  Disco: 20GB libres
```

---

## 6. Arquitectura del Sistema

```
┌──────────────────────────────────────────────────────────┐
│                  TU PC / LAPTOP ($0)                       │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Frontend (Next.js)                       │  │
│  │         Dashboard CRM + Marketing + Bot               │  │
│  │              localhost:3000                            │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │ HTTP/WS                          │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │              Backend (Node.js + Express)              │  │
│  │                                                      │  │
│  │  ┌────────┐ ┌─────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │Marketing│ │ CRM │ │  Bot IA  │ │  Analytics   │  │  │
│  │  │Module  │ │     │ │          │ │              │  │  │
│  │  └───┬────┘ └──┬──┘ └────┬─────┘ └──────┬───────┘  │  │
│  │      │         │         │               │          │  │
│  │  ┌───▼─────────▼─────────▼───────────────▼────────┐ │  │
│  │  │         WhatsApp Service Layer                  │ │  │
│  │  │  Baileys + baileys-antiban (6 capas)           │ │  │
│  │  └───────────────────┬────────────────────────────┘ │  │
│  └──────────────────────┼──────────────────────────────┘  │
│                         │                                  │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │                   Data Layer                         │  │
│  │  SQLite (datos) + sqlite-vss (vectores) + JSON (cola)│  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                Ollama (local, $0)                     │  │
│  │  Llama 3.1 8B (chat) + nomic-embed-text (embeddings)│  │
│  │              localhost:11434                          │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Modelo de Datos (SQLite)

```sql
-- Contactos
CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    stage TEXT DEFAULT 'lead',       -- lead|prospect|customer|churned
    consent_marketing INTEGER DEFAULT 0,
    consent_date TEXT,
    notes TEXT,
    metadata TEXT DEFAULT '{}',      -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tags
CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#3B82F6'
);

CREATE TABLE contact_tags (
    contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);

-- Pipeline de ventas
CREATE TABLE deals (
    id TEXT PRIMARY KEY,
    contact_id TEXT REFERENCES contacts(id),
    title TEXT NOT NULL,
    stage TEXT DEFAULT 'nuevo',      -- nuevo|contactado|propuesta|negociacion|cerrado-ganado|cerrado-perdido
    value REAL,
    probability INTEGER DEFAULT 10,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Actividades (log de interacciones)
CREATE TABLE activities (
    id TEXT PRIMARY KEY,
    contact_id TEXT REFERENCES contacts(id),
    deal_id TEXT REFERENCES deals(id),
    type TEXT NOT NULL,              -- message_sent|message_received|call|note|bot_interaction
    direction TEXT,                  -- inbound|outbound
    content TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Campañas de marketing
CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    message_template TEXT NOT NULL,
    media_url TEXT,
    status TEXT DEFAULT 'draft',     -- draft|scheduled|running|completed|paused
    scheduled_at TEXT,
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE campaign_contacts (
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    error TEXT,
    PRIMARY KEY (campaign_id, contact_id)
);

-- Memoria del bot (conversaciones)
CREATE TABLE bot_memory (
    id TEXT PRIMARY KEY,
    contact_id TEXT REFERENCES contacts(id),
    role TEXT NOT NULL,              -- user|assistant|system
    content TEXT NOT NULL,
    embedding TEXT,                  -- JSON array de floats
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Knowledge base del bot
CREATE TABLE bot_knowledge (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT,
    category TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Configuración del bot
CREATE TABLE bot_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,             -- JSON
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Contact reputation (anti-ban)
CREATE TABLE contact_reputation (
    phone TEXT PRIMARY KEY,
    status TEXT DEFAULT 'active',    -- active|blocked|invalid|cooldown
    last_messaged TEXT,
    fail_count INTEGER DEFAULT 0,
    block_count INTEGER DEFAULT 0,
    cooldown_until TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);
```

---

# PARTE III — PLAN POR ETAPAS

## 8. Roadmap Optimizado (Costo $0)

### Etapa 0 — Setup del Entorno (1 día)

```bash
# Instalar dependencias base (todo gratis)
# 1. Node.js 20+
# 2. Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# 3. Clonar repo
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS

# 4. Inicializar proyecto
npm init -y
npm install baileys baileys-antiban @prisma/prisma better-sqlite3
npm install next react react-dom
npm install bull ioredis
npm install ollama
```

**Entorno listo: $0**

---

### Etapa 1 — Conexión WhatsApp + Anti-Ban (Semana 1)

**Objetivo:** WhatsApp conectado con protección anti-ban activa.

```
Día 1-2: Conexión básica
  [ ] Integrar Baileys
  [ ] Integrar baileys-antiban (middleware obligatorio)
  [ ] Flujo QR de autenticación
  [ ] Guardar/restaurar sesión
  [ ] Health check de conexión
  [ ] Reconexión automática con backoff

Día 3-4: Capa anti-ban
  [ ] Gaussian jitter delays (no fijos)
  [ ] Warm-up schedule: 10→30→50→100 msg/día
  [ ] Typing simulation antes de cada envío
  [ ] Failure detection: auto-stop en cascada
  [ ] Contact reputation tracking
  [ ] Límite diario configurable

Día 5: Testing
  [ ] Test con número de prueba
  [ ] Verificar reconexión
  [ ] Verificar warm-up
  [ ] Documentar API interna
```

**Entregable:** Servicio que mantiene WhatsApp conectado con anti-ban activo.

---

### Etapa 2 — Bot IA con Autorespuesta Humana (Semana 2-3)

**Objetivo:** Bot que responde automáticamente como un humano.

```
Semana 2: LLM + Memoria
  [ ] Instalar y configurar Ollama (llama3.1:8b)
  [ ] Conectar Node.js → Ollama API (localhost:11434)
  [ ] Sistema de prompts con personalidad
  [ ] Generar embeddings con nomic-embed-text
  [ ] Almacenar conversaciones en bot_memory
  [ ] Retrieval de contexto relevante (RAG básico)

Semana 3: Comportamiento humano
  [ ] Delay antes de responder (3-15 seg, Gaussiano)
  [ ] Typing indicator mientras "piensa"
  [ ] Tono adaptable (formal/informal según contacto)
  [ ] Respuestas cortas y naturales (no walls de texto)
  [ ] "No sé" honesto cuando no tiene info
  [ ] Detección de intención (pregunta/queja/compra/saludo)
  [ ] Escalamiento a humano:
      - Palabra clave: "hablar con alguien", "agente", "persona"
      - Timeout: si no resuelve en 3 intercambios
      - Sentimiento negativo detectado
  [ ] Knowledge base: subir FAQ/productos/servicios
  [ ] Test de naturalidad (¿suena a bot o humano?)
```

**Entregable:** Bot que responde como un humano, con memoria y escalamiento.

**Prompt base del bot:**
```
Eres [nombre], asistente de [negocio]. Responde de forma natural, 
como lo haría una persona real por WhatsApp. Sé breve, usa lenguaje 
coloquial cuando sea apropiado. Si no sabes algo, di "déjame consultar 
y te confirmo". Si el cliente necesita hablar con una persona, di 
"te paso con [nombre humano] que te puede ayudar mejor".

Contexto del contacto: {{contact_info}}
Historial reciente: {{recent_messages}}
Knowledge base relevante: {{rag_context}}
```

---

### Etapa 3 — CRM Básico (Semana 3-4)

**Objetivo:** Ver contactos, pipeline y actividades.

```
Semana 3 (paralelo con Bot):
  [ ] Schema Prisma + SQLite
  [ ] CRUD contactos
  [ ] Sistema de tags
  [ ] Registro automático de actividades
  [ ] Búsqueda y filtrado

Semana 4:
  [ ] Pipeline Kanban (deals)
  [ ] Movimiento entre etapas
  [ ] Frontend Next.js:
      - Lista de contactos con filtros
      - Kanban board del pipeline
      - Detalle de contacto + historial
      - Dashboard con métricas
```

**Entregable:** Dashboard web con CRM funcional.

---

### Etapa 4 — Marketing Module (Semana 4-5)

**Objetivo:** Campañas de envío masivo con anti-ban integrado.

```
Semana 4 (paralelo con CRM):
  [ ] Modelo campaigns + campaign_contacts
  [ ] Crear campaña con template
  [ ] CSV parser + validación de teléfonos
  [ ] Template engine: {{nombre}}, {{empresa}}, etc.
  [ ] Spintax: {Hola|Hola!|Hey}

Semana 5:
  [ ] Cola de envío (Bull/BullMQ)
  [ ] Rate limiting integrado con anti-ban (6 capas)
  [ ] Tracking: enviado → entregado → leído
  [ ] Frontend:
      - Crear/editar campañas
      - Importar CSV
      - Preview antes de enviar
      - Estadísticas de campaña
      - Historial de envíos
```

**Entregable:** Sistema de campañas con anti-ban completo.

---

### Etapa 5 — Integración y Polish (Semana 5-6)

**Objetivo:** Todo funciona junto, estable, usable.

```
  [ ] Flujo completo: mensaje → bot responde → CRM registra
  [ ] Campañas: envío → tracking → métricas
  [ ] Notificaciones de desconexión de WhatsApp
  [ ] Backup automático de SQLite
  [ ] Manejo robusto de errores
  [ ] Responsive design del dashboard
  [ ] Documentación de uso personal
  [ ] Test de 24h de estabilidad
```

**Entregable:** MVP completo y funcional.

---

## 9. Diagrama de Flujo del Bot IA

```
Mensaje entrante de WhatsApp
         │
         ▼
┌─────────────────────┐
│  ¿Es comando manual? │──── Sí ──── Ejecutar comando
│  (!help, !stop, etc) │
└─────────┬───────────┘
          │ No
          ▼
┌─────────────────────┐
│  Recuperar contexto  │
│  - Info del contacto │
│  - Historial reciente│
│  - RAG knowledge base│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Generar respuesta   │
│  con Ollama (local)  │
│  - Personalidad      │
│  - Contexto          │
│  - Tono adecuado     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  ¿Requiere humano?   │──── Sí ──── Escalar con contexto
│  - Palabra clave     │
│  - 3 intercambios    │
│  - Sentimiento neg.  │
└─────────┬───────────┘
          │ No
          ▼
┌─────────────────────┐
│  Delay humano (Gauss)│
│  3-15 segundos       │
│  + typing indicator  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Enviar respuesta    │
│  Guardar en memoria  │
│  Registrar actividad │
└─────────────────────┘
```

---

## 10. Comandos del Bot

| Comando | Acción |
|---------|--------|
| `!ayuda` | Lista de comandos |
| !`stop` | Pausar bot para este contacto |
| `!humano` | Escalar a persona real |
| `!info` | Info del contacto registrada |
| `!estado` | Estado del bot (activo/pausado) |
| `!campaña` | Última campaña enviada |

**Todo mensaje que NO empiece con !** → Lo procesa el bot IA.

---

## 11. Checklist Anti-Ban (implementar en Etapa 1)

```
CONEXIÓN:
  [ ] baileys-antiban como middleware obligatorio
  [ ] Session health monitoring activo
  [ ] Disconnect classification habilitada
  [ ] Reconexión con backoff exponencial

ENVÍO:
  [ ] Gaussian jitter en TODOS los delays
  [ ] Warm-up: empezar en 10, subir gradualmente
  [ ] Typing simulation (1-3 seg antes de enviar)
  [ ] Pausa cada 10 mensajes (2-5 min)
  [ ] Horarios: solo 8am-10pm
  [ ] Límite diario: 50-200 (configurable)

MENSAJES:
  [ ] Spintax o templates rotativos
  [ ] Nunca mensaje idéntico a 2 contactos
  [ ] Personalización con nombre
  [ ] Sin links en primer mensaje

PROTECCIÓN:
  [ ] Auto-stop: 5 fallos consecutivos
  [ ] Auto-stop: >30% failure rate
  [ ] Contact reputation tracking
  [ ] Skip números bloqueados/inválidos
  [ ] No re-enviar a mismo contacto en <7 días
  [ ] Modo dry-run para testing
```

---

## 12. Costos Anuales

| Escenario | Costo/año |
|-----------|-----------|
| **$0 Total** (tu PC + Ollama) | **$0** |
| VPS barato (si necesitas 24/7) | $54/año (Hetzner $4.50/mes) |
| Con OpenAI en vez de Ollama | $24-120/año |

**Recomendación:** Empezar con $0 (tu PC). Si necesitas 24/7, Hetzner a $4.50/mes.

---

## 13. Próximos Pasos Inmediatos

```bash
# 1. Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Descargar modelos (~5GB total)
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# 3. Verificar que funciona
ollama run llama3.1:8b "Hola, ¿cómo estás?"

# 4. Clonar el proyecto
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS

# 5. Instalar dependencias Node.js
npm init -y
npm install baileys baileys-antiban @whiskeysockets/baileys
npm install better-sqlite3 prisma
npm install next react react-dom
npm install express socket.io

# 6. Empezar Etapa 1
# (crear carpeta src/ y comenzar)
```

---

## 14. Registro de Avances

> Este sección se actualiza cuando digas **"documentar"**

| Fecha | Etapa | Avance | Notas |
|-------|-------|--------|-------|
| 26/04/2026 | Setup | Documentación completa, 64 repos analizados, repo GitHub creado | — |

---

*Documento maestro — se actualiza con cada "documentar"*
*Repo: https://github.com/pabloeckert/MejoraWS*
