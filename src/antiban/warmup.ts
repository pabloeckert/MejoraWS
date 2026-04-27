// src/antiban/warmup.ts
// Sistema de warm-up gradual para anti-ban

import * as fs from 'fs'

interface WarmupState {
  day: number
  sentToday: number
  lastResetDate: string
  startDate: string
}

// Tabla de warm-up: mensajes por día
const WARMUP_TABLE: Record<number, number> = {
  1: 10, 2: 12, 3: 15, 4: 18, 5: 22,
  6: 28, 7: 35, 8: 45, 9: 55, 10: 70,
  11: 85, 12: 100, 13: 120, 14: 150,
}
const MAX_MESSAGES = 200

export class WarmupManager {
  private state: WarmupState
  private statePath: string

  constructor(statePath: string = './data/warmup.json') {
    this.statePath = statePath
    this.state = this.loadState()
  }

  private loadState(): WarmupState {
    try {
      if (fs.existsSync(this.statePath)) {
        const data = fs.readFileSync(this.statePath, 'utf-8')
        return JSON.parse(data)
      }
    } catch {}
    
    // Estado inicial
    return {
      day: 1,
      sentToday: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
    }
  }

  private saveState(): void {
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2))
  }

  /**
   * Verifica si se puede enviar un mensaje
   */
  canSend(): boolean {
    this.checkDayReset()
    const limit = this.getDailyLimit()
    return this.state.sentToday < limit
  }

  /**
   * Registra un mensaje enviado
   */
  recordSend(): void {
    this.state.sentToday++
    this.saveState()
  }

  /**
   * Obtiene el límite diario actual según el día de warm-up
   */
  getDailyLimit(): number {
    if (this.state.day >= 14) return MAX_MESSAGES
    return WARMUP_TABLE[this.state.day] || 10
  }

  /**
   * Obtiene el día actual de warm-up
   */
  getCurrentDay(): number {
    return this.state.day
  }

  /**
   * Obtiene mensajes enviados hoy
   */
  getSentToday(): number {
    this.checkDayReset()
    return this.state.sentToday
  }

  /**
   * Obtiene el porcentaje de warm-up completado
   */
  getWarmupProgress(): number {
    return Math.min(100, Math.round((this.state.day / 14) * 100))
  }

  /**
   * Verifica si el warm-up está completo
   */
  isWarmupComplete(): boolean {
    return this.state.day >= 14
  }

  /**
   * Resetea el contador si cambió el día
   */
  private checkDayReset(): void {
    const today = new Date().toISOString().split('T')[0]
    if (today !== this.state.lastResetDate) {
      this.state.sentToday = 0
      this.state.lastResetDate = today
      if (this.state.day < 14) {
        this.state.day++
      }
      this.saveState()
    }
  }

  /**
   * Estado resumido para display
   */
  getStatus(): string {
    const limit = this.getDailyLimit()
    const progress = this.getWarmupProgress()
    return `Día ${this.state.day}/14 | ${this.state.sentToday}/${limit} enviados | ${progress}% warm-up`
  }

  /**
   * Fuerza reinicio (para testing)
   */
  reset(): void {
    this.state = {
      day: 1,
      sentToday: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
    }
    this.saveState()
  }
}
