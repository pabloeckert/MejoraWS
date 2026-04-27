# 🖥️ PROYECTO DESKTOP PERSONAL — MejoraWS Command Center

> **Nombre:** MejoraWS Command Center (MCC)
> **Tipo:** Aplicación desktop personal (Electron + React + TypeScript)
> **Propósito:** Centro de control personal para gestionar MejoraWS y tu productividad

---

## 💡 QUÉ ES

Un **hub de productividad desktop** que va más allá de ser solo un dashboard de MejoraWS. Es tu centro de comando personal que:

1. **Gestiona MejoraWS** — start/stop/monitor sin tocar terminal
2. **Consola de IA** — chat directo con Groq/Ollama desde tu desktop
3. **Centro de Notificaciones** — todas tus alertas en un solo lugar
4. **Productividad** — tareas, notas rápidas, timer Pomodoro
5. **Analytics en Vivo** — KPIs flotantes sobre tu trabajo
6. **Quick Actions** — atajos para todo lo que hacés seguido

### Por qué es diferente a una web app
- **System tray** — siempre accesible, nunca en el camino
- **Notificaciones nativas** — te avisa aunque estés en otra app
- **Hotkeys globales** — Ctrl+Shift+M para abrir, sin mouse
- **Offline-first** — funciona sin internet (Ollama local)
- **Sin pestañas** — no compite con tu navegador
- **Privacidad total** — todo queda en tu PC

---

## 🏗️ ARQUITECTURA

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN                         │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Tray     │ │ IPC      │ │ Auto     │ │ Hotkeys  │  │
│  │ Manager  │ │ Bridge   │ │ Updater  │ │ Global   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 NODE SERVICES                     │   │
│  │                                                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │ MejoraWS │ │ AI Chat  │ │ Notifier │        │   │
│  │  │ Manager  │ │ Engine   │ │ Service  │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘        │   │
│  │                                                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │ Task     │ │ Pomodoro │ │ Quick    │        │   │
│  │  │ Manager  │ │ Timer    │ │ Notes    │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 DATA LAYER                        │   │
│  │  SQLite (local) + JSON config + session store     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   REACT RENDERER                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 PAGES / VIEWS                      │   │
│  │                                                   │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │   │
│  │  │Dashboard│ │AI Chat │ │ Tasks  │ │ Notes  │   │   │
│  │  │ Mejora │ │        │ │        │ │        │   │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘   │   │
│  │                                                   │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │   │
│  │  │Analytics│ │Pomodoro│ │Config  │ │ About  │   │   │
│  │  │  KPIs  │ │ Timer  │ │        │ │        │   │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Tech: React 18 + TypeScript + TailwindCSS + Framer     │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 DISEÑO DE INTERFAZ

### Layout Principal

```
┌─────────────────────────────────────────────────────────┐
│ ≡ MCC  │  🔍 Buscar...            │ ☀️ │ 🔔 3 │ ⚙️ │  │
├─────────────────────────────────────────────────────────┤
│         │                                                 │
│  🏠    │  ┌─────────────────────────────────────────┐   │
│  Home  │  │                                          │   │
│         │  │          CONTENIDO PRINCIPAL             │   │
│  💬    │  │                                          │   │
│  Chat  │  │  (cambia según la vista seleccionada)    │   │
│         │  │                                          │   │
│  📋    │  │                                          │   │
│  Tasks │  │                                          │   │
│         │  │                                          │   │
│  📊    │  └─────────────────────────────────────────┘   │
│  Stats │                                                 │
│         │  ┌─────────────────────────────────────────┐   │
│  ⏱️    │  │  STATUS BAR                              │   │
│  Timer │  │  🟢 MejoraWS │ ⏱️ 25:00 │ 📊 47 msg    │   │
│         │  └─────────────────────────────────────────┘   │
│  ⚙️    │                                                 │
│  Config│                                                 │
└─────────────────────────────────────────────────────────┘
```

### System Tray

