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

MejoraWS es un CRM WhatsApp autónomo con IA para uso personal/empresarial. El admin configura parámetros y la IA hace todo: responde como humano, gestiona pipeline y reporta KPIs.

## REPOS

- Repo: https://github.com/pabloeckert/MejoraWS
- Branch: main
- Último commit: (ver git log)

## ESTADO ACTUAL — FASE 1 COMPLETA (Etapas 1-11)

| Fase | Estado | Qué incluye |
|------|--------|-------------|
| Fase 1 | ✅ COMPLETA | Sistema completo funcional: WhatsApp (Baileys) + Bot IA (Groq+Ollama) + CRM (contactos+deals+pipeline) + CLI + Importador + Anti-ban (6 capas) + API REST (52+ endpoints) + Dashboard (8 vistas) + Campañas + GDPR + Docker + Analytics + Escala + Hardening |
| Fase 2 | ❌ PENDIENTE | Mejoras post-producción: UX/onboarding, real-time (WebSocket), inteligencia avanzada (RAG), seguridad avanzada (MFA), integraciones, i18n |
| Fase 3 | ❌ PENDIENTE | Escala y monetización: multi-tenant real, Kubernetes, Stripe, growth, landing page, mobile |

## MÉTRICAS

- Tests: 176 (18 archivos) — todos passing
- Endpoints: 52+
- LOC: ~10,600
- Costo: $0

## SIGUIENTE: FASE 2 — Mejoras Post-Producción

Prioridades inmediatas:
1. Etapa 12: UX y Onboarding (wizard, tooltips, WCAG)
2. Etapa 13: Real-time (WebSocket, PWA)
3. Etapa 14: Inteligencia Avanzada (RAG, predictive scoring)

## DOCUMENTACIÓN

- Documents/MEJORAWS-DOCUMENTACION.md → DOCUMENTO MAESTRO ÚNICO (TODA la doc aquí, 18 secciones)
- Documents/CONTINUITY-PROMPT.md → Este archivo
- docs/deploy.md → Deploy guide (Docker, VPS, SSL)
- docs/legal/DPIA.md → Data Protection Impact Assessment
- docs/legal/PRIVACY-POLICY.md → GDPR compliant
- docs/legal/TERMS-OF-SERVICE.md → Términos de uso

## TRIGGER: "documentar"

Cuando el usuario diga "documentar":
1. Leer Documents/MEJORAWS-DOCUMENTACION.md
2. Revisar git log desde la última entrada del timeline
3. Actualizar: resumen ejecutivo, timeline, estado general, decisiones técnicas, pendientes, módulos, schema, endpoints, tests, dashboard, fase actual
4. Commit: `docs: documentar — [resumen]`
5. Push al repo

## TRIGGER: "Mimo llame lee bien esto y seguimos"

Cuando el usuario diga esto:
1. Leer este archivo (Documents/CONTINUITY-PROMPT.md)
2. Leer Documents/MEJORAWS-DOCUMENTACION.md
3. Confirmar estado actual (Fase 1 completa, Fase 2 pendiente)
4. Preguntar qué hacemos (o continuar con la etapa pendiente de Fase 2)

## REGLAS

- Costo siempre $0 (Groq gratis, Ollama local, SQLite)
- Anti-ban es prioridad #1 en cada módulo de envío
- El bot nunca debe sonar a bot (tono humano, delays variables)
- NO usar Meta API — todo por Baileys
- DOCUMENTO ÚNICO: Documents/MEJORAWS-DOCUMENTACION.md
- Cuando diga "documentar": actualizar sin preguntar
- Todos los archivos en el repo: https://github.com/pabloeckert/MejoraWS
```
