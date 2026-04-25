# 09 — Análisis: Anti-Ban, Campañas y Gateways (10 repos)

## Contexto

10 repos adicionales enfocados en **anti-ban middleware**, **campaign bots** y **WhatsApp gateways**. Estos refuerzan las estrategias de seguridad y automatización para nuestro MVP.

---

## Repos de Alto Valor

### 1. ⭐ kobie3717/baileys-antiban — **HALLAZGO CLAVE**

| Campo | Detalle |
|-------|---------|
| **Repo** | [kobie3717/baileys-antiban](https://github.com/kobie3717/baileys-antiban) |
| **Tech** | TypeScript, npm package |
| **Licencia** | MIT |
| **Estado** | Activo |

**Qué es:** Middleware drop-in para Baileys que añade protección anti-ban. Es un **paquete npm** que se instala directamente.

**Features:**
- ✅ Rate limiting con **Gaussian jitter** (no delays fijos)
- ✅ **7-day warmup** automático
- ✅ Session health monitoring (detecta degradación antes del ban)
- ✅ LID resolver
- ✅ Disconnect classification (fatal vs recoverable vs rate-limited)
- ✅ Contact graph enforcement
- ✅ Compatibilidad con Baileys y @oxidezap/baileyrs

**Puntuación: 10/10** — Es EXACTAMENTE lo que necesitamos para el módulo de marketing. Middleware listo para usar.

**Uso en MVP:** Integrar como capa de protección en nuestro WhatsApp Service Layer.

---

### 2. ⭐ AbdelrahmanBedo/WhatsApp-Campaign-Bot — **ANTI-BAN COMPLETO**

| Campo | Detalle |
|-------|---------|
| **Repo** | [AbdelrahmanBedo/WhatsApp-Campaign-Bot](https://github.com/AbdelrahmanBedo/WhatsApp-Campaign-Bot) |
| **Tech** | Python + Selenium |
| **Estado** | Activo |

**Qué es:** Sistema de campañas con **6 capas de protección anti-ban** (el más completo visto).

**6 Capas Anti-Ban:**
| Capa | Descripción |
|------|-------------|
| 1. Template Rotation | 3-5 variaciones de mensaje, una aleatoria por contacto |
| 2. Volume Control | Warm-up: 30 msg/día (día 1) → 300 msg/día (día 7+) |
| 3. Timing Humanization | Gaussian delays 10-30s, pausas de batch 2-5 min, typing simulado |
| 4. Behavior Simulation | Idle actions: scroll chats, abrir conversaciones |
| 5. Failure Detection | Auto-stop: 5 fallos consecutivos O >30% failure rate |
| 6. Contact Reputation | Track números bloqueados, evitar re-envío frecuente |

**Extras:** Crash-safe resume, dry-run mode, CSV logging.

**Puntuación: 9/10** — Referencia arquitectónica para nuestro sistema anti-ban.

---

### 3. ⭐ bhumika-04/WhatsApp-RPA-Chrome-Extension — **PLATAFORMA COMPLETA**

| Campo | Detalle |
|-------|---------|
| **Repo** | [bhumika-04/WhatsApp-RPA-Chrome-Extension](https://github.com/bhumika-04/WhatsApp-RPA-Chrome-Extension) |
| **Tech** | Node.js + Express + Chrome Extension (Manifest V3) + SQL Server |
| **Estado** | Activo |

**Qué es:** Plataforma multi-usuario con backend + Chrome Extension.

**Features:**
- ✅ Backend: Node.js + Express 5.1 + SQL Server + Socket.IO + JWT
- ✅ Chrome Extension: 5 layers anti-throttling
- ✅ **AI auto-reply (OpenAI GPT-3.5)** ← Bot con IA integrado
- ✅ Message scheduling (cron-based)
- ✅ Template management
- ✅ Contact groups
- ✅ Delivery tracking
- ✅ Team management + roles
- ✅ Daily limits (300 msg/day)
- ✅ Anomaly detection (auto-pause)

**Puntuación: 9/10** — Es lo más cercano a nuestro MVP completo. Backend + Extension + AI.

---

### 4. mohamed-arabi16/SendStack — **MULTI-CANAL**

| Campo | Detalle |
|-------|---------|
| **Repo** | [mohamed-arabi16/SendStack](https://github.com/mohamed-arabi16/SendStack) |
| **Tech** | Web App + Chrome Extension |
| **Estado** | Activo |

**Qué es:** Plataforma de envío masivo **Email + WhatsApp** en una sola herramienta.

**Features:**
- ✅ CSV upload con {{variables}}
- ✅ Spin syntax para variaciones
- ✅ Anti-ban protection
- ✅ Multilingual (EN/AR/TR)
- ✅ **Dual channel: Email (SMTP) + WhatsApp**
- ✅ Chrome Extension para Gmail & WhatsApp Web
- ✅ No sign-up, fully offline

**Puntuación: 8/10** — Referencia para soporte multi-canal en futuro.

---

### 5. PT-Perkasa-Pilar-Utama/wagate — **GATEWAY REST API**

| Campo | Detalle |
|-------|---------|
| **Repo** | [PT-Perkasa-Pilar-Utama/wagate](https://github.com/PT-Perkasa-Pilar-Utama/wagate) |
| **Tech** | Bun + Elysia + whatsapp-web.js |
| **Estado** | Activo |

**Qué es:** Gateway REST API type-safe con **dual-client anti-ban**.

**Arquitectura anti-ban innovadora:**
- Dos instancias de WhatsApp simulando conversación orgánica antes de entregar mensajes
- Pipeline de 3 fases
- TypeBox validation
- Winston logging

**Puntuación: 8/10** — Patrón de dual-client es original y efectivo.

---

## Repos de Valor Medio

### 6. Omegatech-01/Lady-Mina

| Campo | Detalle |
|-------|---------|
| **Tech** | Node.js, Termux/VPS |
| **Estado** | Semi-activo (incompleto) |

Bot modular para Termux con anti-ban básico. Panel premium de pago.

**Puntuación: 5/10**

### 7. Niharikaa08/whatsapp-bulk-messenger

| Campo | Detalle |
|-------|---------|
| **Tech** | Python + Selenium |
| **Estado** | Activo |

Bulk messenger: 50+ msg/min, {name} placeholders, retry logic, anti-ban delays.

**Puntuación: 6/10**

### 8. kunaldevelopers/whatsapp-bulk-sender-dashboard

Ya analizado en documento 08. Confirmado: React + Node.js, Tier 1.

### 9. xennzbaik/baileys

Fork de Baileys. Sin diferenciación significativa.

**Puntuación: 3/10**

### 10. januzzstores/JaNuzz-Store

Página de venta de "Free Fire Optimization Files & Anti-Ban Panels". **No es un repo técnico.**

**Puntuación: 0/10** — Sin valor.

---

## Tabla Consolidada

| # | Repo | Tipo | Anti-Ban | Puntuación |
|---|------|------|----------|------------|
| 1 | **baileys-antiban** | npm middleware | ⭐⭐⭐⭐⭐ | **10/10** |
| 2 | **WhatsApp-Campaign-Bot** | Campaign bot | ⭐⭐⭐⭐⭐ | **9/10** |
| 3 | **WhatsApp-RPA-Chrome-Ext** | Platform completa | ⭐⭐⭐⭐ | **9/10** |
| 4 | **SendStack** | Multi-canal | ⭐⭐⭐ | **8/10** |
| 5 | **wagate** | REST Gateway | ⭐⭐⭐⭐ | **8/10** |
| 6 | **whatsapp-bulk-messenger** | Script | ⭐⭐ | **6/10** |
| 7 | **Lady-Mina** | Bot | ⭐⭐ | **5/10** |
| 8 | **whatsapp-bulk-sender-dashboard** | Dashboard | ⭐⭐⭐ | (ya analizado) |
| 9 | **xennzbaik/baileys** | Fork | - | **3/10** |
| 10 | **JaNuzz-Store** | N/A | - | **0/10** |

---

## Impacto en el MVP

### Hallazgo #1: baileys-antiban como dependencia

**Debemos usar `baileys-antiban` como middleware obligatorio.** Proporciona:
- Gaussian jitter (no delays fijos predecibles)
- Warmup automático de 7 días
- Session health monitoring
- Disconnect classification inteligente

### Hallazgo #2: Las 6 capas de anti-ban son el estándar

Consolidando todos los repos analizados, nuestro sistema anti-ban debe tener:

```
Capa 1: Template rotation (spintax + múltiples templates)
Capa 2: Volume control (warm-up gradual: 10→30→50→100)
Capa 3: Timing humanization (Gaussian jitter, no delays fijos)
Capa 4: Behavior simulation (typing simulation, idle actions)
Capa 5: Failure detection (auto-stop en cascada de fallos)
Capa 6: Contact reputation (skip bloqueados, no re-enviar pronto)
```

### Hallazgo #3: Gateway REST como capa de abstracción

El patrón de **wagate** (REST API como gateway) nos permite:
- Separar la lógica WhatsApp del business logic
- Exponer endpoints para el frontend
- Facilitar testing

---

## Arquitectura Anti-Ban Final para MejoraWS

```
┌──────────────────────────────────────────────────────┐
│                  Marketing Module                      │
├──────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Campaign Engine                                   │ │
│  │  - CSV/XLSX parser                                 │ │
│  │  - Template engine ({{var}} + spintax)             │ │
│  │  - Scheduling                                      │ │
│  └──────────────────┬───────────────────────────────┘ │
│                     │                                  │
│  ┌──────────────────▼───────────────────────────────┐ │
│  │  Anti-Ban Layer (6 capas)                         │ │
│  │  1. Template rotation                             │ │
│  │  2. Volume control (warm-up)                      │ │
│  │  3. Gaussian jitter timing                        │ │
│  │  4. Typing simulation                             │ │
│  │  5. Failure detection + auto-stop                 │ │
│  │  6. Contact reputation tracking                   │ │
│  └──────────────────┬───────────────────────────────┘ │
│                     │                                  │
│  ┌──────────────────▼───────────────────────────────┐ │
│  │  baileys-antiban (npm middleware)                 │ │
│  │  - Rate limiting con Gaussian jitter              │ │
│  │  - 7-day warmup                                   │ │
│  │  - Session health monitor                         │ │
│  │  - Disconnect classification                      │ │
│  └──────────────────┬───────────────────────────────┘ │
│                     │                                  │
│  ┌──────────────────▼───────────────────────────────┐ │
│  │  WhatsApp Service (whatsapp-web.js o Baileys)     │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## Resumen Global: 64 repos analizados

| Categoría | Cantidad | Top Picks |
|-----------|----------|-----------|
| Core libraries | 5 | whatsapp-web.js, Baileys |
| Bulk senders | 37 | dk1307, vSender, ossiqn |
| Anti-ban | 3 | **baileys-antiban** ⭐, WhatsApp-Campaign-Bot |
| Campaign bots | 3 | WhatsApp-Campaign-Bot, WhatsApp-RPA |
| Gateways | 2 | wagate, SantiagoCTB/whatsapp_api |
| CRM | 2 | workshop-crm, MedicareAI |
| Bot IA | 2 | whatsapp-mcp, WhatsApp-RPA |
| Otros | 10 | (misc) |

---

*Añadido el 26 de abril de 2026 — 10 repos, 64 total*