```
┌──────────────────────────────┐
│  MCC - Command Center        │
│                              │
│  🟢 MejoraWS: Conectado      │
│  📊 Hoy: 47 enviados         │
│  ⏱️ Pomodoro: 25:00           │
│                              │
│  ──────────────────────────  │
│  📋 Tareas (3 pendientes)    │
│  💬 Chat IA                  │
│  📊 Dashboard                │
│                              │
│  ──────────────────────────  │
│  ⏸️ Pausar MejoraWS           │
│  🔄 Reiniciar                │
│  ❌ Salir                    │
└──────────────────────────────┘
```

### Dashboard de MejoraWS (vista principal)

```
┌─────────────────────────────────────────────────────────┐
│  📊 MEJORAWS — Resumen del Día                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │   47     │ │   45     │ │   38     │ │   12     │  │
│  │ Enviados │ │Entregados│ │  Leídos  │ │Respuestas│  │
│  │   ↑5%    │ │  95.7%   │ │  80.9%   │ │  25.5%   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                          │
│  ┌────────────────────────────────┐ ┌────────────────┐  │
│  │  📈 Mensajes por Hora          │ │ 🎯 Pipeline    │  │
│  │                                │ │                │  │
│  │  20│    ╭─╮                    │ │ Nuevo:    12   │  │
│  │  15│  ╭─╯  ╰─╮                │ │ Contact:  8    │  │
│  │  10│╭─╯      ╰─╮              │ │ Interés:  5    │  │
│  │   5│╯          ╰──            │ │ Propuesta: 3   │  │
│  │   0└──────────────            │ │ Cerrado:  1    │  │
│  │     8  10  12  14  16  18     │ │                │  │
│  └────────────────────────────────┘ └────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  🤖 Estado del Bot                                │   │
│  │                                                    │   │
│  │  🟢 Conectado │ 🛡️ Anti-ban: Conservador │ ⏱️ 8h  │   │
│  │  Última respuesta: hace 3 min a "Laura"           │   │
│  │  Escalaciones hoy: 2                              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### AI Chat (consola de IA)

```
┌─────────────────────────────────────────────────────────┐
│  💬 AI CHAT — Groq + Ollama                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                                                    │   │
│  │  🤖 ¿En qué puedo ayudarte?                       │   │
│  │                                                    │   │
│  │  ──────────────────────────────────────────────── │   │
│  │                                                    │   │
│  │  👤 Escribime un mensaje de marketing para el     │   │
│  │     nuevo curso de Python                         │   │
│  │                                                    │   │
│  │  🤖 ¡Dale! Acá van 3 opciones:                    │   │
│  │                                                    │   │
│  │  1️⃣ "🐍 ¿Querés aprender Python desde cero?      │   │
│  │      Nuestro nuevo curso arranca el lunes.        │   │
│  │      Respondé INFO para más detalles."            │   │
│  │                                                    │   │
│  │  2️⃣ "🚀 Python te abre puertas. Curso práctico,  │   │
│  │      sin vueltas. ¿Te sumas? Escribí CURSO."     │   │
│  │                                                    │   │
│  │  3️⃣ "💡 Aprender Python nunca fue tan fácil.     │   │
│  │      8 semanas, proyectos reales. ¿Interesado?"   │   │
│  │                                                    │   │
│  │  ──────────────────────────────────────────────── │   │
│  │                                                    │   │
│  │  [Escribí tu mensaje...]                 [Enviar] │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Modelo: Groq qwen-2.5-32b │ Tokens: 1.2k │ $0.00      │
└─────────────────────────────────────────────────────────┘
```

### Pomodoro Timer

```
┌─────────────────────────────────────────────────────────┐
│  ⏱️ POMODORO TIMER                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│                    ┌─────────┐                           │
│                    │         │                           │
│                    │  25:00  │                           │
│                    │         │                           │
│                    └─────────┘                           │
│                                                          │
│  Sesión 1 de 4 │ 🍅 Trabajo │ Próximo: ☕ Descanso      │
│                                                          │
│  [▶️ Iniciar]  [⏸️ Pausar]  [⏭️ Saltar]  [🔄 Reset]     │
│                                                          │
│  ────────────────────────────────────────────────────── │
│                                                          │
│  Hoy: 🍅 4 │ ☕ 3 │ ⏱️ 2h 15m enfocado                  │
│  MejoraWS: pausado durante focus time                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Tasks

