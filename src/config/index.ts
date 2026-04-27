// src/config/index.ts
// Configuración central de MejoraWS

export interface Config {
  // WhatsApp
  sessionPath: string
  
  // Anti-ban
  antiBan: {
    mode: 'conservador' | 'moderado' | 'agresivo'
    warmupDays: number
    maxMessagesPerDay: number
    minDelayMs: number
    maxDelayMs: number
    pauseEveryN: number
    pauseDurationMs: [number, number]
    typingDurationMs: [number, number]
  }
  
  // Horario
  schedule: {
    startHour: number
    endHour: number
    timezone: string
  }
  
  // Database
  dbPath: string
}

const defaultConfig: Config = {
  sessionPath: './data/session',
  
  antiBan: {
    mode: 'conservador',
    warmupDays: 14,
    maxMessagesPerDay: 100,
    minDelayMs: 8000,
    maxDelayMs: 15000,
    pauseEveryN: 10,
    pauseDurationMs: [120000, 300000], // 2-5 min
    typingDurationMs: [1000, 3000],
  },
  
  schedule: {
    startHour: 8,
    endHour: 20,
    timezone: 'America/Buenos_Aires',
  },
  
  dbPath: './data/mejoraws.db',
}

export function loadConfig(): Config {
  // Por ahora devuelve defaults. Futuro: cargar desde JSON/DB
  return defaultConfig
}

export default defaultConfig
