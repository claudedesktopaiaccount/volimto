const DEFAULT_MP_ACTIVITY_LIMIT = 5;
const MAX_MP_ACTIVITY_LIMIT = 20;
export const MP_ACTIVITY_SUCCESS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const MP_ACTIVITY_BASE_FAILURE_BACKOFF_MS = 15 * 60 * 1000;
export const MP_ACTIVITY_MAX_FAILURE_BACKOFF_MS = 6 * 60 * 60 * 1000;

export function parseMpActivityLimit(raw: string | null): number {
  const value = Number(raw ?? DEFAULT_MP_ACTIVITY_LIMIT);
  if (!Number.isFinite(value)) return DEFAULT_MP_ACTIVITY_LIMIT;
  return Math.max(1, Math.min(MAX_MP_ACTIVITY_LIMIT, Math.trunc(value)));
}

export function nextIsoAfter(nowMs: number, delayMs: number): string {
  return new Date(nowMs + Math.max(0, delayMs)).toISOString();
}

export function mpActivityFailureBackoffMs(
  previousFailCount: number,
  retryAfterMs?: number
): number {
  if (retryAfterMs !== undefined) {
    return Math.max(retryAfterMs, MP_ACTIVITY_BASE_FAILURE_BACKOFF_MS);
  }

  const multiplier = 2 ** Math.max(0, previousFailCount);
  return Math.min(
    MP_ACTIVITY_MAX_FAILURE_BACKOFF_MS,
    MP_ACTIVITY_BASE_FAILURE_BACKOFF_MS * multiplier
  );
}