```
┌─────────────────────────────────────────────────────────┐
│  📋 TAREAS                                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [+ Nueva tarea]                                         │
│                                                          │
│  🔴 Urgente                                              │
│  ├─ ☐ Revisar campaña de marketing                     │
│  └─ ☐ Responder escalación de "Pedro"                  │
│                                                          │
│  🟠 Hoy                                                  │
│  ├─ ☑ Importar contactos nuevos (CSV)                  │
│  ├─ ☐ Actualizar knowledge base                        │
│  └─ ☐ Revisar pipeline: 3 deals estancados             │
│                                                          │
│  🟡 Esta semana                                          │
│  ├─ ☐ Configurar backup automático                     │
│  ├─ ☐ Testear warm-up día 14                           │
│  └─ ☐ Documentar procesos                              │
│                                                          │
│  Completadas: 12 │ Pendientes: 8 │ Hoy: 2/4            │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ STACK TÉCNICO

| Componente | Tecnología | Por qué |
|-----------|-----------|---------|
| **Framework** | Electron 28 | Desktop cross-platform, web tech |
| **Renderer** | React 18 + TypeScript | UI rápida, ecosistema enorme |
| **Styling** | TailwindCSS + shadcn/ui | Consistente con MejoraWS |
| **Animations** | Framer Motion | Micro-interacciones fluidas |
| **State** | Zustand | Simple, sin boilerplate |
| **Database** | better-sqlite3 | Local, rápido, $0 |
| **AI** | Groq SDK + Ollama | Mismo stack que MejoraWS |
| **Icons** | Lucide React | Consistentes, tree-shakeable |
| **Notifications** | Electron Notifier | Nativas del OS |
| **Build** | electron-builder | Multi-plataforma |
| **Costo** | $0 | Todo open source |

### Dependencias

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.4.0",
    "framer-motion": "^11.0.0",
    "zustand": "^4.5.0",
    "groq-sdk": "^0.5.0",
    "better-sqlite3": "^11.0.0",
    "lucide-react": "^0.300.0",
    "date-fns": "^3.0.0",
    "node-notifier": "^10.0.0"
  },
  "devDependencies": {
    "electron-builder": "^24.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
mcc/
├── electron/
│   ├── main.ts                  # Electron main process
│   ├── preload.ts               # Context bridge
│   ├── tray.ts                  # System tray manager
│   ├── hotkeys.ts               # Global keyboard shortcuts
│   └── updater.ts               # Auto-updater
│
├── src/
│   ├── App.tsx                  # React root
│   ├── main.tsx                 # React entry
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx        # MejoraWS overview
│   │   ├── AIChat.tsx           # Chat con IA
│   │   ├── Tasks.tsx            # Gestor de tareas
│   │   ├── Notes.tsx            # Notas rápidas
│   │   ├── Analytics.tsx        # KPIs y gráficas
│   │   ├── Pomodoro.tsx         # Timer
│   │   └── Settings.tsx         # Configuración
│   │
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── MejoraWS/
│   │   │   ├── StatusCard.tsx
│   │   │   ├── KPICards.tsx
│   │   │   ├── PipelineChart.tsx
│   │   │   └── BotStatus.tsx
│   │   ├── Chat/
│   │   │   ├── ChatBubble.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── ModelSelector.tsx
│   │   ├── Tasks/
│   │   │   ├── TaskItem.tsx
│   │   │   ├── TaskGroup.tsx
│   │   │   └── NewTask.tsx
│   │   └── Common/
│   │       ├── Timer.tsx
│   │       ├── ProgressBar.tsx
│   │       └── StatusBadge.tsx
│   │
│   ├── services/
│   │   ├── mejoraws.ts          # MejoraWS API client
│   │   ├── ai.ts                # Groq + Ollama
│   │   ├── database.ts          # SQLite operations
│   │   ├── notifications.ts     # System notifications
│   │   └── storage.ts           # JSON config storage
│   │
│   ├── stores/
│   │   ├── mejorawsStore.ts     # MejoraWS state
│   │   ├── chatStore.ts         # Chat history
│   │   ├── taskStore.ts         # Tasks state
│   │   ├── pomodoroStore.ts     # Timer state
│   │   └── settingsStore.ts     # User preferences
│   │
│   ├── hooks/
│   │   ├── useMejoraws.ts
│   │   ├── useAI.ts
│   │   ├── usePomodoro.ts
│   │   └── useHotkeys.ts
│   │
│   └── styles/
│       └── globals.css
│
├── data/
│   ├── mcc.db                   # SQLite (tasks, notes, analytics)
│   └── config.json              # User settings
│
├── assets/
│   ├── icon.png                 # App icon
│   ├── tray-icon.png            # Tray icon
│   └── sounds/
│       ├── notification.mp3
│       └── pomodoro-end.mp3
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
└── README.md
```

