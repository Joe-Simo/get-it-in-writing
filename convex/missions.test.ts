/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createTeamFixture() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "budget-owner@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Budget boundary",
      slug: "budget-boundary",
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
  return { t, ...fixture };
}

test("multi-seed page limits sum exactly to the declared budget", async () => {
  const { t, ownerId, teamId } = await createTeamFixture();
  const asOwner = t.withIdentity({ subject: ownerId });

  const missionId = await asOwner.mutation(api.missions.create, {
    teamId,
    question: "How can a research mission prove its crawl budget is exact?",
    seeds: [
      "https://one.example.invalid",
      "https://two.example.invalid",
      "https://three.example.invalid",
    ],
    pageBudget: 7,
    depth: 1,
  });

  const limits = await t.run(async (ctx) => {
    const seeds = await ctx.db
      .query("missionSeeds")
      .withIndex("by_missionId", (q) => q.eq("missionId", missionId))
      .take(8);
    return seeds.map((seed) => seed.pageLimit);
  });

  expect(limits.reduce((total, limit) => total + limit, 0)).toBe(7);
  expect(limits.toSorted((left, right) => left - right)).toEqual([2, 2, 3]);
});

test("missions reject budgets that cannot cover every seed", async () => {
  const { t, ownerId, teamId } = await createTeamFixture();
  const asOwner = t.withIdentity({ subject: ownerId });

  await expect(
    asOwner.mutation(api.missions.create, {
      teamId,
      question: "Should every admitted seed receive at least one crawl page?",
      seeds: [
        "https://one.example.invalid",
        "https://two.example.invalid",
        "https://three.example.invalid",
      ],
      pageBudget: 2,
      depth: 1,
    }),
  ).rejects.toThrow("Page budget must allow at least one page per seed");
});

test("a signed-in non-member cannot create a mission for another team", async () => {
  const { t, teamId } = await createTeamFixture();
  const strangerId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "stranger@example.invalid" }),
  );
  const asStranger = t.withIdentity({ subject: strangerId });

  await expect(
    asStranger.mutation(api.missions.create, {
      teamId,
      question: "Can a non-member spend another team's research budget?",
      seeds: ["https://one.example.invalid"],
      pageBudget: 1,
      depth: 0,
    }),
  ).rejects.toThrow("403: team membership required");
});
