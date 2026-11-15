import { gaussianRandomDelayMs, isWithinSafeHours } from '@mejoraws/shared';
import { env } from '../config/env.js';

export interface SmartDripConfig {
  jitterMinSeconds: number;
  jitterMaxSeconds: number;
  batchPauseEveryN: number;
  batchPauseSeconds: number;
  safeHoursStart: string;
  safeHoursEnd: string;
}

function parseHHMM(hhmm: string, fallbackH: number, fallbackM: number): [number, number] {
  const parts = (hhmm || '').split(':');
  const h = Number.parseInt(parts[0] ?? '', 10);
  const m = Number.parseInt(parts[1] ?? '', 10);
  return [
    Number.isFinite(h) ? h : fallbackH,
    Number.isFinite(m) ? m : fallbackM,
  ];
}

export function clampToSafeHours(
  date: Date,
  safeHoursStart = env.SAFE_HOURS_START,
  safeHoursEnd = env.SAFE_HOURS_END
): Date {
  const result = new Date(date.getTime());
  if (isWithinSafeHours(result, safeHoursStart, safeHoursEnd)) {
    return result;
  }

  const [startH, startM] = parseHHMM(safeHoursStart, 8, 30);
  const [endH, endM] = parseHHMM(safeHoursEnd, 20, 30);
  const currentMinutes = result.getHours() * 60 + result.getMinutes();
  const endMinutes = endH * 60 + endM;

  if (currentMinutes > endMinutes) {
    result.setDate(result.getDate() + 1);
  }
  result.setHours(startH, startM, 0, 0);
  return result;
}

export class SmartDripCalculator {
  private readonly cfg: SmartDripConfig;

  constructor(config?: Partial<SmartDripConfig>) {
    this.cfg = {
      jitterMinSeconds: config?.jitterMinSeconds ?? env.JITTER_MIN_SECONDS,
      jitterMaxSeconds: config?.jitterMaxSeconds ?? env.JITTER_MAX_SECONDS,
      batchPauseEveryN:
        config?.batchPauseEveryN ?? env.BATCH_PAUSE_EVERY_N_MESSAGES,
      batchPauseSeconds: config?.batchPauseSeconds ?? env.BATCH_PAUSE_SECONDS,
      safeHoursStart: config?.safeHoursStart ?? env.SAFE_HOURS_START,
      safeHoursEnd: config?.safeHoursEnd ?? env.SAFE_HOURS_END,
    };
  }

  calculateSchedule(
    requestedAt: Date,
    count: number,
    urgent = false
  ): Date[] {
    if (count <= 0) return [];

    const results: Date[] = [];
    let cursor = urgent
      ? new Date(requestedAt.getTime())
      : clampToSafeHours(
          requestedAt,
          this.cfg.safeHoursStart,
          this.cfg.safeHoursEnd
        );

    const minBatchPause = Math.max(45, this.cfg.batchPauseSeconds - 15);
    const maxBatchPause = Math.max(
      minBatchPause,
      Math.min(90, this.cfg.batchPauseSeconds + 30)
    );

    for (let i = 0; i < count; i++) {
      if (i > 0) {
        const isBatchPause =
          this.cfg.batchPauseEveryN > 0 && i % this.cfg.batchPauseEveryN === 0;
        const delayMs = isBatchPause
          ? gaussianRandomDelayMs(minBatchPause, maxBatchPause)
          : gaussianRandomDelayMs(
              this.cfg.jitterMinSeconds,
              this.cfg.jitterMaxSeconds
            );

        cursor = new Date(cursor.getTime() + delayMs);
        if (!urgent) {
          cursor = clampToSafeHours(
            cursor,
            this.cfg.safeHoursStart,
            this.cfg.safeHoursEnd
          );
        }
      }
      results.push(new Date(cursor.getTime()));
    }

    return results;
  }
}
