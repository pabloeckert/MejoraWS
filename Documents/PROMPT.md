# PROMPT.md — Continuidad de Sesión MejoraWS

> Copiá este prompt completo al inicio de la próxima sesión para retomar exactamente donde quedamos.

---

```
Sos el asistente de desarrollo del proyecto MejoraWS.

## CONTEXTO

MejoraWS es un CRM WhatsApp autónomo con IA para uso personal. El admin configura parámetros y la IA hace todo: responde como humano, gestiona pipeline y reporta KPIs.

## REPOS

- Documentación: https://github.com/pabloeckert/MejoraWS

## ESTADO ACTUAL

- Fase: Etapa 3 completada (CLI funcional con colores)
- Documento maestro: Documents/01-DOCUMENTACION-CONSOLIDADA.md
- Stack REAL: Baileys + Groq API + Ollama + SQLite (better-sqlite3) + Express + TypeScript
- CLI: Interactivo con colores ANSI, tablas, progress bars
- Costo: $0
- DECISIÓN CLAVE: NO se usa Meta API. Todo por Baileys

## LO QUE YA FUNCIONA

1. ✅ WhatsApp connection (Baileys multi-device)
2. ✅ Envío/recepción con anti-ban (Gaussian delay, typing sim, warm-up 14d)
3. ✅ Auto-reply IA (Groq → Ollama fallback, detección intención, escalamiento)
4. ✅ CRM contactos (CRUD, importación CSV/XLSX/VCF/JSON, dedup Jaro-Winkler, scoring)
5. ✅ Pipeline deals (7 etapas, follow-ups, estadísticas)
6. ✅ CLI interactivo (/estado, /contactos, /pipeline, /importar, /config, /historial, /followups, /deal, /mover, /kb)

## LO QUE FALTA (Backlog)

1. 🔴 Dashboard web (Next.js + React + Tailwind + shadcn/ui) — SIGUIENTE ETAPA
2. 🟠 Campañas automáticas (Módulo 2)
3. 🟠 Template rotation (anti-ban capa 6)
4. 🟠 Tests unitarios
5. 🟡 Analytics y gráficas
6. 🟡 Orchestrator autónomo

## ARCHIVOS CLAVE

- Documents/01-DOCUMENTACION-CONSOLIDADA.md → DOCUMENTO MAESTRO
- Documents/PROMPT.md → Este archivo
- src/server.ts → Entry point + CLI
- src/brain/orchestrator.ts → Coordinador central
- src/cli/theme.ts → Styling ANSI

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
- Todos los archivos de doc en Documents/
```
