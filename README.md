# MejoraWS — CRM WhatsApp Autónomo con IA

> Admin configura parámetros → IA hace todo: responde como humano, gestiona pipeline y reporta KPIs.
> **Sin Meta API** — usa Baileys (WhatsApp Web directo), $0 de costo.

## Estado actual

✅ **Etapas 1-3 completadas** — CLI funcional con colores

- WhatsApp connection (Baileys multi-device)
- Auto-reply IA (Groq + Ollama)
- CRM con contactos + pipeline de deals
- Importador CSV/XLSX/VCF/JSON
- Anti-ban (Gaussian delay, typing sim, warm-up 14d)
- CLI interactivo con colores ANSI

⏳ **Siguiente:** Dashboard web (Next.js)

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
npm run dev
```

## CLI

```
🚀 mejoraws> /ayuda          # Ver todos los comandos
🚀 mejoraws> /estado         # Estado del sistema
🚀 mejoraws> /contactos      # Listar contactos
🚀 mejoraws> /importar data.csv  # Importar contactos
🚀 mejoraws> /pipeline       # Ver pipeline Kanban
🚀 mejoraws> /config         # Config del bot
```

## Stack ($0)

```
WhatsApp:  Baileys (SIN Meta API)
LLM:       Groq API (gratis) + Ollama (backup local)
Database:  SQLite + better-sqlite3
CLI:       ANSI codes nativos (sin deps externas)
Frontend:  Next.js + TailwindCSS + shadcn/ui (próximo)
Costo:     $0
```

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [Documents/01-DOCUMENTACION-CONSOLIDADA.md](Documents/01-DOCUMENTACION-CONSOLIDADA.md) | **📚 Documento maestro** — TODA la documentación |
| [Documents/PROMPT.md](Documents/PROMPT.md) | Prompt de continuidad de sesión |

> **Trigger:** Cuando digas **"documentar"**, se actualizan los avances en el documento maestro.

## Plan por Etapas

| Etapa | Entregable | Estado |
|-------|-----------|--------|
| 1 | WhatsApp + envío/recepción + anti-ban | ✅ |
| 2 | Bot IA auto-reply + orchestrator | ✅ |
| 3 | CRM + importador + pipeline | ✅ |
| 4 | Campañas automáticas | ⏳ Backlog |
| 5 | Dashboard web (Next.js) | ⏳ **Siguiente** |
| 6 | Sistema 100% autónomo | ⏳ Backlog |

---
*$0 · Sin Meta API · 6 módulos · Etapas 1-3 completadas*