---

## ⚡ FUNCIONALIDADES CLAVE

### 1. MejoraWS Manager
```typescript
// src/services/mejoraws.ts
export class MejoraWSManager {
  // Estado del servicio
  async getStatus(): Promise<MejoraWSStatus> {
    return {
      connected: true,
      botActive: true,
      antiBanMode: 'conservador',
      warmupDay: 5,
      sessionHealth: 98,
      messagesToday: { sent: 47, delivered: 45, read: 38, replied: 12 }
    }
  }
  
  // Controles
  async start(): Promise<void> { /* ejecutar mejoraws */ }
  async stop(): Promise<void> { /* detener proceso */ }
  async restart(): Promise<void> { /* reiniciar */ }
  
  // Métricas en tiempo real
  async getMetrics(): Promise<Metrics> { ... }
  
  // Alertas
  async getAlerts(): Promise<Alert[]> { ... }
}
```

### 2. AI Chat (consola de IA)
```typescript
// src/services/ai.ts
export class AIChatService {
  private groq: Groq
  private ollamaAvailable: boolean
  
  async chat(message: string, context?: string): Promise<string> {
    // Intentar Groq primero
    try {
      const response = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          ...(context ? [{ role: 'system', content: context }] : []),
          { role: 'user', content: message }
        ],
        model: 'qwen-2.5-32b',
        temperature: 0.7
      })
      return response.choices[0].message.content
    } catch (error) {
      // Fallback a Ollama local
      if (this.ollamaAvailable) {
        return this.chatOllama(message, context)
      }
      throw error
    }
  }
  
  // Acciones rápidas
  async generateCampaign(product: string): Promise<string[]> { ... }
  async rewriteMessage(message: string): Promise<string> { ... }
  async analyzeSentiment(messages: string[]): Promise<SentimentResult> { ... }
  async summarizeConversation(messages: string[]): Promise<string> { ... }
}
```

### 3. Pomodoro Timer
```typescript
// src/stores/pomodoroStore.ts
export const usePomodoroStore = create((set, get) => ({
  mode: 'work', // 'work' | 'break' | 'longBreak'
  timeRemaining: 25 * 60,
  isRunning: false,
  sessions: 0,
  totalFocusTime: 0,
  
  start: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false }),
  skip: () => get().nextSession(),
  reset: () => set({ timeRemaining: 25 * 60, isRunning: false }),
  
  tick: () => {
    const { timeRemaining, mode, sessions } = get()
    if (timeRemaining <= 0) {
      // Notificación
      notifier.notify({
        title: mode === 'work' ? '🍅 ¡Descanso!' : '⏰ ¡A trabajar!',
        message: mode === 'work' ? 'Tomate 5 minutos' : 'Siguiente pomodoro'
      })
      get().nextSession()
    } else {
      set({ timeRemaining: timeRemaining - 1 })
    }
  },
  
  nextSession: () => {
    const { mode, sessions } = get()
    if (mode === 'work') {
      const newSessions = sessions + 1
      set({
        mode: newSessions % 4 === 0 ? 'longBreak' : 'break',
        timeRemaining: newSessions % 4 === 0 ? 15 * 60 : 5 * 60,
        sessions: newSessions,
        isRunning: false
      })
    } else {
      set({
        mode: 'work',
        timeRemaining: 25 * 60,
        isRunning: false
      })
    }
  }
}))
```

