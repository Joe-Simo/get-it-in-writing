/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createRequirementFixture() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "estimator@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Pre-bid operations",
      slug: "prebid-operations",
      ownerId,
      createdAt: 1,
    });
    await ctx.db.insert("memberships", {
      teamId,
      userId: ownerId,
      role: "owner",
      joinedAt: 1,
    });
    const missionId = await ctx.db.insert("missions", {
      teamId,
      createdBy: ownerId,
      question: "Should this contractor commit estimator time to this bid?",
      workflowKind: "prebid",
      opportunityTitle: "Public renovation opportunity",
      solicitationUrl: "https://agency.example.invalid/solicitation",
      decision: "undecided",
      status: "ready",
      pageBudget: 4,
      depth: 0,
      pagesProcessed: 1,
      sourceCount: 1,
      claimCount: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    const sourceId = await ctx.db.insert("sources", {
      missionId,
      url: "https://agency.example.invalid/solicitation",
      title: "Solicitation",
      excerpt: "Bid package requirements",
      content: "A bid bond must accompany the bid.",
      sourceHash: "solicitation-hash",
      retrievedAt: 1,
    });
    const claimId = await ctx.db.insert("claims", {
      missionId,
      text: "A bid bond must accompany the bid.",
      summary: "Bid bond is required with submission",
      topic: "bonding",
      status: "supported",
      confidence: 1,
      corroborationCount: 1,
      positionX: 0,
      positionY: 0,
      createdAt: 1,
    });
    const requirementId = await ctx.db.insert("requirements", {
      missionId,
      sourceId,
      claimId,
      text: "Bid bond is required with submission",
      category: "bonding",
      criticality: "disqualifier",
      status: "open",
      requiredWithBid: true,
      sourceQuote: "A bid bond must accompany the bid.",
      createdAt: 1,
      updatedAt: 1,
    });
    return { ownerId, missionId, requirementId };
  });
  return { t, ...fixture };
}

test("team members can resolve sourced requirements and record a decision", async () => {
  const { t, ownerId, missionId, requirementId } =
    await createRequirementFixture();
  const asOwner = t.withIdentity({ subject: ownerId });

  await asOwner.mutation(api.requirements.update, {
    requirementId,
    status: "satisfied",
    ownerLabel: "Estimating lead",
    note: "Bond capacity letter received",
  });
  await asOwner.mutation(api.requirements.setDecision, {
    missionId,
    decision: "bid",
    rationale: "All known disqualifiers are resolved.",
  });

  const result = await t.run(async (ctx) => ({
    requirement: await ctx.db.get("requirements", requirementId),
    mission: await ctx.db.get("missions", missionId),
  }));
  expect(result.requirement).toMatchObject({
    status: "satisfied",
    ownerLabel: "Estimating lead",
    note: "Bond capacity letter received",
  });
  expect(result.mission).toMatchObject({
    decision: "bid",
    decisionRationale: "All known disqualifiers are resolved.",
  });
});

test("non-members cannot update another team's pre-bid matrix", async () => {
  const { t, requirementId } = await createRequirementFixture();
  const strangerId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "stranger@example.invalid" }),
  );

  await expect(
    t.withIdentity({ subject: strangerId }).mutation(api.requirements.update, {
      requirementId,
      status: "not_applicable",
    }),
  ).rejects.toThrow("403: team membership required");
});
