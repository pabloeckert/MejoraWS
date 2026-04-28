# MejoraWS — CRM WhatsApp Autónomo con IA

> Admin configura parámetros → IA hace todo: responde como humano, gestiona pipeline y reporta KPIs.
> **Sin Meta API** — usa Baileys (WhatsApp Web directo), $0 de costo.

## Estado actual

✅ **Etapas 1-7 completadas** — Sistema funcional

- WhatsApp connection (Baileys multi-device)
- Auto-reply IA (Groq + Ollama fallback)
- CRM con contactos + pipeline de deals
- Importador CSV/XLSX/VCF/JSON
- Anti-ban 6 capas (warm-up 14d, Gaussian delay, typing sim, template rotation)
- CLI interactivo con colores ANSI
- API REST (35+ endpoints, Zod validation, rate limiting)
- Dashboard web (Next.js 16 + shadcn/ui, 7 vistas)
- Campañas automáticas con A/B testing
- JWT auth, audit log, GDPR compliance
- Tests (101), CI/CD (GitHub Actions)

✅ **Todas las etapas completadas (1-10)**

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
Testing:   Vitest + Supertest (101 tests)
CI/CD:     GitHub Actions (Node 20/22)
Docker:    Multi-stage + docker-compose + nginx + backup
Costo:     $0
```

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [Documents/MEJORAWS-DOCUMENTACION.md](Documents/MEJORAWS-DOCUMENTACION.md) | **📚 Documento maestro ÚNICO** — TODA la documentación + análisis 360° + plan por etapas |
| [Documents/CONTINUITY-PROMPT.md](Documents/CONTINUITY-PROMPT.md) | **🔄 Prompt de continuidad** — Pegar al inicio de nueva sesión |
| [docs/legal/PRIVACY-POLICY.md](docs/legal/PRIVACY-POLICY.md) | Privacy Policy (GDPR compliant) |
| [docs/legal/TERMS-OF-SERVICE.md](docs/legal/TERMS-OF-SERVICE.md) | Terms of Service |

> **Trigger:** Cuando digas **"documentar"**, se actualizan los avances en el documento maestro.
> **Trigger:** Cuando digas **"Mimo llame lee bien esto y seguimos"**, se lee el prompt de continuidad.

## Plan por Etapas

| Etapa | Entregable | Estado |
|-------|-----------|--------|
| 1 | WhatsApp + envío/recepción + anti-ban (5 capas) | ✅ |
| 2 | Bot IA auto-reply + orchestrator | ✅ |
| 3 | CRM + importador + pipeline | ✅ |
| 4 | API REST + Tests + CI/CD + Logging | ✅ |
| 5 | Dashboard web (Next.js, 7 vistas) | ✅ |
| 6 | Campañas automáticas + template rotation (anti-ban 6/6) | ✅ |
| 7 | Seguridad + GDPR + Legal | ✅ |
| 8 | Docker + Producción | ✅ |
| 9 | Analytics e Inteligencia | ✅ |
| 10 | Multi-tenancy y Escala | ✅ |

---
*$0 · Sin Meta API · 10 módulos · Etapas 1-10 completadas · 110 tests · 43+ endpoints · Sistema completo*