### 4. Notificaciones Nativas
```typescript
// electron/main.ts
import { Notification } from 'electron'

// Notificación de MejoraWS
ipcMain.handle('notify-mejoraws', (_, { title, body }) => {
  new Notification({
    title: `MejoraWS: ${title}`,
    body,
    icon: path.join(__dirname, '../assets/icon.png')
  }).show()
})

// Notificación de Pomodoro
ipcMain.handle('notify-pomodoro', (_, { title, body }) => {
  new Notification({
    title: `🍅 ${title}`,
    body,
    silent: false
  }).show()
})
```

### 5. Hotkeys Globales
```typescript
// electron/hotkeys.ts
import { globalShortcut } from 'electron'

export function registerHotkeys(mainWindow: BrowserWindow) {
  // Abrir/cerrar MCC
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
  
  // Quick note
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    mainWindow.show()
    mainWindow.webContents.send('open-quick-note')
  })
  
  // Pomodoro start/stop
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    mainWindow.webContents.send('toggle-pomodoro')
  })
  
  // AI Chat
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    mainWindow.show()
    mainWindow.webContents.send('open-ai-chat')
  })
}
```

### 6. System Tray
```typescript
// electron/tray.ts
import { Tray, Menu, nativeImage } from 'electron'

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = nativeImage.createFromPath('./assets/tray-icon.png')
  const tray = new Tray(icon)
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '🟢 MejoraWS: Conectado', enabled: false },
    { label: '📊 Hoy: 47 enviados', enabled: false },
    { type: 'separator' },
    { label: '📋 Tareas (3 pendientes)', click: () => { mainWindow.show(); navigateTo('/tasks') }},
    { label: '💬 Chat IA', click: () => { mainWindow.show(); navigateTo('/chat') }},
    { label: '📊 Dashboard', click: () => { mainWindow.show(); navigateTo('/') }},
    { type: 'separator' },
    { label: '⏸️ Pausar MejoraWS', click: () => pauseMejoraws() },
    { label: '🔄 Reiniciar', click: () => restartMejoraws() },
    { type: 'separator' },
    { label: '❌ Salir', click: () => app.quit() }
  ])
  
  tray.setToolTip('MCC - Command Center')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
  
  return tray
}
```

---

## 🚀 CÓMO EMPEZAR

### Setup Inicial
```bash
# Crear proyecto
mkdir mcc && cd mcc

# Inicializar
npm init -y

# Dependencias
npm install electron react react-dom
npm install tailwindcss @tailwindcss/vite
npm install framer-motion zustand
npm install groq-sdk better-sqlite3
npm install lucide-react date-fns

# Dev dependencies
npm install -D typescript vite @vitejs/plugin-react
npm install -D electron-builder @types/react @types/react-dom

# Estructura
mkdir -p electron src/pages src/components src/services src/stores src/hooks data assets
```

### Scripts package.json
```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "build": "vite build && electron-builder",
    "build:win": "vite build && electron-builder --win",
    "build:mac": "vite build && electron-builder --mac",
    "build:linux": "vite build && electron-builder --linux"
  }
}
```

### Desarrollo
```bash
npm run dev
# Abre la app desktop con hot-reload
```

### Build para producción
```bash
npm run build:win   # Windows (.exe)
npm run build:mac   # macOS (.dmg)
npm run build:linux # Linux (.AppImage)
```

