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

- Fase: Documentación completa, listo para Sprint 1 (desarrollo)
- Commits: 8
- Documento maestro: Documents/00-PLAN-MAESTRO.md (886 líneas)
- 89+ repos de GitHub analizados como referencia
- Stack decidido: Baileys + baileys-antiban + Groq AI (gratis) + Ollama + SQLite + Prisma + Next.js + TailwindCSS + shadcn/ui
- Costo: $0 (todo local/gratis)

## 6 MÓDULOS DISEÑADOS

0. 📥 Importador (MejoraContactos) — CSV/Excel/VCF/JSON/Google Contacts, limpieza IA, dedup, E.164, detección WhatsApp
1. 🤖 Auto-Reply Engine — Bot IA que responde como humano, Groq AI, memoria semántica, escalamiento a humano
2. 📣 Campaign Generator — Campañas autónomas, spintax, {{variables}}, scheduling, segmentación
3. 📊 CRM Pipeline AI — Kanban, deals, follow-ups automáticos, movimiento auto por reglas
4. 🛡️ Anti-Ban Guardian — 6 capas: template rotation, warm-up 14d, Gaussian jitter, typing sim, fail detect, reputation
5. 📈 Analytics — KPIs tiempo real, gráficas, reportes automáticos

## ANTI-BAN (6 CAPAS)

1. Template Rotation: 3-5 variaciones, spintax
2. Volume Control: warm-up 14 días (10→200 msg/día)
3. Timing Humanization: Gaussian jitter 8-15s, pausa cada 10 msgs
4. Behavior Simulation: typing indicator, idle actions
5. Failure Detection: auto-stop 5 fallos o >30% failure rate
6. Contact Reputation: skip bloqueados, no re-enviar <7 días

## LLM $0

- Primario: Groq API free tier (qwen-2.5-32b, ~30 req/min)
- Backup: Ollama + Llama 3.1 8B (local)
- Embeddings: Ollama + nomic-embed-text

## PLAN POR SPRINTS

Sprint 1 (Semana 1): Setup + WhatsApp + Anti-ban
Sprint 2 (Semana 2): Motor auto-respuesta IA
Sprint 3 (Semana 3): CRM + Importación MejoraContactos
Sprint 4 (Semana 4): Marketing + Campaigns
Sprint 5 (Semana 5): Dashboard + KPIs
Sprint 6 (Semana 6): Autonomous orchestrator

## PARÁMETROS DEL ADMIN (JSON)

El admin configura desde el dashboard:
- negocio (nombre, descripción, horario)
- knowledge base (productos, FAQ, políticas)
- bot (nombre, personalidad, reglas especiales)
- marketing (frecuencia, límites, segmentación)
- pipeline (etapas, auto-mover, follow-ups)

## ARCHIVOS IMPORTANTES

- Documents/00-PLAN-MAESTRO.md → Documentación completa (886 líneas)
- README.md → Resumen ejecutivo

## QUÉ HACER AHORA

1. Leer Documents/00-PLAN-MAESTRO.md para contexto completo
2. Preguntar si arrancamos con Sprint 1 o hay cambios
3. Si arrancamos: crear estructura de proyecto, instalar dependencias, conectar WhatsApp

## REGLAS

- Cuando diga "documentar": actualizar Documents/00-PLAN-MAESTRO.md sección "REGISTRO DE AVANCES" con el estado actual
- Costo siempre $0 (Groq gratis, Ollama local, SQLite)
- Anti-ban es prioridad #1 en cada módulo de envío
- El bot nunca debe sonar a bot (tono humano, delays variables)
- Todos los archivos en Documents/
```

---

*Copia todo el bloque de arriba (desde "Sos el asistente..." hasta el último ```) y pegalo como primer mensaje en la próxima sesión.*
