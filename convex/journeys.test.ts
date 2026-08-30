/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createJourneyFixture() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "journey-owner@example.invalid",
    });
    const memberId = await ctx.db.insert("users", {
      email: "journey-member@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Customer operations",
      slug: "customer-operations",
      ownerId,
      createdAt: 1,
    });
    await ctx.db.insert("memberships", {
      teamId,
      userId: ownerId,
      role: "owner",
      joinedAt: 1,
    });
    await ctx.db.insert("memberships", {
      teamId,
      userId: memberId,
      role: "member",
      joinedAt: 1,
    });
    return { ownerId, memberId, teamId };
  });
  const journeyId = await t
    .withIdentity({ subject: fixture.ownerId })
    .mutation(api.journeys.create, {
      teamId: fixture.teamId,
      name: "Quote request to confirmation",
      kind: "quote_request",
      startUrl: "https://example.com/contact",
      goal: "Ask for a quote and know the business received the request.",
      expectedSenderDomain: "example.com",
      expectedReplyMinutes: 1_440,
      cadence: "daily",
      expectsConfirmation: true,
      expectsHumanReply: false,
    });
  return { t, journeyId, ...fixture };
}

test("a journey cannot run until the owner explicitly authorizes public form testing", async () => {
  const { t, journeyId, ownerId } = await createJourneyFixture();

  await expect(
    t.mutation(internal.journeys.createRun, {
      journeyId,
      trigger: "manual",
      requesterId: ownerId,
    }),
  ).rejects.toThrow("Activate and authorize");

  const journey = await t.run((ctx) => ctx.db.get("customerJourneys", journeyId));
  expect(journey).toMatchObject({ enabled: false, status: "draft" });
});

test("team members cannot authorize external form submissions for the owner", async () => {
  const { t, journeyId, memberId } = await createJourneyFixture();

  await expect(
    t.withIdentity({ subject: memberId }).mutation(api.journeys.activate, {
      journeyId,
      authorizedPublicFormTesting: true,
    }),
  ).rejects.toThrow("Only the team owner");
});

test("one real run keeps browser and inbox evidence in the same Convex record", async () => {
  const { t, journeyId, ownerId } = await createJourneyFixture();
  const asOwner = t.withIdentity({ subject: ownerId });
  await asOwner.mutation(api.journeys.activate, {
    journeyId,
    authorizedPublicFormTesting: true,
  });
  const runId = await t.mutation(internal.journeys.createRun, {
    journeyId,
    trigger: "manual",
    requesterId: ownerId,
  });

  await t.mutation(internal.journeys.recordBrowserResult, {
    runId,
    success: true,
    summary: "The quote request showed a visible success acknowledgement.",
    scrapeId: "scrape_test",
    inboxId: "qa@example.com",
  });

  const expectation = await t.run((ctx) =>
    ctx.db
      .query("journeyEmailExpectations")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique(),
  );
  expect(expectation).toMatchObject({
    expectedKind: "confirmation",
    status: "waiting",
  });
  if (expectation === null) throw new Error("Expected an email handoff");

  await t.mutation(internal.journeys.recordEmailReceived, {
    expectationId: expectation._id,
    messageId: "message_test",
    senderDomain: "example.com",
    evidenceExcerpt: "Your request was received.",
  });

  const result = await t.run(async (ctx) => ({
    run: await ctx.db.get("journeyRuns", runId),
    checkpoints: await ctx.db
      .query("journeyCheckpoints")
      .withIndex("by_runId_and_order", (q) => q.eq("runId", runId))
      .take(10),
  }));
  expect(result.run).toMatchObject({ status: "healthy" });
  expect(result.checkpoints.map((checkpoint) => checkpoint.status)).toEqual([
    "verified",
    "verified",
    "verified",
  ]);
});

test("a team member can cancel a waiting run without opening a false incident", async () => {
  const { t, journeyId, ownerId, memberId } = await createJourneyFixture();
  await t.withIdentity({ subject: ownerId }).mutation(api.journeys.activate, {
    journeyId,
    authorizedPublicFormTesting: true,
  });
  const runId = await t.mutation(internal.journeys.createRun, {
    journeyId,
    trigger: "manual",
    requesterId: ownerId,
  });
  await t.mutation(internal.journeys.recordBrowserResult, {
    runId,
    success: true,
    summary: "The form submitted.",
    inboxId: "qa@example.com",
  });

  await t
    .withIdentity({ subject: memberId })
    .mutation(api.journeys.cancelActiveRun, { journeyId });

  const result = await t.run(async (ctx) => ({
    run: await ctx.db.get("journeyRuns", runId),
    incidents: await ctx.db
      .query("journeyIncidents")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect(),
    expectations: await ctx.db
      .query("journeyEmailExpectations")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect(),
  }));
  expect(result.run).toMatchObject({ status: "cancelled" });
  expect(result.incidents).toHaveLength(0);
  expect(result.expectations).toEqual([
    expect.objectContaining({ status: "expired" }),
  ]);
});

test("a provider failure is recorded as an execution error, not a customer incident", async () => {
  const { t, journeyId, ownerId } = await createJourneyFixture();
  await t.withIdentity({ subject: ownerId }).mutation(api.journeys.activate, {
    journeyId,
    authorizedPublicFormTesting: true,
  });
  const runId = await t.mutation(internal.journeys.createRun, {
    journeyId,
    trigger: "manual",
    requesterId: ownerId,
  });

  await t.mutation(internal.journeys.recordRunError, {
    runId,
    summary: "The provider-backed check could not complete.",
  });

  const result = await t.run(async (ctx) => ({
    run: await ctx.db.get("journeyRuns", runId),
    journey: await ctx.db.get("customerJourneys", journeyId),
    incidents: await ctx.db
      .query("journeyIncidents")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect(),
    alerts: await ctx.db
      .query("journeyAlertDeliveries")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "pending"))
      .collect(),
  }));
  expect(result.run).toMatchObject({ status: "error" });
  expect(result.journey).toMatchObject({ status: "draft" });
  expect(result.incidents).toHaveLength(0);
  expect(result.alerts).toHaveLength(0);
});

test("a customer-facing lead-form failure queues one owner alert", async () => {
  const { t, journeyId, ownerId } = await createJourneyFixture();
  await t.withIdentity({ subject: ownerId }).mutation(api.journeys.activate, {
    journeyId,
    authorizedPublicFormTesting: true,
  });
  const runId = await t.mutation(internal.journeys.createRun, {
    journeyId,
    trigger: "manual",
    requesterId: ownerId,
  });

  await t.mutation(internal.journeys.recordBrowserResult, {
    runId,
    success: false,
    summary: "The public form did not accept the test lead.",
    failureKind: "form",
  });
  await t.mutation(internal.journeys.recordBrowserResult, {
    runId,
    success: false,
    summary: "The repeated provider callback reported the same form failure.",
    failureKind: "form",
  });

  const result = await t.run(async (ctx) => {
    const incidents = await ctx.db
      .query("journeyIncidents")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect();
    const alerts = await ctx.db
      .query("journeyAlertDeliveries")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "pending"))
      .collect();
    return { incidents, alerts };
  });
  expect(result.incidents).toHaveLength(1);
  expect(result.alerts).toHaveLength(1);
  expect(result.alerts[0]).toMatchObject({
    kind: "incident",
    incidentId: result.incidents[0]?._id,
    status: "pending",
    attemptCount: 0,
  });
});
