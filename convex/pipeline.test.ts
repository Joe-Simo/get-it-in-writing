/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("only one completed multi-seed callback owns synthesis", async () => {
  const t = convexTest(schema, modules);
  const { missionId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "workflow-owner@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Workflow integrity",
      slug: "workflow-integrity",
      ownerId: userId,
      createdAt: 1,
    });
    const missionId = await ctx.db.insert("missions", {
      teamId,
      createdBy: userId,
      question: "How does a multi-seed mission avoid duplicate synthesis?",
      status: "extracting",
      pageBudget: 8,
      depth: 1,
      pagesProcessed: 2,
      sourceCount: 2,
      claimCount: 2,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("missionSeeds", {
      missionId,
      url: "https://one.example.invalid",
      pageLimit: 4,
      status: "complete",
      crawlJobId: "job-one",
    });
    await ctx.db.insert("missionSeeds", {
      missionId,
      url: "https://two.example.invalid",
      pageLimit: 4,
      status: "complete",
      crawlJobId: "job-two",
    });
    return { missionId };
  });

  await expect(
    t.mutation(internal.pipeline.claimSynthesis, { missionId }),
  ).resolves.toBe(true);
  await expect(
    t.mutation(internal.pipeline.claimSynthesis, { missionId }),
  ).resolves.toBe(false);

  const briefId = await t.mutation(internal.pipeline.storeBrief, {
    missionId,
    title: "One brief",
    summary: "Only the claimed synthesis owner can write this result.",
    body: "Evidence-backed body.",
  });
  await expect(
    t.mutation(internal.pipeline.storeBrief, {
      missionId,
      title: "Duplicate brief",
      summary: "This write must be rejected.",
      body: "Duplicate body.",
    }),
  ).rejects.toThrow("Mission is not ready to store a brief");

  const result = await t.run(async (ctx) => {
    const mission = await ctx.db.get("missions", missionId);
    const briefs = await ctx.db
      .query("briefs")
      .withIndex("by_missionId", (q) => q.eq("missionId", missionId))
      .take(5);
    return { mission, briefs };
  });
  expect(result.mission?.status).toBe("ready");
  expect(result.briefs.map((brief) => brief._id)).toEqual([briefId]);
});

test("stale crawl results and failures cannot overwrite the current attempt", async () => {
  const t = convexTest(schema, modules);
  const { missionId, seedId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "late-callbacks@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Late callback lab",
      slug: "late-callback-lab",
      ownerId: userId,
      createdAt: 1,
    });
    const missionId = await ctx.db.insert("missions", {
      teamId,
      createdBy: userId,
      question: "Can stale callbacks mutate a newer crawl attempt?",
      status: "crawling",
      pageBudget: 4,
      depth: 1,
      pagesProcessed: 0,
      sourceCount: 0,
      claimCount: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    const seedId = await ctx.db.insert("missionSeeds", {
      missionId,
      url: "https://current.example.invalid",
      pageLimit: 4,
      status: "processing",
      crawlJobId: "current-job",
    });
    return { missionId, seedId };
  });

  await expect(
    t.mutation(internal.pipeline.storeProcessedSources, {
      missionId,
      seedId,
      crawlJobId: "stale-job",
      sources: [],
    }),
  ).resolves.toEqual({ accepted: false, sourceCount: 0, claimCount: 0 });
  await t.mutation(internal.pipeline.markFailed, {
    missionId,
    seedId,
    crawlJobId: "stale-job",
    error: "A late failure from the old attempt",
  });

  const beforeCurrentResult = await t.run(async (ctx) => ({
    mission: await ctx.db.get("missions", missionId),
    seed: await ctx.db.get("missionSeeds", seedId),
  }));
  expect(beforeCurrentResult.mission?.status).toBe("crawling");
  expect(beforeCurrentResult.seed?.status).toBe("processing");

  await expect(
    t.mutation(internal.pipeline.storeProcessedSources, {
      missionId,
      seedId,
      crawlJobId: "current-job",
      sources: [],
    }),
  ).resolves.toEqual({ accepted: true, sourceCount: 0, claimCount: 0 });
  await t.mutation(internal.pipeline.markFailed, {
    missionId,
    seedId,
    crawlJobId: "current-job",
    error: "A failure arriving after this seed completed",
  });

  const afterCurrentResult = await t.run(async (ctx) => ({
    mission: await ctx.db.get("missions", missionId),
    seed: await ctx.db.get("missionSeeds", seedId),
  }));
  expect(afterCurrentResult.mission?.status).toBe("extracting");
  expect(afterCurrentResult.seed?.status).toBe("complete");
});

test("partial evidence cannot revive a mission after another seed fails", async () => {
  const t = convexTest(schema, modules);
  const { missionId, seedId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "failed-mission@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Failure boundary",
      slug: "failure-boundary",
      ownerId: userId,
      createdAt: 1,
    });
    const missionId = await ctx.db.insert("missions", {
      teamId,
      createdBy: userId,
      question: "Does partial evidence preserve a failed mission state?",
      status: "failed",
      pageBudget: 4,
      depth: 1,
      pagesProcessed: 0,
      sourceCount: 0,
      claimCount: 0,
      error: "Another seed failed",
      createdAt: 1,
      updatedAt: 1,
    });
    const seedId = await ctx.db.insert("missionSeeds", {
      missionId,
      url: "https://partial.example.invalid",
      pageLimit: 2,
      status: "processing",
      crawlJobId: "partial-job",
    });
    return { missionId, seedId };
  });

  const stored = await t.mutation(internal.pipeline.storeProcessedSources, {
    missionId,
    seedId,
    crawlJobId: "partial-job",
    sources: [
      {
        url: "https://partial.example.invalid/report",
        title: "Partial result",
        excerpt: "Evidence collected before a sibling seed failed.",
        content: "A bounded source body with enough content for storage.",
        sourceHash: "partial-source-hash",
        claims: [],
      },
    ],
  });
  expect(stored).toEqual({ accepted: true, sourceCount: 1, claimCount: 0 });

  const result = await t.run(async (ctx) => ({
    mission: await ctx.db.get("missions", missionId),
    seed: await ctx.db.get("missionSeeds", seedId),
  }));
  expect(result.mission?.status).toBe("failed");
  expect(result.mission?.sourceCount).toBe(1);
  expect(result.seed?.status).toBe("complete");
});
