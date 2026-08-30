/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createAlertFixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "alert-owner@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Lead form team",
      slug: "lead-form-team",
      ownerId,
      createdAt: 1,
    });
    await ctx.db.insert("memberships", {
      teamId,
      userId: ownerId,
      role: "owner",
      joinedAt: 1,
    });
    return { ownerId, teamId };
  });
  return { t, ...ids };
}

test("the owner can reserve one rate-limited delivery test", async () => {
  const { t, ownerId, teamId } = await createAlertFixture();
  const deliveryId = await t.mutation(internal.alerts.reserveTest, {
    teamId,
    requesterId: ownerId,
  });
  const delivery = await t.run((ctx) =>
    ctx.db.get("journeyAlertDeliveries", deliveryId),
  );
  expect(delivery).toMatchObject({
    teamId,
    kind: "test",
    status: "pending",
    attemptCount: 0,
  });
  await expect(
    t.mutation(internal.alerts.reserveTest, { teamId, requesterId: ownerId }),
  ).rejects.toThrow("already sent recently");
});

test("an alert delivery is claimed once and remains sent", async () => {
  const { t, ownerId, teamId } = await createAlertFixture();
  const deliveryId = await t.mutation(internal.alerts.reserveTest, {
    teamId,
    requesterId: ownerId,
  });
  await expect(
    t.mutation(internal.alerts.claim, { deliveryId }),
  ).resolves.toBe(true);
  await expect(
    t.mutation(internal.alerts.claim, { deliveryId }),
  ).resolves.toBe(false);
  await t.mutation(internal.alerts.markSent, {
    deliveryId,
    messageId: "message_test_alert",
  });
  await expect(
    t.mutation(internal.alerts.claim, { deliveryId }),
  ).resolves.toBe(false);
  const delivery = await t.run((ctx) =>
    ctx.db.get("journeyAlertDeliveries", deliveryId),
  );
  expect(delivery).toMatchObject({
    status: "sent",
    attemptCount: 1,
    messageId: "message_test_alert",
  });
});
