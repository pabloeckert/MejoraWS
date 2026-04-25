# 🚀 PROPUESTA: MejoraWS — CRM WhatsApp Autónomo con IA

> **Fecha:** 26 abril 2026
> **Repos analizados:** 89+ (incluye MejoraContactos)
> **Costo:** $0 (100% gratis)
> **Filosofía:** El admin configura parámetros → la IA hace todo → devuelve logs, KPIs y gráficas

---

## VISIÓN

Una aplicación **100% autónoma** donde el administrador solo define:
1. **Quiénes son sus contactos** (CSV/import)
2. **Qué vende o ofrece** (knowledge base)
3. **Reglas de negocio** (parámetros)
4. **Objetivos** (métricas esperadas)

La IA se encarga del resto:
- Responde automáticamente como un humano
- Crea y envía campañas de marketing
- Gestiona el pipeline de ventas
- Genera contenido variado (anti-ban)
- Programa seguimientos
- Reporta KPIs y gráficas

---

## ARQUITECTURA: Cómo se conecta todo

```
┌─────────────────────────────────────────────────────────────────┐
│                    PANEL DEL ADMIN (Next.js)                     │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Dashboard │ │📥Importar│ │  CRM     │ │Marketing │ │ Configuración IA  │  │
│  │ KPIs     │ │Contactos │ │Contactos │ │Campañas  │ │ Parámetros/Reglas │  │
│  │ Gráficas │ │Mejora    │ │Pipeline  │ │Templates │ │ Knowledge Base    │  │
│  │          │ │Contactos │ │          │ │          │ │                   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬──────────┘  │
│       │             │            │                 │             │
│  ┌────▼─────────────▼────────────▼─────────────────▼──────────┐ │
│  │                    MOTOR CENTRAL (Node.js)                  │ │
│  │                                                             │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │            🧠 CEREBRO IA (Autonomous Engine)         │   │ │
│  │  │                                                      │   │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │   │ │
│  │  │  │ Auto-Reply │  │ Campaign   │  │  Sales        │  │   │ │
│  │  │  │ Engine     │  │ Generator  │  │  Pipeline AI  │  │   │ │
│  │  │  │            │  │            │  │               │  │   │ │
│  │  │  │ - Intención│  │ - Crear msg│  │ - Mover leads │  │   │ │
│  │  │  │ - Contexto │  │ - Spintax  │  │ - Follow-ups  │  │   │ │
│  │  │  │ - Tono     │  │ - Schedule │  │ - Priorizar   │  │   │ │
│  │  │  │ - Escalar  │  │ - Segmentar│  │ - Cerrar      │  │   │ │
│  │  │  └─────┬──────┘  └─────┬──────┘  └──────┬───────┘  │   │ │
│  │  │        │               │                 │          │   │ │
│  │  │  ┌─────▼───────────────▼─────────────────▼───────┐  │   │ │
│  │  │  │         Anti-Ban Engine (6 capas)              │  │   │ │
│  │  │  │  Template Rotation │ Warm-up 14d │ Gaussian    │  │   │ │
│  │  │  │  Typing Sim        │ Fail Detect │ Reputation  │  │   │ │
│  │  │  └───────────────────────┬────────────────────────┘  │   │ │
│  │  └──────────────────────────┼────────────────────────────┘   │ │
│  │                              │                                │ │
│  │  ┌───────────────────────────▼────────────────────────────┐  │ │
│  │  │          WhatsApp Connection Layer                      │  │ │
│  │  │  Baileys + baileys-antiban (multi-device)              │  │ │
│  │  └───────────────────────────┬────────────────────────────┘  │ │
│  └──────────────────────────────┼────────────────────────────────┘ │
│                                  │                                  │
│  ┌───────────────────────────────▼──────────────────────────────┐  │
│  │                     Data Layer (SQLite $0)                    │  │
│  │  contacts │ deals │ campaigns │ activities │ bot_memory       │  │
│  │  templates │ reputation │ analytics │ knowledge_base         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  LLM Layer ($0)                                │  │
│  │  Ollama (local) + Groq API free tier (cloud fallback)        │  │
│  │  Llama 3.1 8B + nomic-embed-text                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## LOS 6 MÓDULOS AUTÓNOMOS

### Módulo 0: 📥 Importador de Contactos (MejoraContactos)

**Qué hace:** Importa, limpia, deduplica y valida contactos desde cualquier fuente antes de que la IA los use.

**Integración con [MejoraContactos](https://github.com/pabloeckert/MejoraContactos):**

MejoraContactos es un proyecto existente del mismo equipo (ya en producción en util.mejoraok.com). Se integra como **pipeline de importación** de MejoraWS.

**Fuentes soportadas:**
```
CSV          → Auto-detección de columnas (ES/EN)
Excel (.xlsx)→ Múltiples hojas, headers variables
VCF (vCard)  → Contactos de celular/Google
JSON         → Estructura flexible
Google Contacts → OAuth multi-cuenta
```

**Pipeline de limpieza (de MejoraContactos):**
```
1. Auto-detección de columnas
   → "nombre"/"name"/"Nombre completo" → campo: name
   → "teléfono"/"phone"/"celular" → campo: phone
   → "email"/"correo" → campo: email

