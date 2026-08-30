/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createUserFixture() {
  const t = convexTest(schema, modules);
  const ownerId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "owner@example.invalid" }),
  );
  const otherId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "other@example.invalid" }),
  );
  return { t, ownerId, otherId };
}

test("a decision is private and starts bounded research without contacting anyone", async () => {
  const { t, ownerId, otherId } = await createUserFixture();
  const decisionId = await t.withIdentity({ subject: ownerId }).mutation(
    api.decisions.create,
    {
      sourceUrl: "https://www.example.com/hotel#rooms",
      requirementText: "We need connecting rooms, not merely adjacent rooms.",
      context: "December 12–14, two rooms",
    },
  );

  const detail = await t
    .withIdentity({ subject: ownerId })
    .query(api.decisions.getDetail, { decisionId });
  expect(detail?.decision).toMatchObject({
    sourceUrl: "https://www.example.com/hotel",
    sourceHost: "example.com",
    status: "scoping",
  });
  expect(detail?.requirements).toEqual([
    expect.objectContaining({
      text: "We need connecting rooms, not merely adjacent rooms.",
    }),
  ]);
  expect(detail?.requests).toHaveLength(0);

  await expect(
    t
      .withIdentity({ subject: otherId })
      .query(api.decisions.getDetail, { decisionId }),
  ).resolves.toBeNull();
});

test("verified official evidence can create a private source-backed Proof Card", async () => {
  const { t, ownerId } = await createUserFixture();
  const decisionId = await t.run((ctx) =>
    ctx.db.insert("decisions", {
      ownerId,
      title: "Decision about example.com",
      sourceUrl: "https://example.com/rooms",
      sourceHost: "example.com",
      requirementText: "We need connecting rooms, not merely adjacent rooms.",
      category: "hotel",
      status: "analyzing",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const requirementId = await t.run((ctx) =>
    ctx.db.insert("decisionRequirements", {
      decisionId,
      ownerId,
      text: "We need connecting rooms, not merely adjacent rooms.",
      order: 0,
      createdAt: 1,
    }),
  );

  await t.mutation(internal.decisions.storeAnalysis, {
    decisionId,
    title: "Connecting rooms at Example Hotel",
    category: "hotel",
    sources: [
      {
        crawlId: "crawl_verified",
        url: "https://example.com/rooms",
        title: "Rooms",
        contentHash: "a".repeat(64),
        excerpt: "Connecting rooms can be reserved as a pair.",
        capturedAt: 2,
      },
    ],
    assessments: [
      {
        requirementId,
        status: "established",
        statement: "Connecting rooms are reservable.",
        reason: "The official room policy says so directly.",
        sourceUrl: "https://example.com/rooms",
        sourceTitle: "Rooms",
        sourceExcerpt: "Connecting rooms can be reserved as a pair.",
        order: 0,
      },
    ],
    contacts: [],
    fullyEstablished: true,
    summary: "The official policy establishes the exact requirement.",
    draftSubject: "Unused",
    draftBody: "Unused",
  });

  const detail = await t
    .withIdentity({ subject: ownerId })
    .query(api.decisions.getDetail, { decisionId });
  expect(detail?.decision.status).toBe("fully_established");
  expect(detail?.proofCard).toMatchObject({
    basis: "official_source",
    verdict: "confirmed",
    exactRequirement: "We need connecting rooms, not merely adjacent rooms.",
  });
  expect(detail?.requests).toHaveLength(0);
});

test("a consequential gap produces one editable request and requires user approval", async () => {
  const { t, ownerId } = await createUserFixture();
  const { decisionId, requirementId } = await t.run(async (ctx) => {
    const id = await ctx.db.insert("decisions", {
      ownerId,
      title: "Decision about example.com",
      sourceUrl: "https://example.com/rooms",
      sourceHost: "example.com",
      requirementText: "We need connecting rooms, not merely adjacent rooms.",
      category: "hotel",
      status: "analyzing",
      createdAt: 1,
      updatedAt: 1,
    });
    const requirement = await ctx.db.insert("decisionRequirements", {
      decisionId: id,
      ownerId,
      text: "We need connecting rooms, not merely adjacent rooms.",
      order: 0,
      createdAt: 1,
    });
    return { decisionId: id, requirementId: requirement };
  });

  const requestId = await t.mutation(internal.decisions.storeAnalysis, {
    decisionId,
    title: "Connecting room decision",
    category: "hotel",
    sources: [
      {
        crawlId: "crawl_gap",
        url: "https://example.com/rooms",
        title: "Rooms",
        contentHash: "b".repeat(64),
        excerpt: "Adjacent rooms may be requested, subject to availability.",
        capturedAt: 2,
      },
    ],
    assessments: [
      {
        requirementId,
        status: "vague_or_conditional",
        statement: "Only adjacent rooms are discussed.",
        reason: "The page does not establish a connecting doorway.",
        sourceUrl: "https://example.com/rooms",
        sourceTitle: "Rooms",
        sourceExcerpt: "Adjacent rooms may be requested, subject to availability.",
        order: 0,
      },
    ],
    contacts: [
      {
        email: "reservations@example.com",
        label: "Reservations",
        sourceUrl: "https://example.com/contact",
        sourceExcerpt: "Reservations: reservations@example.com",
      },
    ],
    fullyEstablished: false,
    summary: "The exact connecting-room requirement is not established.",
    draftSubject: "Connecting-room confirmation",
    draftBody: "Please confirm whether the two rooms have an internal connecting door.",
  });
  expect(requestId).not.toBeNull();
  if (requestId === null) throw new Error("Expected a confirmation request");

  const detail = await t
    .withIdentity({ subject: ownerId })
    .query(api.decisions.getDetail, { decisionId });
  expect(detail?.decision.status).toBe("awaiting_approval");
  expect(detail?.requests).toEqual([
    expect.objectContaining({
      _id: requestId,
      recipient: "reservations@example.com",
      recipientSource: "official_page",
      status: "draft",
      followUpCount: 0,
    }),
  ]);
  expect(detail?.proofCard).toBeNull();
});
