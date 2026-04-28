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
- Último commit: (ver git log)

## ESTADO ACTUAL — COMPLETADO HASTA ETAPA 10

| Etapa | Estado | Qué incluye |
|-------|--------|-------------|
| 1-3 | ✅ | WhatsApp (Baileys) + Bot IA (Groq+Ollama) + CRM (contactos+deals+pipeline) + CLI con colores + Importador (CSV/XLSX/VCF/JSON) + Anti-ban (5/6 capas) |
| 4 | ✅ | API REST (35+ endpoints) + Tests (101) + CI/CD (GitHub Actions) + Logging (pino) + Zod validation + Rate limiting + CORS + Helmet |
| 5 | ✅ | Dashboard Web (Next.js 16 + shadcn/ui) — 7 vistas: Dashboard KPIs, Pipeline Kanban, Contactos, Campañas, Chat, Config, Login |
| 6 | ✅ | Campañas automáticas + Template Rotation (anti-ban capa 6/6 completa) + Campaign Scheduler + A/B testing de mensajes |
| 7 | ✅ | Audit log + GDPR (export/erase/consent) + Data retention + Privacy Policy + Terms of Service |
| 8 | ✅ | Docker + Producción: Dockerfile multi-stage, docker-compose, nginx, backup auto, deploy guide, Makefile, SSL setup |
| 9 | ✅ | Analytics: API (6 endpoints) + Dashboard Recharts (5 gráficas) + CSV export (4 tipos) + 9 tests |
| 10 | ✅ | Escala: DB adapter (SQLite/PG), Redis cache, Prometheus metrics, Grafana dashboard, PM2 cluster, k6 load tests |

## PLAN POST-PRODUCCIÓN (Etapas 11-13)

| Etapa | Estado | Qué incluye |
|-------|--------|-------------|
| 11 | ⏳ | Crecimiento: Landing page, SEO, Discord, YouTube, Sponsors, templates industria |
| 12 | ⏳ | Operaciones: FAQ, breach notification, i18n EN, Sentry, uptime monitoring |
| 13 | ⏳ | Monetización: Pricing tiers, Stripe, feature gating, ads, partnerships, API pública |

## TÉCNICAMENTE COMPLETADO ✅ — EN FASE DE CRECIMIENTO

## DOCUMENTACIÓN

- Documents/MEJORAWS-DOCUMENTACION.md → DOCUMENTO MAESTRO ÚNICO (TODA la doc aquí)
- Documents/CONTINUITY-PROMPT.md → Este archivo
- docs/legal/PRIVACY-POLICY.md → GDPR compliant
- docs/legal/TERMS-OF-SERVICE.md → Términos de uso

## TRIGGER: "documentar"

Cuando el usuario diga "documentar":
1. Leer Documents/MEJORAWS-DOCUMENTACION.md
2. Revisar git log desde la última entrada del timeline
3. Actualizar: timeline, estado general, decisiones técnicas, pendientes, módulos, schema, endpoints, tests
4. Commit: `docs: documentar — [resumen]`
5. Push al repo

## REGLAS

- Costo siempre $0 (Groq gratis, Ollama local, SQLite)
- Anti-ban es prioridad #1 en cada módulo de envío
- El bot nunca debe sonar a bot (tono humano, delays variables)
- NO usar Meta API — todo por Baileys
- DOCUMENTO ÚNICO: Documents/MEJORAWS-DOCUMENTACION.md
- Cuando diga "documentar": actualizar sin preguntar
- Todos los archivos en el repo: https://github.com/pabloeckert/MejoraWS
```