---

## 🎯 USO DIARIO

### Mañana (2 minutos)
1. **Encendés tu PC** → MCC arranca con el sistema (auto-start)
2. **Ves en el tray** → "🟢 MejoraWS: Conectado | 📊 0 enviados"
3. **Click en tray** → Dashboard muestra estado del día

### Durante el día
1. **Llega notificación** → "🤖 Laura respondió: Me interesa"
2. **Ctrl+Shift+A** → Abrís AI Chat, pedís ayuda para responder
3. **Ctrl+Shift+N** → Quick note: "Revisar precio del curso"
4. **Pomodoro** → 25 min enfocado, 5 min descanso

### Al final del día
1. **Abrís dashboard** → "47 enviados, 12 respuestas, 1 venta"
2. **Revisás pipeline** → 3 deals movidos automáticamente
3. **Cerrás MCC** → MejoraWS sigue corriendo en background

---

## 📊 COMPARACIÓN CON ALTERNATIVAS

| Feature | MCC | Web Dashboard | Terminal | App Móvil |
|---------|-----|--------------|----------|-----------|
| System tray | ✅ | ❌ | ❌ | ❌ |
| Notificaciones nativas | ✅ | ⚠️ (web) | ❌ | ✅ |
| Hotkeys globales | ✅ | ❌ | ✅ | ❌ |
| Offline-first | ✅ | ❌ | ✅ | ⚠️ |
| Sin pestañas | ✅ | ❌ | ✅ | ✅ |
| AI Chat integrado | ✅ | ❌ | ⚠️ | ❌ |
| Pomodoro | ✅ | ❌ | ❌ | ⚠️ |
| Tasks/Notes | ✅ | ❌ | ⚠️ | ⚠️ |
| Privacidad total | ✅ | ⚠️ | ✅ | ⚠️ |

---

## 🗓️ PLAN DE DESARROLLO

### Fase 1 (Días 1-3): Shell
- [ ] Electron + React + Vite setup
- [ ] Layout con sidebar + header + status bar
- [ ] System tray básico
- [ ] Hotkeys globales
- [ ] Ventana principal con navegación

### Fase 2 (Días 4-7): MejoraWS Integration
- [ ] Dashboard de MejoraWS
- [ ] KPIs en tiempo real
- [ ] Pipeline visual
- [ ] Estado del bot
- [ ] Controles (start/stop/restart)

### Fase 3 (Días 8-10): AI Chat
- [ ] Chat con Groq
- [ ] Fallback a Ollama
- [ ] Historial de conversaciones
- [ ] Quick actions (generar campaña, reescribir, etc.)
- [ ] Selector de modelo

### Fase 4 (Días 11-14): Productividad
- [ ] Pomodoro timer con notificaciones
- [ ] Gestor de tareas
- [ ] Notas rápidas
- [ ] Integración MejoraWS + Tasks

### Fase 5 (Días 15-17): Polish
- [ ] Animaciones (Framer Motion)
- [ ] Tema oscuro/claro
- [ ] Configuración persistente
- [ ] Auto-start con el sistema
- [ ] Build multi-plataforma

---

## 💰 COSTO

| Item | Costo |
|------|-------|
| Electron | $0 |
| React + TypeScript | $0 |
| TailwindCSS | $0 |
| Groq API | $0 (free tier) |
| Ollama | $0 (local) |
| SQLite | $0 |
| Build tools | $0 |
| **TOTAL** | **$0** |

---

## 🔐 SEGURIDAD

- **Datos locales** — todo en SQLite en tu PC
- **Sin telemetría** — zero datos saliendo
- **Groq API** — solo para AI chat, no almacena datos
- **Ollama backup** — funciona 100% offline
- **Electron sandbox** — renderer aislado del main process
- **Sin analytics** — no trackeamos nada

---

*Proyecto desktop personal · Electron + React + TypeScript · $0 · 17 días de desarrollo*
*Complementa MejoraWS pero es útil por sí solo como hub de productividad*
