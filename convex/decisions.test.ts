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
  expect(detail?.requirements).toHaveLength(0);
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
        languageStrength: "direct",
        assessedScope: "Two rooms with an internal connecting door",
        sourceUrl: "https://example.com/rooms",
        sourceTitle: "Rooms",
        sourceExcerpt: "Connecting rooms can be reserved as a pair.",
        evidence: [{
          sourceUrl: "https://example.com/rooms",
          sourceTitle: "Rooms",
          sourceExcerpt: "Connecting rooms can be reserved as a pair.",
          supports: true,
        }],
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
  expect(detail?.proofItems).toEqual([
    expect.objectContaining({
      verdict: "confirmed",
      requirementText: "We need connecting rooms, not merely adjacent rooms.",
    }),
  ]);
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
        status: "conditional",
        statement: "Only adjacent rooms are discussed.",
        reason: "The page does not establish a connecting doorway.",
        languageStrength: "qualified",
        assessedScope: "Adjacent rooms only",
        sourceUrl: "https://example.com/rooms",
        sourceTitle: "Rooms",
        sourceExcerpt: "Adjacent rooms may be requested, subject to availability.",
        evidence: [{
          sourceUrl: "https://example.com/rooms",
          sourceTitle: "Rooms",
          sourceExcerpt: "Adjacent rooms may be requested, subject to availability.",
          supports: true,
        }],
        ambiguity: {
          kind: "conditional",
          explanation: "Availability is not guaranteed and connecting rooms are not established.",
        },
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

test("the reliance map preserves conflict, scope mismatch, and missing evidence as distinct gaps", async () => {
  const { t, ownerId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example stay",
      sourceUrl: "https://example.com/stay",
      sourceHost: "example.com",
      requirementText: "We need free parking, cancellation until 48 hours before arrival, and no resort fee.",
      category: "hotel",
      status: "analyzing",
      createdAt: 1,
      updatedAt: 1,
    });
    const texts = ["Free parking", "Cancellation until 48 hours before arrival", "No resort fee"];
    const requirementIds = [];
    for (const [order, text] of texts.entries()) {
      requirementIds.push(await ctx.db.insert("decisionRequirements", {
        decisionId,
        ownerId,
        text,
        order,
        createdAt: 1,
      }));
    }
    return { decisionId, requirementIds };
  });
  const [parkingId, cancellationId, feeId] = fixture.requirementIds;
  if (!parkingId || !cancellationId || !feeId) throw new Error("Missing requirement fixture");
  await t.mutation(internal.decisions.storeAnalysis, {
    decisionId: fixture.decisionId,
    title: "Example stay",
    category: "hotel",
    sources: [{
      crawlId: "crawl_scoped",
      url: "https://example.com/stay",
      title: "Stay policies",
      contentHash: "c".repeat(64),
      excerpt: "Parking and cancellation policies.",
      capturedAt: 2,
    }],
    assessments: [
      {
        requirementId: parkingId,
        status: "conflicting",
        statement: "Official parking language conflicts.",
        reason: "One passage says parking is included and another lists a daily charge.",
        languageStrength: "conflicting",
        assessedScope: "Parking for this stay",
        sourceUrl: "https://example.com/stay",
        sourceTitle: "Stay policies",
        sourceExcerpt: "Complimentary parking is included.",
        evidence: [
          { sourceUrl: "https://example.com/stay", sourceTitle: "Stay policies", sourceExcerpt: "Complimentary parking is included.", supports: true },
          { sourceUrl: "https://example.com/fees", sourceTitle: "Fees", sourceExcerpt: "Self-parking is $25 nightly.", supports: false },
        ],
        ambiguity: { kind: "conflicting", explanation: "Two official passages materially disagree." },
        order: 0,
      },
      {
        requirementId: cancellationId,
        status: "scope_mismatch",
        statement: "The published cancellation window applies to a different rate.",
        reason: "The flexible-rate policy does not establish the selected prepaid rate.",
        languageStrength: "qualified",
        assessedScope: "Flexible rate, not prepaid rate",
        sourceUrl: "https://example.com/stay",
        sourceTitle: "Stay policies",
        sourceExcerpt: "Flexible rates may be cancelled 48 hours before arrival.",
        evidence: [{ sourceUrl: "https://example.com/stay", sourceTitle: "Stay policies", sourceExcerpt: "Flexible rates may be cancelled 48 hours before arrival.", supports: true }],
        ambiguity: { kind: "scope_mismatch", explanation: "The rate scope differs." },
        order: 1,
      },
      {
        requirementId: feeId,
        status: "not_established",
        statement: "No resort-fee promise was found.",
        reason: "The official pages do not state that the fee is absent.",
        languageStrength: "insufficient",
        assessedScope: "This stay",
        evidence: [],
        ambiguity: { kind: "missing", explanation: "No adequate official language was found." },
        order: 2,
      },
    ],
    contacts: [],
    fullyEstablished: false,
    summary: "All three requirements still need written clarification.",
    draftSubject: "Questions before I book",
    draftBody: "Please confirm the parking charge, cancellation window, and whether a resort fee applies.",
  });
  const detail = await t.withIdentity({ subject: ownerId }).query(api.decisions.getDetail, {
    decisionId: fixture.decisionId,
  });
  expect(detail?.assessments.map((assessment) => assessment.status)).toEqual([
    "conflicting",
    "scope_mismatch",
    "not_established",
  ]);
  expect(detail?.evidence).toHaveLength(3);
  expect(detail?.ambiguities.map((ambiguity) => ambiguity.kind).sort()).toEqual([
    "conflicting",
    "missing",
    "scope_mismatch",
  ]);
  expect(detail?.decision.status).toBe("awaiting_approval");
});

