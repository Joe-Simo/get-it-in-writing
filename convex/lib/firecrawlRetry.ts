const BASE_RETRY_DELAY_MS = 5_000;
const MAX_EXPONENTIAL_DELAY_MS = 60_000;

function retryAfterDelayMs(value: string | null, now: number) {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - now);
}

export function firecrawlRetryDelayMs(
  status: number,
  retryAfter: string | null,
  attempt: number,
  now = Date.now(),
) {
  const retryable =
    status === 408 || status === 425 || status === 429 || status >= 500;
  if (!retryable) return null;
  const backoff = Math.min(
    MAX_EXPONENTIAL_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt),
  );
  return Math.max(backoff, retryAfterDelayMs(retryAfter, now) ?? 0);
}