2. Limpieza determinística (80%+)
   → Trim whitespace, normalizar mayúsculas
   → Remover caracteres especiales
   → Formatear teléfonos a E.164

3. Validación con IA (20% restante)
   → Scoring semántico 0-100 por campo
   → Correcciones automáticas
   → Detección de datos inválidos

4. Deduplicación
   → Email/teléfono exacto O(1)
   → Nombre con Jaro-Winkler acotado
   → Merge inteligente de duplicados

5. Detección WhatsApp
   → Verifica si el número tiene WhatsApp
   → Formatos AR/MX/ES automáticamente
   → Marca: tiene_whatsapp: true/false

6. Exportación a MejoraWS
   → Contactos limpios → tabla contacts
   → Tags automáticos por fuente
   → consent_marketing: false (por defecto)
```

**El admin configura:**
```json
{
  "fuentes": ["csv", "google_contacts"],
  "limpieza": {
    "auto_detectar_columnas": true,
    "normalizar_telefonos": "E.164",
    "deduplicar": true,
    "validar_whatsapp": true
  },
  "tags_auto": {
    "por_fuente": true,
    "por_pais": true,
    "por_calidad_score": true
  }
}
```

**La IA hace:**
1. Auto-detecta formato y columnas del archivo
2. Limpia y normaliza todos los datos
3. Deduplica (encuentra repetidos)
4. Valida teléfonos → E.164
5. Verifica presencia en WhatsApp
6. Scoring de calidad (0-100) por contacto
7. Asigna tags automáticos
8. Importa a la base de datos de MejoraWS
9. Reporta: "500 contactos importados, 23 duplicados eliminados, 412 con WhatsApp"

**Referencia técnica:**
- **MejoraContactos** (pabloeckert) → pipeline completo de importación/limpieza
- React 18 + Vite + TypeScript + shadcn/ui
- 12 proveedores IA con rotación automática
- 174 tests, CI/CD, producción

**Integración técnica:**
```javascript
// Opción A: Importar como módulo npm (recomendado)
import { ContactPipeline } from '@mejora/contactos';

// Opción B: API REST (si se miente separado)
const cleanContacts = await fetch('https://util.mejoraok.com/mejoracontactos/api/clean', {
  method: 'POST',
  body: formData
});

// Opción C: Reusar lógica core directamente
// Copiar src/lib/ de MejoraContactos a MejoraWS/src/importer/
```

**Flujo completo de importación:**
```
Admin sube archivo (CSV/Excel/VCF/JSON)
        ↓
Auto-detección de columnas
        ↓
Limpieza determinística (80%)
        ↓
Validación IA (scoring 0-100)
        ↓
Deduplicación (exacto + fuzzy)
        ↓
Detección WhatsApp
        ↓
Tags automáticos
        ↓
Import a tabla contacts de MejoraWS
        ↓