test("a real reply produces one scoped outcome per requirement and permits at most one approved follow-up draft", async () => {
  const { t, ownerId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example stay",
      sourceUrl: "https://example.com/stay",
      sourceHost: "example.com",
      requirementText: "We need connecting rooms and no resort fee.",
      category: "hotel",
      status: "interpreting_reply",
      createdAt: 1,
      updatedAt: 1,
    });
    const roomId = await ctx.db.insert("decisionRequirements", {
      decisionId,
      ownerId,
      text: "Two rooms have an internal connecting door.",
      order: 0,
      createdAt: 1,
    });
    const feeId = await ctx.db.insert("decisionRequirements", {
      decisionId,
      ownerId,
      text: "No resort fee applies.",
      order: 1,
      createdAt: 1,
    });
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId,
      ownerId,
      requestToken: "GIW-ABC1234567",
      recipient: "reservations@example.com",
      recipientSource: "official_page",
      recipientSourceUrl: "https://example.com/contact",
      subject: "Questions [GIW-ABC1234567]",
      body: "Please confirm both requirements.",
      followUpCount: 0,
      status: "delivered",
      sentAt: 2,
      createdAt: 2,
      updatedAt: 2,
    });
    const replyId = await ctx.db.insert("confirmationReplies", {
      decisionId,
      requestId,
      messageId: "message_fixture",
      threadId: "thread_fixture",
      sender: "reservations@example.com",
      subject: "Re: Questions",
      body: "Yes, the rooms connect. Please ask the property directly about fees.",
      analysisBody: "Yes, the rooms connect. Please ask the property directly about fees.",
      receivedAt: 3,
      createdAt: 3,
    });
    return { decisionId, roomId, feeId, replyId };
  });
  await t.mutation(internal.confirmations.storeReplyInterpretation, {
    replyId: fixture.replyId,
    outcomes: [
      {
        requirementId: fixture.roomId,
        verdict: "confirmed",
        summary: "The reply directly confirms connecting rooms.",
        conditions: [],
        supportingQuote: "Yes, the rooms connect.",
      },
      {
        requirementId: fixture.feeId,
        verdict: "needs_followup",
        summary: "The reply does not answer whether a resort fee applies.",
        conditions: [],
        supportingQuote: "Please ask the property directly about fees.",
      },
    ],
    summary: "Connecting rooms are confirmed; the fee remains unanswered.",
    suggestedFollowUp: "Could you please confirm whether any resort fee applies to this stay?",
  });
  const detail = await t.withIdentity({ subject: ownerId }).query(api.decisions.getDetail, {
    decisionId: fixture.decisionId,
  });
  expect(detail?.decision.status).toBe("needs_followup");
  expect(detail?.outcomes).toHaveLength(2);
  expect(detail?.proofItems.map((item) => item.verdict)).toEqual(["confirmed", "needs_followup"]);
  expect(detail?.proofCard?.writtenMessage).toContain("Yes, the rooms connect.");
  if (!detail?.proofCard) throw new Error("Expected Proof Card");
  const followUpId = await t.withIdentity({ subject: ownerId }).mutation(
    api.confirmations.createFollowUpDraft,
    { proofCardId: detail.proofCard._id },
  );
  expect(followUpId).toBeTruthy();
  await expect(
    t.withIdentity({ subject: ownerId }).mutation(
      api.confirmations.createFollowUpDraft,
      { proofCardId: detail.proofCard._id },
    ),
  ).rejects.toThrow("one permitted follow-up");
});
