import { createHmac } from "node:crypto";
import { expect, test } from "vitest";
import { verifyFirecrawlWebhook } from "./webhookAuth";

const payload = JSON.stringify({ type: "crawl.completed", id: "crawl-id" });
const secret = "project-scoped-webhook-secret";

test("accepts the project-scoped Firecrawl authorization header", () => {
  expect(
    verifyFirecrawlWebhook(payload, secret, "", `Bearer ${secret}`),
  ).toBe(true);
  expect(
    verifyFirecrawlWebhook(payload, secret, "", "Bearer wrong-secret"),
  ).toBe(false);
});

test("also accepts Firecrawl's official HMAC signature", () => {
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  expect(
    verifyFirecrawlWebhook(payload, secret, `sha256=${signature}`, ""),
  ).toBe(true);
});
