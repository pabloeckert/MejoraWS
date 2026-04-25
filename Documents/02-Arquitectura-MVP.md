# 02 — Arquitectura del MVP

## Visión General

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Web UI)                     │
│         Dashboard CRM + Marketing + Analytics            │
│              React/Next.js + TailwindCSS                 │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                   BACKEND (API Server)                    │
│                    Node.js + Express                      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Marketing │  │   CRM    │  │  Bot IA  │  │Analytics│ │
│  │  Module   │  │  Module  │  │  Module  │  │ Module  │ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └────┬────┘ │
│        │             │             │             │       │
│  ┌─────▼─────────────▼─────────────▼─────────────▼────┐ │
│  │              WhatsApp Service Layer                  │ │
│  │         (whatsapp-web.js / Baileys)                  │ │
│  └──────────────────────┬──────────────────────────────┘ │
└─────────────────────────┬────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│                    DATA LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  PostgreSQL   │  │    Redis     │  │ Vector Store   │ │
│  │  (principal)  │  │   (cache)    │  │  (IA memory)   │ │
│  └──────────────┘  └──────────────┘  └────────────────┘ │
└──────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│                 EXTERNAL SERVICES                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  OpenAI API   │  │  WhatsApp    │  │  n8n / Cron    │ │
│  │  (GPT/Claude) │  │  Cloud API   │  │  (Workflows)   │ │
│  └──────────────┘  └──────────────┘  └────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Stack Tecnológico Recomendado

### Backend
| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| Runtime | **Node.js 20+** | Ecosistema rico, whatsapp-web.js es Node |
| Framework | **Express.js** o **Fastify** | Ligero, rápido, bien documentado |
| ORM | **Prisma** | Type-safe, migraciones fáciles |
| WhatsApp | **whatsapp-web.js** | Más maduro, mejor documentado |
| Cola de mensajes | **BullMQ** (Redis) | Para envíos masivos escalonados |
| WebSockets | **Socket.IO** | Updates en tiempo real al dashboard |

### Frontend
| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| Framework | **Next.js 14+** | SSR, API routes, bien estructurado |
| UI | **TailwindCSS + shadcn/ui** | Rápido de construir, profesional |
| State | **Zustand** | Ligero, simple |
| Charts | **Recharts** | Para analytics |
| Tables | **TanStack Table** | Para listados de contactos |

### Base de Datos
| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| Principal | **PostgreSQL** | Robusto, JSON support, full-text search |
| Cache | **Redis** | Sesiones WhatsApp, cola de mensajes |
| Vector DB | **pgvector** (extensión PG) | Para memoria del bot IA sin DB extra |

### IA
| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| LLM | **OpenAI GPT-4o-mini** | Bueno y económico para chat |
| Embeddings | **OpenAI text-embedding-3-small** | Para búsqueda semántica |
| Framework | **LangChain.js** | Chains, memory, tools |
| Memoria | **pgvector** en PostgreSQL | Embeddings de conversaciones previas |

---

## Módulos del Sistema

### 1. Módulo WhatsApp Connection
```
Responsabilidad: Gestionar la conexión con WhatsApp
Dependencias: whatsapp-web.js

Funciones:
- initClient()        → Inicializar conexión
- onQR()              → Generar QR para escaneo
- onReady()           → Confirmar conexión activa
- sendMessage()       → Enviar mensaje individual
- sendBulkMessages()  → Envío masivo con rate limiting
- onMessage()         → Recibir y procesar mensajes entrantes
- getChats()          → Listar chats activs
- getContact()        → Obtener info de contacto
```

### 2. Módulo CRM
```
Responsabilidad: Gestionar contactos, pipeline y ventas
Dependencias: PostgreSQL, Prisma

Modelos de datos:
- Contact: { id, phone, name, email, tags[], notes, stage, createdAt }
- Deal: { id, contactId, stage, value, probability, notes }
- Activity: { id, contactId, type, content, createdAt }
- Tag: { id, name, color }

Endpoints:
- GET/POST /api/contacts
- GET/PUT /api/contacts/:id
- GET/POST /api/deals
- PUT /api/deals/:id/stage
- GET /api/pipeline (Kanban view)
- GET /api/activities
```