Listo para campañas y bot IA
```

---

### Módulo 1: 🤖 Auto-Reply Engine (Chat Bot IA)

**Qué hace:** Responde automáticamente TODOS los mensajes entrantes como un humano.

**El admin configura:**
```json
{
  "nombre_bot": "María",
  "tono": "profesional-cercano",
  "idioma": "español",
  "horario": "8:00-20:00",
  "escalamiento": {
    "palabras_clave": ["hablar con alguien", "agente", "urgente"],
    "max_intercambios": 3,
    "sentimiento_negativo": true
  },
  "personalidad": "Soy María, asesora de ventas. Respondo de forma clara y amable."
}
```

**La IA hace:**
1. Detecta intención (pregunta/queja/compra/saludo/soporte)
2. Recupera contexto del contacto (historial + knowledge base)
3. Genera respuesta humana con tono adecuado
4. Aplica delay humano (3-15s Gaussiano) + typing indicator
5. Registra en CRM automáticamente
6. Escala a humano si es necesario
7. Aprende de cada interacción (memoria semántica)

**Referencia técnica:**
- whatsapp-mcp → arquitectura de memoria
- wa-sender-pro → Groq AI para respuestas
- whatsapp-ai-platform → multi-tenant agents
- Car-and-Gen → RAG con vector store
- StayIQ → asistente WhatsApp con tareas

---

### Módulo 2: 📣 Campaign Generator (Marketing autónomo)

**Qué hace:** Crea, programa y envía campañas de marketing sin intervención manual.

**El admin configura:**
```json
{
  "objetivo": "promocionar_producto",
  "producto": "Curso de Marketing Digital",
  "audiencia": {
    "tags": ["lead", "interesado-marketing"],
    "excluir_tags": ["cliente", "no-interesado"],
    "max_contactos": 100
  },
  "frecuencia": "2 por semana",
  "horario_envio": "10:00-12:00",
  "tono": "informal-entusiasta",
  "incluir_media": true,
  "cta": "Respondé INFO para más detalles"
}
```

**La IA hace:**
1. Genera 5-10 variaciones del mensaje (spintax + sinónimos)
2. Personaliza con {{nombre}}, {{empresa}}, etc.
3. Selecciona el mejor horario según engagement previo
4. Aplica anti-ban (6 capas) automáticamente
5. Envía en lotes con warm-up progresivo
6. Trackea: enviado → entregado → leído → respondió
7. Ajusta estrategia según resultados
8. Reporta métricas en dashboard

**Referencia técnica:**
- dk1307/whatsapp-bulk-sender → Web UI + WebSocket
- vSender → queue FIFO + rate limiting
- WhatsApp-Campaign-Bot → 6 capas anti-ban
- wpchatbot → warm-up 14 días
- SendStack → {{variables}} + spintax

---

### Módulo 3: 📊 CRM Pipeline AI (Gestión autónoma)

**Qué hace:** Gestiona contactos, deals y pipeline automáticamente.

**El admin configura:**
```json
{
  "etapas_pipeline": ["nuevo", "contactado", "interesado", "propuesta", "negociacion", "cerrado-ganado", "cerrado-perdido"],
  "auto_mover": true,
  "reglas": {
    "nuevo_a_contactado": "cuando bot envíe primer mensaje",
    "contactado_a_interesado": "cuando contacto responda positivamente",
    "interesado_a_propuesta": "cuando IA detecte intención de compra",
    "propuesta_a_negociacion": "cuando contacto pregunte precio/condiciones",
    "negociacion_a_cerrado": "cuando contacto confirme compra"
  },
  "seguimiento_auto": {
    "si_no_responde_en": "48h",
    "accion": "mensaje de follow-up amigable"
  }
}
```

**La IA hace:**
1. Registra cada interacción automáticamente
2. Mueve deals en el pipeline según reglas
3. Detecta sentimiento del contacto
4. Agenda follow-ups automáticos
5. Prioriza contactos por probabilidad de conversión
6. Sugiere siguiente acción al admin
7. Genera reportes de pipeline

**Referencia técnica:**
- workshop-crm → modelo Kanban + deals
- MedicareAI → bot + citas automáticas

---

### Módulo 4: 🛡️ Anti-Ban Guardian (Protección continua)

**Qué hace:** Protege el número de WhatsApp 24/7 sin intervención.

**El admin configura:**
```json
{
  "modo": "conservador",
  "warmup_dias": 14,
  "limite_diario": 100,
  "horario": "8:00-20:00",
  "auto_stop": {
    "fallos_consecutivos": 5,
    "tasa_fallo_porcentaje": 30
  }
}
```

**La IA hace:**
1. Controla volumen con warm-up gradual (10→200 en 14 días)
2. Aplica Gaussian jitter a TODOS los delays
3. Simula typing antes de cada envío
4. Pausa cada 10 mensajes (2-5 min)
5. Detecta fallos y auto-detiene
6. Trackea reputación por contacto
7. Salva sesión automáticamente
8. Reconecta con backoff exponencial
9. Monitorea session health
10. Alerta al admin solo si es crítico

**Referencia técnica:**
- baileys-antiban → middleware npm (Gaussian jitter, warmup, session health)
- WhatsApp-Campaign-Bot → 6 capas documentadas
- Neexll/Bot-WhatsApp → mejores prácticas
- wpchatbot → warm-up 14 días

---

### Módulo 5: 📈 Analytics & Reporting (KPIs autónomos)

**Qué hace:** Genera reportes, KPIs y gráficas automáticamente.

**El admin ve:**

**KPIs en tiempo real:**
```
┌─────────────────────────────────────────────────────────┐
│  📊 DASHBOARD — Resumen del Día                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Mensajes enviados:     47 / 100 (47%)                  │
│  Mensajes entregados:   45 (95.7%)                      │
│  Mensajes leídos:       38 (80.9%)                      │
│  Respuestas recibidas:  12 (25.5%)                      │
│  Conversaciones bot:    8                               │
│  Escaladas a humano:    2                               │
│                                                          │
│  Contactos nuevos:      5                               │
│  Deals creados:         3                               │
│  Deals movidos:         7                               │
│  Ventas cerradas:       1 ($500)                        │
│                                                          │
│  Tasa de apertura:      80.9%  (↑ 3% vs ayer)          │
│  Tasa de respuesta:     25.5%  (↓ 2% vs ayer)          │
│  Conversión:            2.1%   (→ estable)              │
│                                                          │
│  Estado WhatsApp:       🟢 Conectado                    │
│  Salud sesión:          🟢 98%                          │
│  Anti-ban status:       🟡 Modo conservador (día 5/14)  │
│  LLM status:            🟢 Ollama activo                │
└─────────────────────────────────────────────────────────┘
```

**Gráficas automáticas:**
- Mensajes enviados/recibidos por día (línea)
- Tasa de apertura por campaña (barra)
- Pipeline funnel (embudo)
- Mejores horarios de envío (heatmap)
- Sentimiento de conversaciones (pie)
- Crecimiento de contactos (área)
- ROI por campaña (barra)

**Referencia técnica:**
- whatsapp-chat-analyser → análisis de exportaciones
- dk1307 → logging extensivo
- ossiqn → reporting JSON

---

## FLUJO AUTÓNOMO COMPLETO

```
DÍA NORMAL DEL ADMIN (solo mira):

