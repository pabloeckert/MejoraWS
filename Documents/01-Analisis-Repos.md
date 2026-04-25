# 01 — Análisis Detallado de Repositorios

## Metodología

Cada repo fue evaluado en 7 dimensiones:
- **Relevancia** para el objetivo (Marketing + CRM + Bot IA)
- **Madurez** del código (stars, commits, actualizaciones)
- **Tecnología** base (lenguaje, librería WhatsApp)
- **Funcionalidades** clave extraíbles
- **Riesgos** legales y técnicos
- **Reutilización** directa o como referencia
- **Puntuación** global (1-10)

---

## 1. whatsapp-web.js (⭐ Mayor relevancia)

| Campo | Detalle |
|-------|---------|
| **Repo** | [wwebjs/whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js) |
| **Tech** | Node.js, Puppeteer |
| **Estrellas** | ~15k+ |
| **Licencia** | Apache 2.0 |
| **Última actividad** | Activo (2026) |

### Qué es
Libro de Node.js que interactúa con WhatsApp Web usando Puppeteer. Es la librería más madura y documentada del ecosistema.

### Funcionalidades clave
- ✅ Multi-device
- ✅ Envío/recepción de mensajes de texto
- ✅ Envío de media (imágenes, audio, documentos, video)
- ✅ Stickers, contact cards, ubicaciones
- ✅ Gestión de grupos
- ✅ Estados (stories)
- ✅ Estrategias de autenticación (LocalAuth, RemoteAuth)
- ✅ Eventos: `message`, `message_create`, `qr`, `ready`

### Reutilización para nuestro MVP
**ALTA** — Es la base recomendada. Puede ser el core del bot + marketing sender.

### Riesgos
- ⚠️ Usa WhatsApp Web no oficial → riesgo de ban
- ⚠️ Requiere Puppeteer (Chrome headless) → consumo RAM
- ⚠️ Re-autenticación periódica necesaria

### Puntuación: **9/10**

---

## 2. Baileys (whatsapp-bot, raganork, Knightbot-MD, wabot-aq)

Múltiples repos usan Baileys como base. Análisis consolidado:

| Campo | Detalle |
|-------|---------|
| **Repos** | lyfe00011/whatsapp-bot, souravkl11/raganork, mruniquehacker/Knightbot-MD, Nurutomo/wabot-aq |
| **Tech** | Node.js, Baileys (WebSocket nativo) |
| **Estado** | whatsapp-bot: Archivado (2024). Raganork: Rewrite a raganork-md. Knightbot-MD: Activo. wabot-aq: Activo |

### Qué es Baileys
Librería que conecta directamente al protocolo WebSocket de WhatsApp Multi-Device. No necesita Puppeteer/Chrome.

### Funcionalidades clave (consolidando los 4 repos)
- ✅ Conexión multi-device nativa
- ✅ QR + Pairing code para autenticación
- ✅ Envío de mensajes, media, stickers
- ✅ Gestión de grupos (tag all, mute/unmute)
- ✅ Sistema de plugins (wabot-aq, Knightbot-MD)
- ✅ Multi-idioma (wabot-aq)
- ✅ Docker support (whatsapp-bot)
- ✅ Heroku/Replit deploy (Knightbot-MD, wabot-aq)

### Reutilización para nuestro MVP
**ALTA** — Baileys es la alternativa a whatsapp-web.js. Más ligero (sin Chrome), pero menos documentado. Los repos de plugins son útiles como referencia de arquitectura.

### Riesgos
- ⚠️ Baileys también es no oficial
- ⚠️ whatsapp-bot ya está archivado
- ⚠️ Código de bots públicos suele ser de baja calidad

### Puntuación: **7/10**

---

## 3. mautrix/whatsapp