### 3. Módulo Marketing
```
Responsabilidad: Campañas de mensajes masivos
Dependencias: WhatsApp Service, BullMQ, CRM

Funciones:
- createCampaign()      → Crear campaña con template
- scheduleCampaign()    → Programar envío
- sendCampaign()        → Ejecutar envío escalonado
- getCampaignStats()    → Métricas de campaña
- segmentContacts()     → Filtrar por tags/etapa

Endpoints:
- GET/POST /api/campaigns
- POST /api/campaigns/:id/send
- GET /api/campaigns/:id/stats
```

### 4. Módulo Bot IA
```
Responsabilidad: Responder automáticamente con IA
Dependencias: OpenAI API, pgvector, CRM

Funciones:
- processIncomingMessage()  → Analizar mensaje entrante
- generateResponse()        → Generar respuesta con contexto
- updateMemory()            → Guardar en vector store
- learnFromConversation()   → Extraer insights
- routeToHuman()            → Escalar a humano si necesario

Endpoints:
- GET/PUT /api/bot/config
- GET /api/bot/conversations
- POST /api/bot/train (knowledge base)
```

### 5. Módulo Analytics
```
Responsabilidad: Métricas y reportes
Dependencias: CRM, Marketing, WhatsApp

Funciones:
- getDashboard()        → Resumen general
- getMessageMetrics()   → Enviados/recibidos/leídos
- getContactGrowth()    → Crecimiento de contactos
- getCampaignROI()      → ROI por campaña
- getBotMetrics()       → Conversaciones del bot, satisfacción

Endpoints:
- GET /api/analytics/dashboard
- GET /api/analytics/messages
- GET /api/analytics/campaigns
```

---

## Modelo de Datos (PostgreSQL)

```sql
-- Contactos
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    stage VARCHAR(50) DEFAULT 'lead',  -- lead, prospect, customer, churned
    consent_marketing BOOLEAN DEFAULT false,
    consent_date TIMESTAMP,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tags
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6'
);

-- Contact-Tag relación
CREATE TABLE contact_tags (
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);

-- Deals (Pipeline)
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id),
    title VARCHAR(255) NOT NULL,
    stage VARCHAR(50) DEFAULT 'nuevo',  -- nuevo, contactado, propuesta, negociacion, cerrado-ganado, cerrado-perdido
    value DECIMAL(12,2),
    probability INTEGER DEFAULT 10,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Actividades
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id),
    deal_id UUID REFERENCES deals(id),
    type VARCHAR(50) NOT NULL,  -- message_sent, message_received, call, note, bot_interaction
    direction VARCHAR(10),  -- inbound, outbound
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Campañas
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    message_template TEXT NOT NULL,
    media_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'draft',  -- draft, scheduled, running, completed, paused
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Campaign-Contact relación
CREATE TABLE campaign_contacts (
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, sent, delivered, read, failed
    sent_at TIMESTAMP,
    error TEXT,
    PRIMARY KEY (campaign_id, contact_id)
);

-- Configuración del Bot
CREATE TABLE bot_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Memoria del Bot (embeddings)
CREATE TABLE bot_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id),
    conversation_id VARCHAR(255),
    role VARCHAR(20) NOT NULL,  -- user, assistant, system
    content TEXT NOT NULL,
    embedding VECTOR(1536),  -- pgvector
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge Base del Bot
CREATE TABLE bot_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Seguridad

### Autenticación
- JWT tokens para el dashboard
- API keys para integraciones externas
- Rate limiting en todos los endpoints

### Datos
- Encriptación en tránsito (TLS)
- PostgreSQL encriptado at-rest
- Variables de entorno para secrets (nunca en código)
- Backups automáticos diarios

### WhatsApp
- Sesión encriptada almacenada localmente
- No compartir credenciales
- Rate limiting para evitar bans

---

## Deployment

### Opción 1: VPS (Recomendado para uso personal)
```
Proveedor: DigitalOcean / Hetzner / Contabo
Specs mínimas: 2 vCPU, 4GB RAM, 80GB SSD
OS: Ubuntu 22.04 LTS
Costo: ~$5-12/mes

Stack:
- Docker + Docker Compose
- Nginx reverse proxy
- Let's Encrypt SSL
- PostgreSQL en contenedor
- Redis en contenedor
```

### Opción 2: Local (Desarrollo)
```
- Docker Desktop
- Node.js 20+
- PostgreSQL local
- Redis local
```

### Docker Compose (referencia)
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mejoraws
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - db
      - redis
    volumes:
      - ./whatsapp-session:/app/whatsapp-session

  db:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_DB=mejoraws
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/letsencrypt

volumes:
  pgdata:
  redisdata:
```
