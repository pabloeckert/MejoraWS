# MejoraWS — WhatsApp Marketing + CRM + AI Bot

> Análisis de viabilidad para un MVP personal de marketing por WhatsApp con CRM integrado, bot con IA que aprende, y protección anti-ban.

## 📋 Resumen Ejecutivo

**78 repositorios de GitHub** analizados. Evaluación desde **36 perspectivas profesionales**.

| Aspecto | Resultado |
|---------|-----------|
| **Veredicto** | ✅ MVP VIABLE |
| **Costo** | $0 (tu PC + Ollama) |
| **Timeline** | 6 semanas |
| **Anti-ban** | 6 capas implementadas |
| **Bot IA** | Ollama + Llama 3.1 (local, gratis) |

## 📁 Documentación

Toda la documentación vive en **un solo archivo maestro**:

### [📄 Documents/00-PLAN-MAESTRO.md](Documents/00-PLAN-MAESTRO.md)

Contiene:
1. **Análisis de 64 repos** (Tier 1/2/3 + peligrosos)
2. **Patrones anti-ban** consolidados (6 capas)
3. **Viabilidad** desde 36 roles profesionales
4. **Marco legal** y compliance
5. **Arquitectura** del sistema (costo $0)
6. **Modelo de datos** completo (SQLite)
7. **Plan por etapas** (6 semanas, 5 etapas)
8. **Diagrama de flujo** del bot IA
9. **Checklist anti-ban**
10. **Registro de avances** (se actualiza con "documentar")

## 🔑 Las 3 Prioridades

### 1. Anti-Ban (6 capas)
```
Template Rotation → Volume Control (warm-up) → Gaussian Jitter
→ Typing Simulation → Failure Detection → Contact Reputation
```
Usa `baileys-antiban` como middleware obligatorio.

### 2. Autorespuesta IA Humana
```
Ollama + Llama 3.1 8B (local, $0)
→ Memoria con embeddings
→ Delay humano antes de responder
→ Typing indicator
→ Escalamiento a humano
→ Tono natural, nunca "bot-like"
```

### 3. Costo $0
```
Todo corre en tu PC:
  WhatsApp:  Baileys + baileys-antiban (npm, gratis)
  LLM:       Ollama + Llama 3.1 8B (local, gratis)
  Database:  SQLite + Prisma (local, gratis)
  Frontend:  Next.js (localhost:3000, gratis)
  Total:     $0/año
```

## 🚀 Para Empezar

```bash
# 1. Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# 2. Clonar y configurar
git clone https://github.com/pabloeckert/MejoraWS.git
cd MejoraWS
npm init -y
npm install baileys baileys-antiban better-sqlite3 prisma next react react-dom express

# 3. Leer el plan
cat Documents/00-PLAN-MAESTRO.md
```

## 📊 Fuentes Analizadas

| Categoría | Repos | Top Picks |
|-----------|-------|-----------|
| Core libraries | 5 | whatsapp-web.js, Baileys |
| Anti-ban | 4 | **baileys-antiban** ⭐, WhatsApp-Campaign-Bot |
| Bulk senders | 44 | dk1307, vSender, wpchatbot, wa-sender-pro |
| Campaign bots | 4 | WhatsApp-Campaign-Bot, WhatsApp-RPA, n8n workflow |
| AI frameworks | 3 | **whatsapp-ai-framework**, wa-sender-pro (Groq), WAMaX-Lite |
| Gateways | 3 | wagate, whatsapp_api, Evolution API |
| CRM | 2 | workshop-crm, MedicareAI |
| Bot IA | 2 | whatsapp-mcp, WhatsApp-RPA |
| Otros | 10 | misc |

---

*Documento consolidado el 26 de abril de 2026*
*78 repositorios analizados · 36 roles evaluados · MVP VIABLE a $0*
