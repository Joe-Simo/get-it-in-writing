/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createEmailFixture() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "owner@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Review routing",
      slug: "review-routing",
      ownerId,
      reviewEmail: "reviewer@example.com",
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
      question: "Should the team pursue this sourced decision opportunity?",
      status: "ready",
      pageBudget: 4,
      depth: 0,
      pagesProcessed: 1,
      sourceCount: 1,
      claimCount: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    const briefId = await ctx.db.insert("briefs", {
      missionId,
      teamId,
      createdBy: ownerId,
      title: "Decision review",
      summary: "Review the evidence before acting.",
      body: "Evidence-backed brief",
      status: "ready",
      createdAt: 1,
    });
    return { ownerId, briefId };
  });
  return { t, ...fixture };
}

test("owner-approved review routes can receive a private brief", async () => {
  const { t, ownerId, briefId } = await createEmailFixture();

  const brief = await t.query(internal.emails.getSendContext, {
    briefId,
    requesterId: ownerId,
    recipientEmail: "reviewer@example.com",
  });

  expect(brief.title).toBe("Decision review");
});

test("unapproved external addresses cannot receive a private brief", async () => {
  const { t, ownerId, briefId } = await createEmailFixture();

  await expect(
    t.query(internal.emails.getSendContext, {
      briefId,
      requesterId: ownerId,
      recipientEmail: "outsider@example.com",
    }),
  ).rejects.toThrow("approved review address");
});
