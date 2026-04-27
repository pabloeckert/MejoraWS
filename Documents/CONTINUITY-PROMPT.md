# CONTINUITY-PROMPT.md — Próxima Sesión MejoraWS

> **Instrucción:** Cuando inicies una nueva sesión, pegá este prompt completo para retomar donde quedamos.
> **Trigger:** Cuando digas **"Mimo llame lee bien esto y seguimos"**, leé este archivo y arrancá.

---

```
Sos el asistente de desarrollo del proyecto MejoraWS.

## INSTRUCCIÓN DE ARRANQUE

1. Leé este archivo (Documents/CONTINUITY-PROMPT.md)
2. Leé Documents/MEJORAWS-DOCUMENTACION.md para el estado completo
3. Confirmá que entendiste el estado actual
4. Preguntá qué hacemos ahora (o seguí con la etapa pendiente)

## CONTEXTO

MejoraWS es un CRM WhatsApp autónomo con IA para uso personal. El admin configura parámetros y la IA hace todo: responde como humano, gestiona pipeline y reporta KPIs.

## REPOS

- Repo: https://github.com/pabloeckert/MejoraWS
- Branch: main
- Último commit: b1165b5

## ESTADO ACTUAL — COMPLETADO HASTA ETAPA 7

| Etapa | Estado | Qué incluye |
|-------|--------|-------------|
| 1-3 | ✅ | WhatsApp (Baileys) + Bot IA (Groq+Ollama) + CRM (contactos+deals+pipeline) + CLI con colores + Importador (CSV/XLSX/VCF/JSON) + Anti-ban (5/6 capas) |
| 4 | ✅ | API REST (25+ endpoints) + Tests (101) + CI/CD (GitHub Actions) + Logging (pino) + Zod validation + Rate limiting + CORS + Helmet |
| 5 | ✅ | Dashboard Web (Next.js 16 + shadcn/ui) — 7 vistas: Dashboard KPIs, Pipeline Kanban, Contactos, Campañas, Chat, Config, Login |
| 6 | ✅ | Campañas automáticas + Template Rotation (anti-ban capa 6/6 completa) + Campaign Scheduler + A/B testing de mensajes |
| 7 | ✅ | Audit log + GDPR (export/erase/consent) + Data retention + Privacy Policy + Terms of Service |

## LO QUE FALTA (Etapas 8-9)

### Etapa 8: Docker + Producción ⏳ SIGUIENTE
- Dockerfile multi-stage
- docker-compose.yml (app + postgres + redis)
- Migración SQLite → PostgreSQL (opcional, con ORM)
- Nginx reverse proxy + SSL
- Backup automatizado
- Deploy guide

### Etapa 9: Analytics e Inteligencia ⏳ BACKLOG
- Dashboard Analytics (Recharts)
- Conversion funnel analysis
- Sentiment trend tracking
- Export reports (PDF/CSV)

## ARCHIVOS CLAVE

### Backend (src/)
- src/server.ts → Entry point + CLI + API
- src/api/index.ts → Express app + all routes
- src/api/routes/ → contacts, deals, messages, campaigns, auth, gdpr, audit, health, status
- src/api/middleware/ → error, rate-limit, validate
- src/api/schemas/ → Zod schemas
- src/brain/orchestrator.ts → Coordinador central
- src/brain/auto-reply.ts → Motor auto-respuesta
- src/whatsapp/ → client, sender, receiver
- src/crm/ → contacts, deals
- src/campaigns/ → engine, templates, scheduler
- src/security/ → audit, retention
- src/antiban/ → warmup, rate-limiter
- src/llm/ → index, groq, ollama
- src/db/database.ts → SQLite schema
- src/utils/logger.ts → Pino logging

### Dashboard (dashboard/)
- dashboard/src/app/page.tsx → Dashboard KPIs
- dashboard/src/app/pipeline/ → Kanban
- dashboard/src/app/contactos/ → CRUD contactos
- dashboard/src/app/campaigns/ → Campañas
- dashboard/src/app/chat/ → Conversaciones
- dashboard/src/app/config/ → Bot config
- dashboard/src/app/login/ → Auth
- dashboard/src/lib/api.ts → API client
- dashboard/src/lib/auth-context.tsx → Auth context
- dashboard/src/components/layout/ → Sidebar + layout

### Tests (tests/)
- tests/unit/antiban/ → rate-limiter (9), warmup (10)
- tests/unit/crm/ → contacts (7), deals (12)
- tests/unit/importer/ → cleaner (13), deduplicator (8)
- tests/unit/campaigns/ → templates (10)
- tests/unit/security/ → audit (6)
- tests/integration/api/ → contacts (11), deals (8), gdpr (7)

### Docs
- Documents/MEJORAWS-DOCUMENTACION.md → DOCUMENTO MAESTRO ÚNICO
- Documents/CONTINUITY-PROMPT.md → Este archivo
- docs/legal/PRIVACY-POLICY.md
- docs/legal/TERMS-OF-SERVICE.md

## STACK COMPLETO

| Capa | Tecnología | Costo |
|------|-----------|-------|
| Runtime | Node.js 22 + TypeScript | $0 |
| WhatsApp | Baileys (SIN Meta API) | $0 |
| LLM primario | Groq API (qwen-2.5-32b) | $0 |
| LLM backup | Ollama (llama3.1:8b) | $0 |
| Database | SQLite + better-sqlite3 | $0 |
| API | Express + Zod + Helmet + CORS | $0 |
| Dashboard | Next.js 16 + shadcn/ui + Tailwind v4 | $0 |
| Logging | Pino | $0 |
| Testing | Vitest + Supertest | $0 |
| CI/CD | GitHub Actions | $0 |

## ANTI-BAN (6/6 capas completas)

1. ✅ Warm-up 14 días (10→200 msg/día)
2. ✅ Gaussian delay (5-20s entre mensajes)
3. ✅ Typing simulation (1-3s)
4. ✅ Horario laboral (8:00-20:00)
5. ✅ Pausa cada 10 mensajes (2-5 min)
6. ✅ Template rotation (sinónimos + formato + variaciones)

## ENDPOINTS API (25+)

### Auth
- POST /api/v1/auth/login
- GET /api/v1/auth/verify

### Contacts
- GET/POST /api/v1/contacts
- GET/PUT/DELETE /api/v1/contacts/:id
- GET /api/v1/contacts/phone/:phone
- POST /api/v1/contacts/import
- GET /api/v1/contacts/stats/summary

### Deals
- GET/POST /api/v1/deals
- GET /api/v1/deals/pipeline
- GET /api/v1/deals/followups
- GET /api/v1/deals/stats
- PATCH /api/v1/deals/:id
- PATCH /api/v1/deals/:id/stage
- POST /api/v1/deals/:id/close
- POST /api/v1/deals/:id/followup

### Messages
- GET /api/v1/messages/:phone
- GET /api/v1/messages/recent/all
- POST /api/v1/messages/send
- GET /api/v1/messages/stats/sending

### Campaigns
- GET/POST /api/v1/campaigns
- GET/PATCH/DELETE /api/v1/campaigns/:id
- GET /api/v1/campaigns/:id/stats
- POST /api/v1/campaigns/:id/execute
- POST /api/v1/campaigns/:id/pause

### Status
- GET /api/v1/status
- GET/PUT /api/v1/status/config
- PUT /api/v1/status/kb

### GDPR
- GET /api/v1/gdpr/export/:phone
- DELETE /api/v1/gdpr/erase/:phone
- PUT /api/v1/gdpr/consent/:phone
- GET /api/v1/gdpr/stats

### Audit
- GET /api/v1/audit
- GET /api/v1/audit/stats
- POST /api/v1/audit/cleanup
- PUT /api/v1/audit/retention

### Health
- GET /health

## TRIGGER: "documentar"

Cuando el usuario diga "documentar":
1. Leer Documents/MEJORAWS-DOCUMENTACION.md sección "Registro de Avances"
2. Revisar git log desde la última entrada del timeline
3. Actualizar: timeline, estado general, decisiones técnicas, pendientes
4. Si hay nuevos módulos → actualizar sección "Módulos Implementados"
5. Si cambió schema → actualizar "Modelo de Datos"
6. Si hay nuevos endpoints → actualizar sección correspondiente
7. Si hay nueva etapa completada → actualizar "Plan Optimizado por Etapas"
8. Commit: `docs: documentar — [resumen]`
9. Push al repo

## REGLAS

- Costo siempre $0 (Groq gratis, Ollama local, SQLite)
- Anti-ban es prioridad #1 en cada módulo de envío
- El bot nunca debe sonar a bot (tono humano, delays variables)
- NO usar Meta API — todo por Baileys
- DOCUMENTO ÚNICO: Documents/MEJORAWS-DOCUMENTACION.md
- Cuando diga "documentar": actualizar sin preguntar
- Todos los archivos en el repo: https://github.com/pabloeckert/MejoraWS
```
