# MejoraWS — CRM WhatsApp Autónomo con IA

> Admin configura parámetros → IA hace todo: responde como humano, gestiona pipeline y reporta KPIs.
> **Sin Meta API** — usa Baileys (WhatsApp Web directo), $0 de costo.

## Estado actual

✅ **Fase 1 completa (Etapas 1-11)** — Sistema listo para producción

| Métrica | Valor |
|---------|-------|
| Tests | 176 (18 archivos) |
| Endpoints API | 52+ |
| LOC | ~10,600 |
| Costo | $0 |

### Componentes principales

- WhatsApp connection (Baileys multi-device)
- Auto-reply IA (Groq + Ollama fallback)
- CRM con contactos + pipeline de deals
- Importador CSV/XLSX/VCF/JSON
- Anti-ban 6 capas (warm-up 14d, Gaussian delay, typing sim, template rotation)
- CLI interactivo con colores ANSI
- API REST (52+ endpoints, Zod validation, rate limiting)
- Dashboard web (Next.js 16 + shadcn/ui, 8 vistas + dark mode)
- Campañas automáticas con A/B testing
- JWT auth, audit log, GDPR compliance + breach notification
- Tests (176), CI/CD (GitHub Actions + coverage)
- Docker + producción (Dockerfile, docker-compose, nginx, backup)
- Analytics (6 endpoints, Recharts, CSV export)
- Escala (DB adapter SQLite/PG, Redis cache, Prometheus, Grafana, PM2, k6)
- Cifrado at-rest AES-256-GCM para sesión WhatsApp
- DPIA + i18n (ES/EN) + E2E tests (Playwright)

## Quick Start

```bash
# 1. Instalar Ollama (LLM backup local)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b

# 2. Clonar e instalar
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS
npm install

# 3. Configurar Groq (primario, gratis)
export GROQ_API_KEY=tu-key-aqui

# 4. Ejecutar
npm run dev          # Backend + CLI + API en puerto 3000
cd dashboard && npm run dev  # Dashboard en puerto 3001
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
WhatsApp:  Baileys (SIN Meta API)
LLM:       Groq API (gratis) + Ollama (backup local)
Database:  SQLite + better-sqlite3
API:       Express + Zod + Helmet + CORS
CLI:       ANSI codes nativos
Dashboard: Next.js 16 + shadcn/ui + Tailwind v4
Testing:   Vitest + Supertest + Playwright (176 tests)
CI/CD:     GitHub Actions (Node 20/22)
Docker:    Multi-stage + docker-compose + nginx + backup
Costo:     $0
```

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [Documents/MEJORAWS-DOCUMENTACION.md](Documents/MEJORAWS-DOCUMENTACION.md) | **📚 Documento maestro ÚNICO** — TODA la documentación + análisis 36 roles + plan 3 fases (23 etapas) |
| [Documents/CONTINUITY-PROMPT.md](Documents/CONTINUITY-PROMPT.md) | **🔄 Prompt de continuidad** — Pegar al inicio de nueva sesión |
| [docs/deploy.md](docs/deploy.md) | **🚀 Deploy guide** — Docker, VPS, SSL |
| [docs/legal/DPIA.md](docs/legal/DPIA.md) | Data Protection Impact Assessment |
| [docs/legal/PRIVACY-POLICY.md](docs/legal/PRIVACY-POLICY.md) | Privacy Policy (GDPR compliant) |
| [docs/legal/TERMS-OF-SERVICE.md](docs/legal/TERMS-OF-SERVICE.md) | Terms of Service |

> **Trigger:** Cuando digas **"documentar"**, se actualizan los avances en el documento maestro.
> **Trigger:** Cuando digas **"Mimo llame lee bien esto y seguimos"**, se lee el prompt de continuidad.

## Plan por Fases

### ✅ Fase 1: Sistema Completo (Etapas 1-11) — COMPLETADA

| Etapa | Entregable | Estado |
|-------|-----------|--------|
| 1-3 | WhatsApp + Bot IA + CRM + CLI | ✅ |
| 4 | API REST + Tests + CI/CD + Logging | ✅ |
| 5 | Dashboard web (Next.js, 8 vistas) | ✅ |
| 6 | Campañas automáticas + template rotation | ✅ |
| 7 | Seguridad + GDPR + Legal | ✅ |
| 8 | Docker + Producción | ✅ |
| 9 | Analytics e Inteligencia | ✅ |
| 10 | Multi-tenancy y Escala | ✅ |
| 11 | Hardening Pre-Producción | ✅ |

### 🔄 Fase 2: Mejoras Post-Producción (Etapas 12-17)

| Etapa | Entregable | Prioridad |
|-------|-----------|-----------|
| 12 | UX y Onboarding | 🔴 Alta |
| 13 | Real-time (WebSocket) y Performance | 🔴 Alta |
| 14 | Inteligencia Avanzada (RAG, predictive) | 🟡 Media |
| 15 | Seguridad Avanzada (MFA, vault) | 🟡 Media |
| 16 | Integraciones (API pública, webhooks) | 🟡 Media |
| 17 | i18n y Localización | 🟢 Baja |

### 🚀 Fase 3: Escala y Monetización (Etapas 18-23)

| Etapa | Entregable | Prioridad |
|-------|-----------|-----------|
| 18 | Multi-Tenant Real | 🔴 Alta |
| 19 | Infraestructura de Escala (K8s) | 🔴 Alta |
| 20 | Monetización (Stripe, tiers) | 🔴 Alta |
| 21 | Growth y Marketing | 🔴 Alta |
| 22 | Soporte y Operaciones | 🟡 Media |
| 23 | Mobile (PWA / React Native) | 🟢 Baja |

---
*$0 · Sin Meta API · 20 módulos · 23 etapas planificadas · 176 tests · 52+ endpoints · Fase 1 completa · Sistema listo para producción*
