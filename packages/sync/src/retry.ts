export const RETRY_DELAYS = [1000, 2000, 4000, 8000, 30000]
export const MAX_RETRIES = 3

export function getRetryDelay(attempt: number): number {
  if (attempt < 0) return RETRY_DELAYS[0]
  if (attempt >= RETRY_DELAYS.length) return RETRY_DELAYS[RETRY_DELAYS.length - 1]
  return RETRY_DELAYS[attempt]
}
