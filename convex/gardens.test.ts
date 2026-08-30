/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("public gardens expose the brief and privacy-safe sponsor proof only", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "private@example.invalid" });
    const teamId = await ctx.db.insert("teams", {
      name: "Private estimating team",
      slug: "private-estimating-team",
      ownerId: userId,
      createdAt: 1,
    });
    const missionId = await ctx.db.insert("missions", {
      teamId,
      createdBy: userId,
      question: "Should this construction firm bid on the renovation contract?",
      status: "ready",
      pageBudget: 12,
      depth: 1,
      pagesProcessed: 3,
      sourceCount: 1,
      claimCount: 1,
      createdAt: 1,
      updatedAt: 2,
    });
    const sourceId = await ctx.db.insert("sources", {
      missionId,
      url: "https://www.acquisition.gov/far/9.104-1",
      title: "Responsibility standards",
      excerpt: "Contractors must satisfy responsibility standards.",
      content: "Public source content",
      sourceHash: "source-hash",
      retrievedAt: 2,
    });
    const claimId = await ctx.db.insert("claims", {
      missionId,
      text: "Verify responsibility before bidding.",
      summary: "Verify responsibility",
      topic: "readiness",
      status: "supported",
      confidence: 0.94,
      corroborationCount: 1,
      positionX: 0,
      positionY: 0,
      createdAt: 2,
    });
    await ctx.db.insert("claimSources", {
      missionId,
      claimId,
      sourceId,
      quote: "Private stored quote not projected separately",
      support: "supports",
    });
    const briefId = await ctx.db.insert("briefs", {
      missionId,
      teamId,
      createdBy: userId,
      title: "Conditional bid recommendation",
      summary: "Complete the responsibility file first.",
      body: "Recommendation\nProceed only after the readiness review.",
      status: "ready",
      createdAt: 3,
    });
    const deliveryId = await ctx.db.insert("emailDeliveries", {
      teamId,
      missionId,
      briefId,
      recipientEmail: "private@example.invalid",
      inboxId: "private-inbox",
      messageId: "private-message",
      threadId: "private-thread",
      status: "sent",
      createdAt: 4,
    });
    await ctx.db.insert("inboundReplies", {
      deliveryId,
      missionId,
      messageId: "private-reply",
      senderEmail: "private@example.invalid",
      intent: "comment",
      body: "Private reply body",
      status: "reviewed",
      receivedAt: 5,
    });
    await ctx.db.insert("missionEvents", {
      missionId,
      type: "email",
      label: "Verified email reply received",
      detail: "Private detail stays excluded",
      createdAt: 5,
    });
    await ctx.db.insert("publicGardens", {
      slug: "construction-bid-readiness",
      missionId,
      teamId,
      publishedBy: userId,
      publishedAt: 6,
    });
    return { missionId };
  });

  const result = await t.query(api.gardens.getPublic, {
    slug: "construction-bid-readiness",
  });

  expect(result?.brief?.title).toBe("Conditional bid recommendation");
  expect(result?.process).toMatchObject({
    pagesProcessed: 3,
    sourceCount: 1,
    claimCount: 1,
    deliveryCount: 1,
    verifiedReplyCount: 1,
  });
  expect(result?.process.events).toEqual([
    { type: "email", label: "Verified email reply received" },
  ]);
  expect(result).not.toHaveProperty("teamId");
  expect(result).not.toHaveProperty("missionId", fixture.missionId);
  expect(JSON.stringify(result)).not.toContain("private@example.invalid");
  expect(JSON.stringify(result)).not.toContain("Private reply body");
  expect(JSON.stringify(result)).not.toContain("Private detail stays excluded");
});
