/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("amendment watch establishes a baseline then flags a changed notice", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "watch-owner@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Watch team",
      slug: "watch-team",
      ownerId,
      reviewEmail: "review@example.invalid",
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
      question: "Should we bid?",
      workflowKind: "prebid",
      opportunityTitle: "Real construction opportunity",
      solicitationUrl: "https://agency.example.invalid/notice",
      status: "ready",
      pageBudget: 12,
      depth: 1,
      pagesProcessed: 1,
      sourceCount: 1,
      claimCount: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    return { ownerId, missionId };
  });

  const asOwner = t.withIdentity({ subject: fixture.ownerId });
  await asOwner.mutation(api.watches.configure, {
    missionId: fixture.missionId,
    enabled: true,
  });
  const watchId = await t.run(async (ctx) => {
    const watch = await ctx.db
      .query("missionWatches")
      .withIndex("by_missionId", (q) => q.eq("missionId", fixture.missionId))
      .unique();
    if (watch === null) throw new Error("watch missing");
    return watch._id;
  });

  await expect(
    t.mutation(internal.watches.recordCheck, {
      watchId,
      sourceHash: "baseline",
      summary: "Initial baseline",
      markdown: "Initial public solicitation baseline content for testing.",
      linkInventory: ["https://agency.example.invalid/package.pdf"],
      trigger: "manual",
      impacts: [],
    }),
  ).resolves.toBeNull();
  const changeEventId = await t.mutation(internal.watches.recordCheck, {
    watchId,
    sourceHash: "changed",
    summary: "The notice changed",
    markdown: "Changed public solicitation content for testing.",
    linkInventory: ["https://agency.example.invalid/amendment-1.pdf"],
    trigger: "scheduled",
    addedText: "Amendment 1 changes the bid deadline.",
    removedText: "Initial public solicitation baseline content for testing.",
    impacts: [
      {
        title: "Confirm the revised bid deadline",
        detail: "The amendment changes the deadline used by the bid team.",
        area: "deadline",
        severity: "blocking",
        blocksRelease: true,
        sourceQuote: "Amendment 1 changes the bid deadline.",
      },
    ],
  });
  expect(changeEventId).not.toBeNull();

  const result = await t.run(async (ctx) => ({
    mission: await ctx.db.get("missions", fixture.missionId),
    change: changeEventId
      ? await ctx.db.get("changeEvents", changeEventId)
      : null,
    snapshots: await ctx.db
      .query("packageSnapshots")
      .withIndex("by_missionId", (q) => q.eq("missionId", fixture.missionId))
      .collect(),
    impacts: await ctx.db
      .query("changeImpacts")
      .withIndex("by_missionId", (q) => q.eq("missionId", fixture.missionId))
      .collect(),
  }));
  expect(result.mission?.reviewState).toBe("change_detected");
  expect(result.change).toMatchObject({ status: "detected" });
  expect(result.snapshots).toHaveLength(2);
  expect(result.impacts[0]).toMatchObject({
    title: "Confirm the revised bid deadline",
    blocksRelease: true,
  });
});