| Campo | Detalle |
|-------|---------|
| **Repo** | [mautrix/whatsapp](https://github.com/mautrix/whatsapp) |
| **Tech** | Go, Matrix protocol |
| **Licencia** | AGPL-3.0 |
| **Estado** | Activo |

### Qué es
Bridge entre WhatsApp y Matrix (protocolo de mensajería federado). Permite recibir/enviar mensajes de WhatsApp desde un servidor Matrix.

### Funcionalidades clave
- ✅ Bridge completo WhatsApp ↔ Matrix
- ✅ Multi-device support
- ✅ Almacenamiento local de mensajes
- ✅ Docker support
- ✅ E2E encryption support

### Reutilización para nuestro MVP
**BAJA** — Es un bridge Matrix, no un bot directamente. Útil como referencia de arquitectura Go, pero no reutilizable directamente.

### Puntuación: **4/10**

---

## 4. lharries/whatsapp-mcp

| Campo | Detalle |
|-------|---------|
| **Repo** | [lharries/whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) |
| **Tech** | Go (bridge) + Python (MCP server) |
| **Estado** | Activo |

### Qué es
Servidor MCP (Model Context Protocol) para WhatsApp. Permite a un LLM (como Claude) buscar, leer y enviar mensajes de WhatsApp.

### Funcionalidades clave
- ✅ Búsqueda de mensajes
- ✅ Lectura de mensajes (texto, imágenes, audio, video, docs)
- ✅ Envío de mensajes individuales y grupales
- ✅ Envío de media
- ✅ Almacenamiento local en SQLite
- ✅ Integración con Claude Desktop

### Reutilización para nuestro MVP
**MUY ALTA** — Es exactamente lo que necesitamos para el componente de "Bot con IA". La arquitectura MCP + bridge Go es excelente. Podemos usar el bridge y adaptar el MCP server.

### Riesgos
- ⚠️ Advierte sobre "lethal trifecta" (inyección de prompts → exfiltración de datos)
- ⚠️ Requiere Go + Python

### Puntuación: **8/10**

---

## 5. SantiagoCTB/whatsapp_api

| Campo | Detalle |
|-------|---------|
| **Repo** | [SantiagoCTB/whatsapp_api](https://github.com/SantiagoCTB/whatsapp_api) |
| **Tech** | Python (Flask), WhatsApp Cloud API oficial |
| **Estado** | Activo |

### Qué es
Chatbot de WhatsApp con interfaz Flask usando la **API Cloud oficial de Meta**. Orientado a atención al cliente con respuestas preconfiguradas.

### Funcionalidades clave
- ✅ Usa API oficial de Meta (no riesgo de ban)
- ✅ Webhook para mensajes entrantes
- ✅ Reglas configurables de chatbot (step-based)
- ✅ Botones y listas interactivas
- ✅ Interfaz web para configuración
- ✅ Gestión de usuarios y autenticación
- ✅ Base de datos SQLite
- ✅ Estructura modular (routes, services, templates)

### Reutilización para nuestro MVP
**ALTA** — Es el mejor ejemplo de integración con la API oficial. Su arquitectura Flask + web UI + chatbot rules es directamente reutilizable para el componente CRM/marketing.

### Riesgos
- ✅ API oficial = sin riesgo de ban
- ⚠️ Limitaciones de la Cloud API (templates aprobados para marketing)
- ⚠️ Costo por mensaje después de límite gratuito

### Puntuación: **8/10**

---

## 6. ymow/whatsapp

| Campo | Detalle |
|-------|---------|
| **Repo** | [ymow/whatsapp](https://github.com/ymow/whatsapp) |
| **Tech** | React Native |
| **Estado** | Información limitada |

### Qué es
UI de WhatsApp en React Native. Más una demo de interfaz que una herramienta funcional.

### Reutilización para nuestro MVP
**MUY BAJA** — Solo referencia de UI si se necesita app móvil.

### Puntuación: **2/10**

---

## 7. tgalal/yowsup

| Campo | Detalle |
|-------|---------|
| **Repo** | [tgalal/yowsup](https://github.com/tgalal/yowsup) |
| **Tech** | Python |
| **Estado** | ⚠️ Última actualización: 2021. Inactivo |

### Qué es
Librería Python pionera para WhatsApp. Implementó el protocolo completo con E2E encryption.

### Reutilización para nuestro MVP
**BAJA** — Código obsoleto. Python 2.7-3.7. Protocolo desactualizado. Solo referencia histórica.

### Puntuación: **2/10**

---

## 8. Matt-Fontes/SendScriptWhatsApp

| Campo | Detalle |
|-------|---------|
| **Repo** | [Matt-Fontes/SendScriptWhatsApp](https://github.com/Matt-Fontes/SendScriptWhatsApp) |
| **Tech** | JavaScript (browser console) |
| **Estado** | Inactivo |

### Qué es
Script para pegar en la consola del browser de WhatsApp Web y enviar mensajes línea por línea (el guión de Shrek/Bee Movie).

### Reutilización para nuestro MVP
**MUY BAJA** — Es un prank. Pero demuestra el concepto de automatización vía WhatsApp Web.

### Puntuación: **1/10**

---

## 9. Ayush-Pal-cs28/whatsapp-chat-analyser

| Campo | Detalle |
|-------|---------|
| **Repo** | [Ayush-Pal-cs28/whatsapp-chat-analyser](https://github.com/Ayush-Pal-cs28/whatsapp-chat-analyser) |
| **Tech** | Python (data analysis) |
| **Estado** | Información limitada |

### Qué es
Herramienta para analizar exportaciones de chat de WhatsApp (frecuencia, palabras, etc.).

### Reutilización para nuestro MVP
**MEDIA** — Útil como referencia para el componente de analytics del CRM. Podemos inspirarnos para métricas de engagement.

### Puntuación: **5/10**

---

## 10. MosesI0/selfware.md

| Campo | Detalle |
|-------|---------|
| **Repo** | [MosesI0/selfware.md](https://github.com/MosesI0/selfware.md) |
| **Tech** | Python |
| **Estado** | Alpha |

### Qué es
Demo del "Selfware Protocol" — trata archivos como apps empaquetando data, lógica y vistas.

### Reutilización para nuestro MVP
**NULA** — No tiene relación con WhatsApp ni CRM.

### Puntuación: **1/10**

---

## 11. mugwe88-ops/MedicareAI

| Campo | Detalle |
|-------|---------|
| **Repo** | [mugwe88-ops/MedicareAI](https://github.com/mugwe88-ops/MedicareAI) |
| **Tech** | Node.js, WhatsApp API |
| **Estado** | Activo |

### Qué es
Recepcionista con IA para consultorios médicos. Maneja citas y pagos M-PESA vía WhatsApp.

### Funcionalidades clave
- ✅ Directorio buscable de doctores
- ✅ Integración WhatsApp one-click
- ✅ Gestión de citas
- ✅ OTP y sesiones
- ✅ Analytics tracking

### Reutilización para nuestro MVP
**ALTA** — Es un caso de uso muy similar al nuestro (bot + citas/reservas + WhatsApp). Su arquitectura de directorio + booking es transferible a CRM + marketing.

### Puntuación: **7/10**

---

## 12. Aadarshac/openclaw-dashboard

| Campo | Detalle |
|-------|---------|
| **Repo** | [Aadarshac/openclaw-dashboard](https://github.com/Aadarshac/openclaw-dashboard) |
| **Tech** | Node.js, HTML |
| **Estado** | Activo |

### Qué es
Dashboard para monitorear agentes OpenClaw en tiempo real.

### Reutilización para nuestro MVP
**BAJA** — Solo referencia de arquitectura de dashboard. Podemos inspirarnos para el panel de monitoreo del bot.

### Puntuación: **3/10**

---

## 13. byebye19996/workshop-crm

| Campo | Detalle |
|-------|---------|
| **Repo** | [byebye19996/workshop-crm](https://github.com/byebye19996/workshop-crm) |
| **Tech** | PHP (Laravel Livewire), Docker |
| **Estado** | Activo |

### Qué es
CRM multi-tenant para PyMEs con Kanban boards, RBAC, lead tracking y **WhatsApp integration**.

### Funcionalidades clave
- ✅ Pipeline de ventas con Kanban
- ✅ Multi-tenant
- ✅ RBAC (Business Owner, Salesperson)
- ✅ Lead tracking
- ✅ Notas y tareas
- ✅ Notificaciones email
- ✅ **Integración WhatsApp**
- ✅ Docker deployment

### Reutilización para nuestro MVP
**MUY ALTA** — Es literalmente un CRM con WhatsApp. Su modelo de datos, Kanban pipeline y roles son directamente reutilizables. Podemos tomar la lógica de negocio y re-implementar en Node.js/Python.

### Puntuación: **9/10**

---

## Tabla Resumen

| # | Repo | Tech Core | Relevancia | Puntuación | Uso en MVP |
|---|------|-----------|------------|------------|------------|
| 1 | whatsapp-web.js | Node.js/Puppeteer | 🔴 Crítica | 9/10 | **Core del bot** |
| 2 | workshop-crm | PHP/Laravel | 🔴 Crítica | 9/10 | **Referencia CRM** |
| 3 | lharries/whatsapp-mcp | Go/Python | 🟠 Alta | 8/10 | **Arquitectura IA** |
| 4 | SantiagoCTB/whatsapp_api | Python/Flask | 🟠 Alta | 8/10 | **API oficial ref** |
| 5 | Baileys ecosystem | Node.js | 🟠 Alta | 7/10 | **Alternativa core** |
| 6 | MedicareAI | Node.js | 🟠 Alta | 7/10 | **Caso de uso similar** |
| 7 | chat-analyser | Python | 🟡 Media | 5/10 | **Analytics ref** |
| 8 | mautrix/whatsapp | Go | 🟡 Baja | 4/10 | Arquitectura ref |
| 9 | openclaw-dashboard | Node.js | 🟡 Baja | 3/10 | Dashboard ref |
| 10 | ymow/whatsapp | React Native | ⚪ Muy baja | 2/10 | UI mobile ref |
| 11 | yowsup | Python | ⚪ Muy baja | 2/10 | Obsoleto |
| 12 | SendScriptWhatsApp | JS browser | ⚪ Nula | 1/10 | Nada |
| 13 | selfware.md | Python | ⚪ Nula | 1/10 | Nada |

---

## Conclusión del Análisis

Los **5 repositorios más valiosos** para nuestro MVP son:

1. **whatsapp-web.js** — El core de la conexión WhatsApp
2. **workshop-crm** — El modelo de CRM + pipeline + WhatsApp
3. **whatsapp-mcp** — La arquitectura de bot con IA (MCP + LLM)
4. **whatsapp_api** — La integración con API oficial de Meta
5. **Baileys ecosystem** — Alternativa ligera sin Puppeteer

La combinación de estos componentes nos da los bloques necesarios para construir el MVP.
