# MejoraWS — CRM WhatsApp Autónomo con IA

> Admin configura parámetros → IA hace todo: responde como humano, gestiona pipeline y reporta KPIs.
> **Sin Meta API** — usa Baileys (WhatsApp Web directo), $0 de costo.

## Estado actual

✅ **Fase 1 completa (Etapas 1-11) + Fase 2 avanzada**

- WhatsApp connection (Baileys multi-device)
- Auto-reply IA (Groq + Ollama fallback) con **6 templates por industria**
- CRM con contactos + pipeline de deals
- Importador CSV/XLSX/VCF/JSON con dedup 3 capas
- Anti-ban 6 capas (warm-up 14d, Gaussian delay, typing sim, template rotation)
- CLI interactivo con colores ANSI
- API REST (58+ endpoints, Zod validation, rate limiting)
- Dashboard web (Next.js 16 + shadcn/ui, 8 vistas + dark mode)
- **SSE real-time** (reemplaza polling, updates instantáneos)
- **Onboarding wizard** (5 pasos guiados)
- **PWA support** (instalable como app nativa)
- Campañas automáticas con A/B testing
- **Webhooks** (9 eventos + HMAC signature)
- JWT auth + **MFA (TOTP Google Authenticator)**
- Audit log + GDPR compliance + breach notification
- **Conversation quality scoring** por contacto
- Tests (162), CI/CD (GitHub Actions + coverage)
- Docker + producción (Dockerfile, docker-compose, nginx, backup)
- Analytics (7 endpoints, Recharts, CSV export)
- Escala (DB adapter SQLite/PG, Redis cache, Prometheus, Grafana, PM2, k6)
- Cifrado at-rest AES-256-GCM para sesión WhatsApp
- DPIA + **i18n dashboard ES/EN** + E2E tests (Playwright)
- **API docs** completo (`docs/api.md`)

## Quick Start

```bash
# 1. Clonar e instalar
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS
npm install

# 2. Configurar
cp .env.example .env
nano .env  # GROQ_API_KEY + JWT_SECRET (mínimo)

# 3. (Opcional) Instalar Ollama para LLM backup local
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b

# 4. Ejecutar
npm run dev          # Backend + CLI + API en puerto 3000
cd dashboard && npm run dev  # Dashboard en puerto 3001
```

## Docker (Producción)

```bash
cp .env.example .env
nano .env

# Sin SSL (desarrollo)
docker compose up -d

# Con SSL (producción)
./scripts/setup-ssl.sh tu-dominio.com
docker compose --profile production up -d
```

## CLI

```
🚀 mejoraws> /ayuda          # Ver todos los comandos
🚀 mejoraws> /estado         # Estado del sistema
🚀 mejoraws> /contactos      # Listar contactos
🚀 mejoraws> /importar data.csv  # Importar contactos
🚀 mejoraws> /pipeline       # Ver pipeline Kanban
🚀 mejoraws> /config         # Config del bot
🚀 mejoraws> /enviar <nro> <msg>  # Enviar mensaje
🚀 mejoraws> /followups      # Follow-ups pendientes
```

## Stack ($0)

```
WhatsApp:    Baileys (SIN Meta API)
LLM:         Groq API (gratis) + Ollama (backup local)
Database:    SQLite + better-sqlite3
API:         Express + Zod + Helmet + CORS
CLI:         ANSI codes nativos
Dashboard:   Next.js 16 + shadcn/ui + Tailwind v4
Testing:     Vitest + Supertest + Playwright
CI/CD:       GitHub Actions (Node 20/22)
Docker:      Multi-stage + docker-compose + nginx + backup
Real-time:   Server-Sent Events (SSE)
Security:    JWT + MFA (TOTP) + AES-256-GCM
Costo:       $0
```

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [Documents/MEJORAWS-DOCUMENTACION.md](Documents/MEJORAWS-DOCUMENTACION.md) | **📚 Documento maestro ÚNICO** — TODA la documentación + análisis 360° + plan por etapas |
| [Documents/CONTINUITY-PROMPT.md](Documents/CONTINUITY-PROMPT.md) | **🔄 Prompt de continuidad** — Pegar al inicio de nueva sesión |
| [docs/api.md](docs/api.md) | **📡 API Reference** — Todos los endpoints con ejemplos |
| [docs/deploy.md](docs/deploy.md) | **🚀 Deploy guide** — Docker, VPS, SSL |
| [docs/legal/PRIVACY-POLICY.md](docs/legal/PRIVACY-POLICY.md) | Privacy Policy (GDPR compliant) |
| [docs/legal/TERMS-OF-SERVICE.md](docs/legal/TERMS-OF-SERVICE.md) | Terms of Service |
| [docs/legal/DPIA.md](docs/legal/DPIA.md) | Data Protection Impact Assessment |

> **Trigger:** Cuando digas **"documentar"**, se actualizan los avances en el documento maestro.
> **Trigger:** Cuando digas **"Mimo llame lee bien esto y seguimos"**, se lee el prompt de continuidad.

## Knowledge Base Templates

Plantillas pre-armadas para configurar el bot por industria:

| Industria | Archivo |
|-----------|---------|
| Inmobiliaria | `data/templates/kb-real-estate.txt` |
| E-commerce | `data/templates/kb-ecommerce.txt` |
| Servicios Profesionales | `data/templates/kb-services.txt` |

Copiar el contenido → pegar en Config → Knowledge Base → personalizar con tus datos.

## Plan por Etapas

### ✅ Fase 1: Sistema Completo (Etapas 1-11)

| Etapa | Entregable | Estado |
|-------|-----------|--------|
| 1-3 | WhatsApp + Bot IA + CRM + CLI + Anti-ban | ✅ |
| 4 | API REST + Tests + CI/CD + Logging | ✅ |
| 5 | Dashboard web (8 vistas) | ✅ |
| 6 | Campañas + Template Rotation | ✅ |
| 7 | Seguridad + GDPR + Legal | ✅ |
| 8 | Docker + Producción | ✅ |
| 9 | Analytics + Intelligence | ✅ |
| 10 | Multi-tenancy + Escala | ✅ |
| 11 | Hardening Pre-Producción | ✅ |

### ✅ Fase 2: Mejoras Post-Producción (avanzada)

| Etapa | Entregable | Estado |
|-------|-----------|--------|
| 12 | Onboarding wizard + First-time hints | ✅ |
| 13 | SSE real-time + PWA + Cursor pagination | ✅ |
| 14 | Prompt templates (6 industrias) + Quality scoring | ✅ |
| 15 | MFA (TOTP) | ✅ |
| 16 | Webhooks + API docs | ✅ |
| 17 | Dashboard i18n ES/EN | ✅ |

### 🔜 Fase 3: Escala y Monetización

| Etapa | Entregable |
|-------|-----------|
| 18 | Multi-tenant real (PostgreSQL) |
| 19 | Kubernetes + CDN + Alerting |
| 20 | Monetización (Stripe + feature gating) |
| 21 | Growth (landing page + SEO + content) |
| 22 | Soporte operacional (tickets + FAQ) |
| 23 | Mobile (PWA completo + React Native) |

---

*$0 · Sin Meta API · 20+ módulos · 162 tests · 58+ endpoints · ~14,000 LOC · Sistema listo para beta*
