/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function createSetupFixture() {
  const t = convexTest(schema, modules);
  const token = "a".repeat(64);
  const email = "owner@example.invalid";
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  const requestId = await t.mutation(internal.intake.reserve, {
    websiteUrl: "https://example.com",
    emailHash: await sha256(email),
    tokenHash: await sha256(token),
    expiresAt: Date.now() + 60_000,
  });
  await t.mutation(internal.intake.markSent, {
    requestId,
    messageId: "message_setup",
  });
  return { t, token, email, userId, requestId };
}

test("an emailed setup link creates one private workspace for the matching account", async () => {
  const { t, token, userId, requestId } = await createSetupFixture();
  const result = await t
    .withIdentity({ subject: userId })
    .mutation(api.intake.claimSetup, { token });

  expect(result).toMatchObject({
    websiteUrl: "https://example.com",
    businessName: "Example",
  });
  const stored = await t.run(async (ctx) => ({
    request: await ctx.db.get("websiteAuditRequests", requestId),
    profile: await ctx.db
      .query("businessProfiles")
      .withIndex("by_teamId", (q) => q.eq("teamId", result.teamId))
      .unique(),
    memberships: await ctx.db
      .query("memberships")
      .withIndex("by_teamId", (q) => q.eq("teamId", result.teamId))
      .collect(),
  }));
  expect(stored.request).toMatchObject({
    status: "claimed",
    claimedBy: userId,
  });
  expect(stored.profile).toMatchObject({
    websiteUrl: "https://example.com",
  });
  expect(stored.memberships).toEqual([
    expect.objectContaining({ userId, role: "owner" }),
  ]);
});

test("an emailed setup link rejects a different signed-in email", async () => {
  const { t, token } = await createSetupFixture();
  const otherUserId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "other@example.invalid" }),
  );

  await expect(
    t
      .withIdentity({ subject: otherUserId })
      .mutation(api.intake.claimSetup, { token }),
  ).rejects.toThrow("email address that received");
});
