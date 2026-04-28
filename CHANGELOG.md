# Changelog — MejoraWS

## v0.2.0-beta (29 abril 2026)

### ✨ Nuevos features
- **SSE real-time** — Server-Sent Events reemplaza polling, updates instantáneos en dashboard
- **Onboarding wizard** — 5 pasos guiados para nuevos usuarios
- **PWA support** — Service worker + manifest, instalable como app nativa
- **Cursor pagination** — Paginación eficiente para grandes datasets
- **First-time hints** — Tooltips contextuales que se muestran una vez
- **Prompt templates** — 6 industrias (real-estate, ecommerce, services, health, education, general)
- **Conversation quality scoring** — Score 0-100 por conversación, métricas agregadas
- **Webhooks** — 9 eventos, HMAC signature, delivery tracking, retry
- **MFA (TOTP)** — Compatible con Google Authenticator, backup codes
- **Dashboard i18n** — Soporte español e inglés con detección automática
- **API docs** — docs/api.md completo con ejemplos
- **KB templates** — Plantillas de knowledge base por industria
- **CLI nuevos comandos** — /webhooks, /templates, /quality

### 🔧 Mejoras
- Dashboard consume SSE en vez de polling 15s
- Auto-reply usa templates por industria para respuestas más inteligentes
- Quality endpoint mejorado con scoring detallado por conversación
- Sidebar con indicador de conexión SSE en tiempo real

### 📦 Dependencias
- socket.io-client ya estaba incluido (dashboard)
- Sin nuevas dependencias externas

### 📊 Stats
- 162 tests (19 archivos)
- 58+ endpoints API
- ~14,000 LOC

---

## v0.1.0 (29 abril 2026) — Fase 1 Completa

### Etapas 1-11
- WhatsApp (Baileys multi-device)
- Auto-reply IA (Groq + Ollama fallback)
- CRM (contactos + pipeline deals)
- Anti-ban 6 capas
- CLI interactivo con ANSI
- API REST (52+ endpoints)
- Dashboard web (8 vistas)
- Campañas automáticas
- Seguridad + GDPR + Legal
- Docker + Producción
- Analytics + Intelligence
- Multi-tenancy + Escala
- Hardening Pre-Producción

### Stats
- 140 tests (15 archivos)
- 52+ endpoints
- ~10,600 LOC
