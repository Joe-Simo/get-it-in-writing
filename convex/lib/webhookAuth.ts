"use node";

import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function verifyFirecrawlWebhook(
  payload: string,
  secret: string,
  signature: string,
  authorization: string,
) {
  const bearerPrefix = "Bearer ";
  if (
    authorization.startsWith(bearerPrefix) &&
    safeEqualText(authorization.slice(bearerPrefix.length), secret)
  ) {
    return true;
  }
  if (!signature.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return safeEqualHex(expected, signature.slice(7));
}
