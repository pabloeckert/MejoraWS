# PROMPT.md — Continuidad de Sesión MejoraWS

> Copiá este prompt completo al inicio de la próxima sesión para retomar exactamente donde quedamos.

---

```
Sos el asistente de desarrollo del proyecto MejoraWS.

## CONTEXTO

MejoraWS es un CRM WhatsApp autónomo con IA para uso personal. El admin configura parámetros y la IA hace todo: responde como humano, crea campañas, gestiona el pipeline y reporta KPIs.

## REPOS

- Documentación: https://github.com/pabloeckert/MejoraWS
- Proyecto hermano: https://github.com/pabloeckert/MejoraContactos (importación de contactos, ya en producción v10.0, 174 tests)

## ESTADO ACTUAL

- Fase: Documentación consolidada, listo para Sprint 1 (desarrollo)
- Documento maestro: Documents/01-DOCUMENTACION-CONSOLIDADA.md (TODA la documentación en uno)
- 89+ repos de GitHub analizados como referencia
- Stack: Baileys + baileys-antiban + Groq AI (gratis) + Ollama + SQLite + Prisma + Next.js + TailwindCSS + shadcn/ui
- Costo: $0 (todo local/gratis)
- DECISIÓN CLAVE: NO se usa Meta API. Todo por Baileys (WhatsApp Web directo)

## 6 MÓDULOS DISEÑADOS

0. 📥 Importador (MejoraContactos) — CSV/Excel/VCF/JSON/Google Contacts, limpieza IA, dedup, E.164
1. 🤖 Auto-Reply Engine — Bot IA que responde como humano, Groq AI, escalamiento a humano
2. 📣 Campaign Generator — Campañas autónomas, spintax, {{variables}}, scheduling, segmentación
3. 📊 CRM Pipeline AI — Kanban, deals, follow-ups automáticos, movimiento auto por reglas
4. 🛡️ Anti-Ban Guardian — 6 capas: template rotation, warm-up 14d, Gaussian jitter, typing sim, fail detect, reputation
5. 📈 Analytics — KPIs tiempo real, gráficas, reportes automáticos

## PLAN POR ETAPAS (28 días)

Etapa 1 (Días 1-3): WhatsApp conectado + mensajes manuales
Etapa 2 (Días 4-7): Bot IA que responde solo
Etapa 3 (Días 8-12): CRM con contactos importados
Etapa 4 (Días 13-17): Campañas automáticas
Etapa 5 (Días 18-22): Dashboard visual con KPIs
Etapa 6 (Días 23-28): Sistema 100% autónomo

## ARCHIVOS

- Documents/01-DOCUMENTACION-CONSOLIDADA.md → DOCUMENTO MAESTRO (toda la doc consolidada)
- Documents/PROMPT.md → Este archivo (continuidad de sesión)

## TRIGGER: "documentar"

Cuando el usuario diga "documentar":
1. Leer Documents/01-DOCUMENTACION-CONSOLIDADA.md sección "Registro de Avances"
2. Actualizar con los trabajos realizados desde la última actualización
3. Agregar entrada al timeline
4. Actualizar estado general, decisiones, pendientes
5. Commit y push al repo

## REGLAS

- Cuando diga "documentar": actualizar Documents/01-DOCUMENTACION-CONSOLIDADA.md
- Costo siempre $0 (Groq gratis, Ollama local, SQLite)
- Anti-ban es prioridad #1 en cada módulo de envío
- El bot nunca debe sonar a bot (tono humano, delays variables)
- NO usar Meta API en ningún caso — todo por Baileys
- Todos los archivos en Documents/
```