08:00  ┌─ El sistema se conecta automáticamente a WhatsApp
       │  Anti-ban: warm-up activo (día 5/14, límite 25 msg)
       │
08:15  ├─ Llega mensaje de "Pedro" preguntando por un producto
       │  → Bot IA detecta intención: CONSULTA
       │  → Recupera info del producto de la knowledge base
       │  → Genera respuesta humana con delay de 7s
       │  → Registra actividad en CRM
       │  → Mueve deal de Pedro: "nuevo" → "contactado"
       │
09:00  ├─ IA genera campaña semanal automáticamente
       │  → 5 variaciones del mensaje de marketing
       │  → Selecciona 20 contactos (tag: "lead-activo")
       │  → Programa envío: 10:00-11:00 (mejor horario)
       │
10:00  ├─ Campaña se envía con anti-ban activo
       │  → 20 mensajes, delay 12-18s entre cada uno
       │  → Typing simulation activa
       │  → Tracking: 18 entregados, 2 fallidos
       │
10:30  ├─ "Laura" responde "Me interesa"
       │  → Bot detecta intención: INTERÉS
       │  → Responde con detalles + precio
       │  → Mueve deal: "contactado" → "interesado"
       │  → Agenda follow-up en 24h si no responde
       │
14:00  ├─ Bot responde a 5 consultas más
       │  → 3 sobre productos, 1 horarios, 1 queja
       │  → Queja escalada a humano automáticamente
       │
18:00  ├─ Admin abre dashboard
       │  → Ve: 47 enviados, 12 respuestas, 1 venta
       │  → Ve gráficas del día
       │  → Aprueba siguiente paso para "Laura"
       │
20:00  ┌─ Sistema pausa envíos (horario laboral terminado)
       │  → Backup automático de datos
       │  → Log del día guardado
