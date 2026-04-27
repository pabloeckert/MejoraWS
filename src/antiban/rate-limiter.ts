// src/antiban/rate-limiter.ts
// Gaussian jitter delay para simular comportamiento humano

/**
 * Genera un delay con distribución Gaussiana
 * Media ~10s, desviación estándar ~3s
 * Mínimo 5s, máximo 20s
 */
export function gaussianDelay(mean: number = 10000, stdDev: number = 3000): number {
  // Box-Muller transform
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  const delay = mean + z * stdDev
  return Math.max(5000, Math.min(20000, Math.round(delay)))
}

/**
 * Delay para typing simulation (más corto)
 */
export function typingDelay(): number {
  return 1000 + Math.floor(Math.random() * 2000) // 1-3s
}

/**
 * Delay para pausa cada N mensajes
 */
export function pauseDelay(): number {
  return 120000 + Math.floor(Math.random() * 180000) // 2-5 min
}

/**
 * Determina si estamos en horario laboral
 */
export function isWithinSchedule(hour: number, start: number = 8, end: number = 20): boolean {
  return hour >= start && hour < end
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
