/// <reference types="vite/client" />

import { expect, test } from "vitest";
import { firecrawlRetryDelayMs } from "./firecrawlRetry";

test("honors Firecrawl Retry-After seconds before exponential backoff", () => {
  expect(firecrawlRetryDelayMs(429, "45", 0, 0)).toBe(45_000);
  expect(firecrawlRetryDelayMs(429, "1", 2, 0)).toBe(20_000);
});

test("supports Retry-After dates and caps only the exponential fallback", () => {
  const now = Date.parse("2026-08-29T12:00:00.000Z");
  expect(
    firecrawlRetryDelayMs(
      429,
      "Sat, 29 Aug 2026 12:02:00 GMT",
      10,
      now,
    ),
  ).toBe(120_000);
  expect(firecrawlRetryDelayMs(503, null, 10, now)).toBe(60_000);
});

test("does not retry permanent provider responses", () => {
  expect(firecrawlRetryDelayMs(400, "30", 0, 0)).toBeNull();
  expect(firecrawlRetryDelayMs(401, null, 0, 0)).toBeNull();
});