```

---

## STACK TÉCNICO FINAL ($0)

```
Backend:      Node.js 20 + Express + TypeScript
WhatsApp:     Baileys + baileys-antiban (npm, $0)
Database:     SQLite + Prisma ($0, local)
LLM primario: Groq API free tier (qwen-2.5-32b, $0, cloud)
LLM backup:   Ollama + Llama 3.1 8B ($0, local)
Embeddings:   Ollama + nomic-embed-text ($0, local)
Vector:       sqlite-vss ($0)
Frontend:     Next.js 14 + TailwindCSS + shadcn/ui ($0)
Charts:       Recharts ($0, npm)
Cola:         Bull + better-sqlite3 ($0)
Deploy:       Tu PC (desarrollo) / Hetzner $4.50/mes (producción)

TOTAL: $0 (desarrollo) / $54/año (si necesitas 24/7)
```

---

## PARÁMETROS QUE EL ADMIN CONFIGURA (todo desde el dashboard)

### 1. Configuración General
```json
{
  "negocio": "Mi Tienda Online",
  "descripcion": "Venta de productos digitales",
  "horario_atencion": "8:00-20:00",
  "zona_horaria": "America/Buenos_Aires",
  "moneda": "ARS"
}
```

### 2. Knowledge Base (lo que la IA "sabe")
```json
{
  "productos": [
    {"nombre": "Curso Marketing", "precio": "$5000", "duracion": "8 semanas"},
    {"nombre": "Mentoría 1:1", "precio": "$15000/mes", "sesiones": 4}
  ],
  "faq": [
    {"q": "¿Cómo pago?", "a": "Transferencia, Mercado Pago o efectivo"},
    {"q": "¿Hay garantía?", "a": "Sí, 30 días de garantía de devolución"}
  ],
  "politicas": {
    "devolucion": "30 días sin preguntas",
    "envio": "Digital, acceso inmediato"
  }
}
```

### 3. Reglas del Bot
```json
{
  "nombre_bot": "María",
  "personalidad": "Profesional, cercana, entusiasta",
  "reglas_especiales": {
    "si_preguntan_precio": "Responder con precio + valor agregado",
    "si_dicen_caro": "Ofrecer descuento o plan de pago",
    "si_no_responde_48h": "Enviar follow-up amigable",
    "si_queja": "Escalar a humano inmediatamente"
  }
}
```

### 4. Reglas de Marketing
```json
{
  "frecuencia_campañas": "2 por semana",
  "max_mensajes_dia": 50,
  "segmentacion_auto": true,
  "warmup_dias": 14,
  "anti_ban_modo": "conservador"
}
```

### 5. Reglas del Pipeline
```json
{
  "auto_mover_deals": true,
  "followup_auto": true,
  "priorizar_por": "probabilidad_conversion"
}
```

---

## ESTRUCTURA DE ARCHIVOS

```
mejoraws/
├── src/
│   ├── server.ts                    # Entry point
│   ├── config/
│   │   ├── index.ts                 # Config loader
│   │   └── default-params.json      # Parámetros default
│   │
│   ├── importer/
│   │   ├── pipeline.ts              # MejoraContactos pipeline core
│   │   ├── parsers.ts               # CSV/Excel/VCF/JSON parsers
│   │   ├── cleaner.ts               # Limpieza determinística
│   │   ├── validator.ts             # Validación IA + scoring
│   │   ├── deduplicator.ts          # Dedup exacto + fuzzy
│   │   ├── whatsapp-detector.ts     # Detección WhatsApp E.164
│   │   └── google-contacts.ts       # Google Contacts OAuth
│   │
│   ├── whatsapp/
│   │   ├── client.ts                # Baileys + baileys-antiban
│   │   ├── sender.ts                # Envío con anti-ban
│   │   └── receiver.ts              # Recepción de mensajes
│   │
│   ├── brain/
│   │   ├── auto-reply.ts            # Motor de auto-respuesta
│   │   ├── campaign-generator.ts    # Generador de campañas
│   │   ├── pipeline-manager.ts      # Gestor de pipeline
│   │   ├── content-creator.ts       # Creación de contenido
│   │   └── orchestrator.ts          # Coordinador central
│   │
│   ├── antiban/
│   │   ├── rate-limiter.ts          # Gaussian jitter
│   │   ├── warmup.ts                # Warm-up 14 días
│   │   ├── typing-sim.ts            # Simulación de typing
│   │   ├── failure-detector.ts      # Detección de fallos
│   │   └── reputation.ts            # Reputación de contactos
│   │
│   ├── crm/
│   │   ├── contacts.ts              # Gestión de contactos
│   │   ├── deals.ts                 # Pipeline de deals
│   │   ├── activities.ts            # Log de actividades
│   │   └── analytics.ts             # Cálculo de métricas
│   │
│   ├── llm/
│   │   ├── groq.ts                  # Groq API (gratis)
│   │   ├── ollama.ts                # Ollama local (backup)
│   │   ├── embeddings.ts            # Generación de embeddings
│   │   └── rag.ts                   # Retrieval augmented generation
│   │
│   ├── db/
│   │   ├── schema.prisma            # Modelo de datos
│   │   └── queries.ts               # Queries optimizadas
│   │
│   └── api/
│       ├── contacts.routes.ts
│       ├── campaigns.routes.ts
│       ├── deals.routes.ts
│       ├── bot.routes.ts
│       ├── analytics.routes.ts
│       └── config.routes.ts
│
├── frontend/                        # Next.js dashboard
│   ├── pages/
│   │   ├── index.tsx                # Dashboard principal
│   │   ├── import.tsx               # Importar contactos (MejoraContactos)
│   │   ├── contacts.tsx             # CRM contactos
│   │   ├── pipeline.tsx             # Kanban pipeline
│   │   ├── campaigns.tsx            # Marketing
│   │   ├── conversations.tsx        # Chat / conversaciones
│   │   ├── analytics.tsx            # KPIs y gráficas
│   │   └── settings.tsx             # Configuración / parámetros
│   └── components/
│       ├── Dashboard/
│       ├── CRM/
│       ├── Marketing/
│       ├── Chat/
│       └── Charts/
│
├── data/
│   ├── mejoraws.db                  # SQLite database
│   ├── whatsapp-session/            # Sesión WhatsApp
│   └── knowledge-base/              # Documentos de la IA
│
├── prisma/
│   └── schema.prisma
│
├── package.json
├── tsconfig.json
├── docker-compose.yml               # Para deploy 24/7
└── README.md
```

---

## PLAN DE DESARROLLO POR SPRINTS

### Sprint 1 (Semana 1): Foundation
```
[ ] Setup proyecto (Node.js + TypeScript + Prisma + SQLite)
[ ] Conectar WhatsApp (Baileys + baileys-antiban)
[ ] Anti-ban básico (Gaussian jitter + warmup)
[ ] Recibir y loggear mensajes entrantes
[ ] Enviar mensajes de prueba
```

### Sprint 2 (Semana 2): Brain
```
[ ] Integrar Groq API (gratis)
[ ] Motor de auto-respuesta básico
[ ] Sistema de prompts con personalidad
[ ] Detección de intención
[ ] Delay humano + typing indicator
```

### Sprint 3 (Semana 3): CRM + Importación
```
[ ] Integrar MejoraContactos como módulo de importación
[ ] Import CSV/Excel/VCF/JSON con auto-detección
[ ] Google Contacts OAuth (opcional)
[ ] Pipeline de limpieza + deduplicación
[ ] Detección WhatsApp automática
[ ] Schema completo (contacts, deals, activities)
[ ] CRUD contactos + tags
[ ] Pipeline Kanban
[ ] Auto-registro de actividades
[ ] Follow-up automático
```

### Sprint 4 (Semana 4): Marketing
```
[ ] Motor de campañas
[ ] Template engine ({{var}} + spintax)
[ ] Cola de envío con anti-ban
[ ] Tracking de estados
[ ] Segmentación automática
```

### Sprint 5 (Semana 5): Dashboard
```
[ ] Next.js dashboard
[ ] KPIs en tiempo real
[ ] Gráficas (Recharts)
[ ] Configuración de parámetros
[ ] Knowledge base upload
```

### Sprint 6 (Semana 6): Autonomous
```
[ ] Orchestrator (coordinador central)
[ ] Campaign generator autónomo
[ ] Pipeline AI auto-mover deals
[ ] Analytics automáticos
[ ] Testing + polish
```

---

## CÓMO SE USA (EJEMPLO REAL)

### Día 1: Setup (10 minutos)
```
1. Abrir dashboard → 📥 Importar Contactos
2. Subir CSV/Excel/VCF (o conectar Google Contacts)
3. El sistema auto-detecta columnas, limpia y deduplica
4. Verificar: "500 contactos importados, 23 duplicados eliminados, 412 con WhatsApp"
5. Ir a Settings → completar info del negocio
6. Copiar FAQ en knowledge base
7. Activar bot con nombre "María"
8. Activar anti-ban modo conservador
9. ¡Listo! El sistema arranca solo
```

### Día 2-14: Warm-up automático
```
El sistema envía 10→20→30→...→200 msg/día
El bot responde a consultas automáticamente
El admin solo mira el dashboard por 5 min/día
```

### Día 15+: Operación autónoma
```
La IA crea campañas solas
La IA mueve deals en el pipeline
La IA responde como María
El admin recibe alertas solo para decisiones importantes
Los KPIs se actualizan en tiempo real
```

---

## REFERENCIAS TÉCNICAS (88+ repos)

| Componente | Repos de referencia | Qué tomamos |
|-----------|-------------------|-------------|
| **Importación** | **MejoraContactos (pabloeckert)** | Pipeline CSV/Excel/VCF/JSON, limpieza IA, dedup, E.164 |
| WhatsApp | whatsapp-web.js, Baileys | Conexión multi-device |
| Anti-ban | baileys-antiban, WhatsApp-Campaign-Bot | 6 capas, Gaussian jitter |
| Bot IA | whatsapp-mcp, wa-sender-pro | Memoria, Groq AI |
| CRM | workshop-crm, whatsapp-sales-backend | Pipeline, deals |
| Marketing | dk1307, vSender, wpchatbot | Queue, warm-up 14d |
| Dashboard | whatsapp-bulk-sender-dashboard | React + WebSocket |
| Gateway | wagate, Evolution API | REST API pattern |
| SaaS ref | wamelly-ai, whatsapp-ai-platform | Multi-tenant architecture |
| No-code | automacao-n8n | n8n workflow pattern |
| RAG | Car-and-Gen, whatsapp-ai-framework | Vector store + RAG |

---

## VEREDICTO FINAL

| Aspecto | Resultado |
|---------|-----------|
| **Viabilidad** | ✅ 100% viable |
| **Costo** | $0 (desarrollo) / $54/año (producción 24/7) |
| **Autonomía** | Admin configura → IA hace todo |
| **Anti-ban** | 6 capas + warm-up 14 días |
| **Bot IA** | Groq (gratis) + Ollama (backup) |
| **Timeline** | 6 sprints / 6 semanas |
| **Complejidad** | Media — stack probado |

**¿Se puede hacer? SÍ.**
**¿Cuesta algo? NO.**
**¿Es seguro? SÍ (con las 6 capas anti-ban).**
**¿Es autónomo? SÍ (el admin solo configura).**

---

*Propuesta generada el 26 de abril de 2026*

---

## 📝 REGISTRO DE AVANCES

> Sección actualizada con cada "documentar"

### Estado General del Proyecto

| Campo | Valor |
|-------|-------|
| **Nombre** | MejoraWS |
| **Repo** | https://github.com/pabloeckert/MejoraContactos |
| **Repo** | https://github.com/pabloeckert/MejoraWS |
| **Fase actual** | Documentación / Pre-desarrollo |
| **Sprint** | No iniciado |
| **Commits** | 7 |
| **Archivos** | Documents/00-PLAN-MAESTRO.md + README.md |

### Repos Analizados: 89+

**Por categoría:**
| Categoría | Cantidad | Top picks |
|-----------|----------|-----------|
| Core libraries | 5 | whatsapp-web.js, Baileys |
| Anti-ban middleware | 4 | baileys-antiban, WhatsApp-Campaign-Bot |
| Bulk senders | 44 | dk1307, vSender, wpchatbot, wa-sender-pro |
| Campaign bots | 4 | WhatsApp-Campaign-Bot, WhatsApp-RPA, n8n |
| AI frameworks | 3 | whatsapp-ai-framework, wa-sender-pro (Groq) |
| Gateways | 3 | wagate, Evolution API |
| CRM | 3 | workshop-crm, whatsapp-sales-backend, wamelly-ai |
| Bot IA | 4 | whatsapp-mcp, whatsapp-ai-platform, StayIQ, Car-and-Gen |
| Importación | 1 | **MejoraContactos (pabloeckert)** |
| Otros | 18 | misc |

**Repos del propio usuario:**
| Repo | Descripción | Estado |
|------|-------------|--------|
| [pabloeckert/MejoraContactos](https://github.com/pabloeckert/MejoraContactos) | Importación/limpieza/dedup contactos con IA | ✅ En producción (v10.0, 174 tests) |
| [pabloeckert/MejoraWS](https://github.com/pabloeckert/MejoraWS) | CRM WhatsApp autónomo con IA | 📝 En documentación |

### Documentación Consolidada

**Archivo único:** `Documents/00-PLAN-MAESTRO.md` (780 líneas)

**Contenido:**
1. ✅ Visión general y filosofía autónoma
2. ✅ Arquitectura del sistema (diagrama ASCII)
3. ✅ 6 módulos autónomos detallados:
   - Módulo 0: Importador (MejoraContactos)
   - Módulo 1: Auto-Reply Engine
   - Módulo 2: Campaign Generator
   - Módulo 3: CRM Pipeline AI
   - Módulo 4: Anti-Ban Guardian
   - Módulo 5: Analytics & Reporting
4. ✅ Flujo autónomo completo (ejemplo día normal)
5. ✅ Stack técnico $0 (Groq + Ollama + SQLite + Baileys)
6. ✅ Parámetros que el admin configura (5 secciones JSON)
7. ✅ Estructura de archivos del proyecto
8. ✅ Plan por 6 sprints (6 semanas)
9. ✅ Ejemplo de uso real (Día 1, Día 2-14, Día 15+)
10. ✅ Referencias técnicas (89+ repos)
11. ✅ Veredicto final
12. ✅ Registro de avances (esta sección)

### Decisiones Técnicas Tomadas

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| WhatsApp library | Baileys + baileys-antiban | Más ligero que whatsapp-web.js (sin Chrome) |
| LLM primario | Groq API free tier | Gratis, rápido, qwen-2.5-32b excelente en español |
| LLM backup | Ollama + Llama 3.1 8B | Local, sin internet, $0 |
| Database | SQLite + Prisma | $0, sin servidor, suficiente para uso personal |
| Frontend | Next.js + Tailwind + shadcn/ui | Stack probado, rápido de construir |
| Anti-ban | 6 capas + warm-up 14 días | Estándar del ecosistema, más conservador |
| Importación | MejoraContactos (propio) | Ya en producción, 174 tests, pipeline completo |
| Costo total | $0 desarrollo / $54/año prod | Sin inversión inicial |

### Pendientes (Backlog)

| Prioridad | Tarea | Estado |
|-----------|-------|--------|
| 🔴 Alta | Sprint 1: Setup + WhatsApp + Anti-ban | ⏳ No iniciado |
| 🔴 Alta | Sprint 2: Motor auto-respuesta IA | ⏳ No iniciado |
| 🟠 Media | Sprint 3: CRM + Importación MejoraContactos | ⏳ No iniciado |
| 🟠 Media | Sprint 4: Marketing + Campaigns | ⏳ No iniciado |
| 🟡 Baja | Sprint 5: Dashboard + KPIs | ⏳ No iniciado |
| 🟡 Baja | Sprint 6: Autonomous orchestrator | ⏳ No iniciado |

### Timeline de Documentación

| Fecha | Hora | Acción | Detalle |
|-------|------|--------|---------|
| 26/04 | 23:46 | Análisis inicial | 17 repos originales |
| 26/04 | 23:55 | +37 bulk senders | 54 repos total |
| 26/04 | 00:01 | +10 anti-ban/gateways | 64 repos, subido a GitHub |
| 26/04 | 00:03 | Consolidación | 9 docs → 1 plan maestro, costo $0 |
| 26/04 | 00:08 | +14 repos nuevos | 78 repos, Groq AI, n8n, warm-up 14d |
| 26/04 | 00:16 | +10 repos + propuesta | 89 repos, 5 módulos autónomos |
| 26/04 | 00:22 | +MejoraContactos | Módulo 0 importación, 6 módulos total |
| 26/04 | 00:25 | **documentar** | Registro de avances actualizado |

---

*Última actualización: 26 abril 2026 00:25 GMT+8*
*89+ repos analizados · 6 módulos · Costo $0 · Listo para Sprint 1*
*Basada en 88+ repositorios analizados de GitHub*
