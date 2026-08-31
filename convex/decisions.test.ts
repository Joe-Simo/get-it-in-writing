/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.unstubAllEnvs();
});

async function createUserFixture() {
  const t = convexTest(schema, modules);
  rateLimiterComponent.register(t);
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
  const decisionId = await t
    .withIdentity({ subject: ownerId })
    .mutation(api.decisions.create, {
      sourceUrl: "https://www.example.com/hotel#rooms",
      requirementText: "We need connecting rooms, not merely adjacent rooms.",
      context: "December 12–14, two rooms",
    });

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

test("an owner can permanently remove a private case and its stored graph", async () => {
  const { t, ownerId, otherId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Rejected case",
      sourceUrl: "https://example.com/policy",
      sourceHost: "example.com",
      requirementText: "A requirement outside this case",
      category: "other",
      status: "scoping",
      operationalFailure: "unsupported_decision",
      operationalMessage: "This case is outside the supported scope.",
      createdAt: 1,
      updatedAt: 1,
    });
    const requirementId = await ctx.db.insert("decisionRequirements", {
      decisionId,
      ownerId,
      text: "A requirement outside this case",
      order: 0,
      createdAt: 1,
    });
    const assessmentId = await ctx.db.insert("claimAssessments", {
      decisionId,
      requirementId,
      status: "not_established",
      statement: "Not established",
      reason: "No supported evidence.",
      order: 0,
      createdAt: 1,
    });
    await ctx.db.insert("claimEvidence", {
      decisionId,
      assessmentId,
      sourceUrl: "https://example.com/policy",
      sourceExcerpt: "Example passage",
      supports: false,
      observedAt: 1,
    });
    await ctx.db.insert("sourceDocuments", {
      decisionId,
      crawlId: "crawl_delete",
      url: "https://example.com/policy",
      contentHash: "d".repeat(64),
      excerpt: "Example passage",
      capturedAt: 1,
    });
    await ctx.db.insert("decisionEvents", {
      decisionId,
      toStatus: "scoping",
      label: "Decision created",
      occurredAt: 1,
    });
    return { decisionId };
  });

  await expect(
    t.withIdentity({ subject: otherId }).mutation(api.decisions.remove, {
      decisionId: fixture.decisionId,
    }),
  ).rejects.toThrow("private");

  await t.withIdentity({ subject: ownerId }).mutation(api.decisions.remove, {
    decisionId: fixture.decisionId,
  });
  await expect(
    t.withIdentity({ subject: ownerId }).query(api.decisions.getDetail, {
      decisionId: fixture.decisionId,
    }),
  ).resolves.toBeNull();
  const relatedRows = await t.run(async (ctx) => ({
    requirements: await ctx.db.query("decisionRequirements").collect(),
    assessments: await ctx.db.query("claimAssessments").collect(),
    evidence: await ctx.db.query("claimEvidence").collect(),
    sources: await ctx.db.query("sourceDocuments").collect(),
    events: await ctx.db.query("decisionEvents").collect(),
  }));
  expect(relatedRows).toEqual({
    requirements: [],
    assessments: [],
    evidence: [],
    sources: [],
    events: [],
  });
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
        evidence: [
          {
            sourceUrl: "https://example.com/rooms",
            sourceTitle: "Rooms",
            sourceExcerpt: "Connecting rooms can be reserved as a pair.",
            supports: true,
          },
        ],
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
        sourceExcerpt:
          "Adjacent rooms may be requested, subject to availability.",
        evidence: [
          {
            sourceUrl: "https://example.com/rooms",
            sourceTitle: "Rooms",
            sourceExcerpt:
              "Adjacent rooms may be requested, subject to availability.",
            supports: true,
          },
        ],
        ambiguity: {
          kind: "conditional",
          explanation:
            "Availability is not guaranteed and connecting rooms are not established.",
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
    draftBody:
      "Please confirm whether the two rooms have an internal connecting door.",
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
      requirementText:
        "We need free parking, cancellation until 48 hours before arrival, and no resort fee.",
      category: "hotel",
      status: "analyzing",
      createdAt: 1,
      updatedAt: 1,
    });
    const texts = [
      "Free parking",
      "Cancellation until 48 hours before arrival",
      "No resort fee",
    ];
    const requirementIds = [];
    for (const [order, text] of texts.entries()) {
      requirementIds.push(
        await ctx.db.insert("decisionRequirements", {
          decisionId,
          ownerId,
          text,
          order,
          createdAt: 1,
        }),
      );
    }
    return { decisionId, requirementIds };
  });
  const [parkingId, cancellationId, feeId] = fixture.requirementIds;
  if (!parkingId || !cancellationId || !feeId)
    throw new Error("Missing requirement fixture");
  await t.mutation(internal.decisions.storeAnalysis, {
    decisionId: fixture.decisionId,
    title: "Example stay",
    category: "hotel",
    sources: [
      {
        crawlId: "crawl_scoped",
        url: "https://example.com/stay",
        title: "Stay policies",
        contentHash: "c".repeat(64),
        excerpt: "Parking and cancellation policies.",
        capturedAt: 2,
      },
    ],
    assessments: [
      {
        requirementId: parkingId,
        status: "conflicting",
        statement: "Official parking language conflicts.",
        reason:
          "One passage says parking is included and another lists a daily charge.",
        languageStrength: "conflicting",
        assessedScope: "Parking for this stay",
        sourceUrl: "https://example.com/stay",
        sourceTitle: "Stay policies",
        sourceExcerpt: "Complimentary parking is included.",
        evidence: [
          {
            sourceUrl: "https://example.com/stay",
            sourceTitle: "Stay policies",
            sourceExcerpt: "Complimentary parking is included.",
            supports: true,
          },
          {
            sourceUrl: "https://example.com/fees",
            sourceTitle: "Fees",
            sourceExcerpt: "Self-parking is $25 nightly.",
            supports: false,
          },
        ],
        ambiguity: {
          kind: "conflicting",
          explanation: "Two official passages materially disagree.",
        },
        order: 0,
      },
      {
        requirementId: cancellationId,
        status: "scope_mismatch",
        statement:
          "The published cancellation window applies to a different rate.",
        reason:
          "The flexible-rate policy does not establish the selected prepaid rate.",
        languageStrength: "qualified",
        assessedScope: "Flexible rate, not prepaid rate",
        sourceUrl: "https://example.com/stay",
        sourceTitle: "Stay policies",
        sourceExcerpt:
          "Flexible rates may be cancelled 48 hours before arrival.",
        evidence: [
          {
            sourceUrl: "https://example.com/stay",
            sourceTitle: "Stay policies",
            sourceExcerpt:
              "Flexible rates may be cancelled 48 hours before arrival.",
            supports: true,
          },
        ],
        ambiguity: {
          kind: "scope_mismatch",
          explanation: "The rate scope differs.",
        },
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
        ambiguity: {
          kind: "missing",
          explanation: "No adequate official language was found.",
        },
        order: 2,
      },
    ],
    contacts: [],
    fullyEstablished: false,
    summary: "All three requirements still need written clarification.",
    draftSubject: "Questions before I book",
    draftBody:
      "Please confirm the parking charge, cancellation window, and whether a resort fee applies.",
  });
  const detail = await t
    .withIdentity({ subject: ownerId })
    .query(api.decisions.getDetail, {
      decisionId: fixture.decisionId,
    });
  expect(detail?.assessments.map((assessment) => assessment.status)).toEqual([
    "conflicting",
    "scope_mismatch",
    "not_established",
  ]);
  expect(detail?.evidence).toHaveLength(3);
  expect(detail?.ambiguities.map((ambiguity) => ambiguity.kind).sort()).toEqual(
    ["conflicting", "missing", "scope_mismatch"],
  );
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
      analysisBody:
        "Yes, the rooms connect. Please ask the property directly about fees.",
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
    suggestedFollowUp:
      "Could you please confirm whether any resort fee applies to this stay?",
  });
  const detail = await t
    .withIdentity({ subject: ownerId })
    .query(api.decisions.getDetail, {
      decisionId: fixture.decisionId,
    });
  expect(detail?.decision.status).toBe("needs_followup");
  expect(detail?.outcomes).toHaveLength(2);
  expect(detail?.proofItems.map((item) => item.verdict)).toEqual([
    "confirmed",
    "needs_followup",
  ]);
  expect(detail?.proofCard?.writtenMessage).toContain(
    "Yes, the rooms connect.",
  );
  if (!detail?.proofCard) throw new Error("Expected Proof Card");
  const followUpId = await t
    .withIdentity({ subject: ownerId })
    .mutation(api.confirmations.createFollowUpDraft, {
      proofCardId: detail.proofCard._id,
    });
  expect(followUpId).toBeTruthy();
  await expect(
    t
      .withIdentity({ subject: ownerId })
      .mutation(api.confirmations.createFollowUpDraft, {
        proofCardId: detail.proofCard._id,
      }),
  ).rejects.toThrow("one permitted follow-up");
});

test("unsupported decisions and bounced mail stop safely without inventing progress", async () => {
  const { t, ownerId } = await createUserFixture();
  const unsupportedId = await t.run((ctx) =>
    ctx.db.insert("decisions", {
      ownerId,
      title: "Unsupported decision",
      sourceUrl: "https://example.com/advice",
      sourceHost: "example.com",
      requirementText: "Tell me whether this medical treatment is safe.",
      category: "other",
      status: "scoping",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  await t.mutation(internal.decisions.storeScope, {
    decisionId: unsupportedId,
    entityName: "Example",
    category: "other",
    supportedConsumerDomain: false,
    unsupportedReason:
      "Medical and safety decisions are outside this product's scope.",
    requirements: [],
  });
  const unsupported = await t
    .withIdentity({ subject: ownerId })
    .query(api.decisions.getDetail, { decisionId: unsupportedId });
  expect(unsupported?.decision).toMatchObject({
    status: "scoping",
    operationalFailure: "unsupported_decision",
    operationalMessage:
      "Medical and safety decisions are outside this product's scope.",
  });
  expect(unsupported?.requirements).toHaveLength(0);
  expect(unsupported?.requests).toHaveLength(0);

  const bounced = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example stay",
      sourceUrl: "https://example.com/stay",
      sourceHost: "example.com",
      requirementText: "No resort fee applies.",
      category: "hotel",
      status: "waiting",
      createdAt: 2,
      updatedAt: 2,
    });
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId,
      ownerId,
      requestToken: "GIW-BOUNCE1234",
      recipient: "reservations@example.invalid",
      recipientSource: "user_provided",
      subject: "Fee confirmation [GIW-BOUNCE1234]",
      body: "Please confirm whether a resort fee applies.",
      followUpCount: 0,
      status: "pending",
      sentAt: 2,
      createdAt: 2,
      updatedAt: 2,
    });
    return { decisionId, requestId };
  });
  await t.mutation(internal.confirmations.applyOutboundStatus, {
    requestId: bounced.requestId,
    status: "bounced",
    errorMessage: "The recipient server rejected the address.",
  });
  const bouncedDetail = await t
    .withIdentity({ subject: ownerId })
    .query(api.decisions.getDetail, { decisionId: bounced.decisionId });
  expect(bouncedDetail?.decision).toMatchObject({
    status: "waiting",
    operationalFailure: "delivery_failed",
    operationalMessage: "The recipient server rejected the address.",
  });
  expect(bouncedDetail?.requests[0]?.status).toBe("bounced");
  expect(bouncedDetail?.proofCard).toBeNull();
});

test("a provider refusal becomes a scoped declined Proof Card", async () => {
  const { t, ownerId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example rental",
      sourceUrl: "https://example.com/rental",
      sourceHost: "example.com",
      requirementText: "The unit permits two pets.",
      category: "rental",
      status: "interpreting_reply",
      createdAt: 1,
      updatedAt: 1,
    });
    const requirementId = await ctx.db.insert("decisionRequirements", {
      decisionId,
      ownerId,
      text: "The unit permits two pets.",
      order: 0,
      createdAt: 1,
    });
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId,
      ownerId,
      requestToken: "GIW-DECLINE123",
      recipient: "leasing@example.com",
      recipientSource: "official_page",
      recipientSourceUrl: "https://example.com/contact",
      subject: "Pet policy [GIW-DECLINE123]",
      body: "Please confirm whether this unit permits two pets.",
      followUpCount: 0,
      status: "delivered",
      sentAt: 2,
      createdAt: 2,
      updatedAt: 2,
    });
    const replyId = await ctx.db.insert("confirmationReplies", {
      decisionId,
      requestId,
      messageId: "message_declined",
      threadId: "thread_declined",
      sender: "leasing@example.com",
      subject: "Re: Pet policy",
      body: "We cannot confirm pet approval before an application is reviewed.",
      analysisBody:
        "We cannot confirm pet approval before an application is reviewed.",
      receivedAt: 3,
      createdAt: 3,
    });
    return { decisionId, requirementId, replyId };
  });
  await t.mutation(internal.confirmations.storeReplyInterpretation, {
    replyId: fixture.replyId,
    outcomes: [
      {
        requirementId: fixture.requirementId,
        verdict: "declined",
        summary:
          "The provider declined to confirm the requirement before review.",
        conditions: [],
        supportingQuote:
          "We cannot confirm pet approval before an application is reviewed.",
      },
    ],
    summary: "The provider declined to confirm the pet requirement.",
  });
  const detail = await t
    .withIdentity({ subject: ownerId })
    .query(api.decisions.getDetail, { decisionId: fixture.decisionId });
  expect(detail?.decision.status).toBe("declined");
  expect(detail?.proofCard).toMatchObject({
    basis: "written_reply",
    verdict: "declined",
  });
  expect(detail?.proofItems[0]).toMatchObject({
    verdict: "declined",
    requirementText: "The unit permits two pets.",
  });
});

test("inbound mail accepts only the expected sender and stores one reply without quoted history", async () => {
  vi.stubEnv("AGENTMAIL_INBOX_ID", "inbox_get_it_in_writing");
  const { t, ownerId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example hotel",
      sourceUrl: "https://example.com/hotel",
      sourceHost: "example.com",
      requirementText: "Connecting rooms must be guaranteed.",
      category: "hotel",
      status: "waiting",
      createdAt: 1,
      updatedAt: 1,
    });
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId,
      ownerId,
      requestToken: "GIW-INBOUND123",
      recipient: "reservations@example.com",
      recipientSource: "official_page",
      recipientSourceUrl: "https://example.com/contact",
      subject: "Connecting rooms [GIW-INBOUND123]",
      body: "Can you confirm connecting rooms?",
      followUpCount: 0,
      status: "delivered",
      threadId: "thread_inbound",
      sentAt: 2,
      deliveredAt: 3,
      createdAt: 2,
      updatedAt: 3,
    });
    return { decisionId, requestId };
  });

  await t.mutation(internal.confirmations.onMessageReceived, {
    eventId: "event_wrong_sender",
    thread: {},
    message: {
      inbox_id: "inbox_get_it_in_writing",
      thread_id: "thread_inbound",
      message_id: "message_wrong_sender",
      from: "reservations@example-lookalike.net",
      subject: "Re: Connecting rooms",
      extracted_text: "Yes.",
    },
  });

  await t.mutation(internal.confirmations.onMessageReceived, {
    eventId: "event_real_reply",
    thread: {},
    message: {
      inbox_id: "inbox_get_it_in_writing",
      thread_id: "thread_inbound",
      message_id: "message_real_reply",
      from: "Reservations <reservations@example.com>",
      subject: "Re: Connecting rooms",
      timestamp: "2026-08-30T18:30:00.000Z",
      extracted_text: [
        "Yes, we can guarantee connecting rooms when both rooms use the Family Connect rate.",
        "",
        "> Can you confirm connecting rooms?",
      ].join("\n"),
    },
  });

  await t.mutation(internal.confirmations.onMessageReceived, {
    eventId: "event_duplicate_delivery",
    thread: {},
    message: {
      inbox_id: "inbox_get_it_in_writing",
      thread_id: "thread_inbound",
      message_id: "message_real_reply",
      from: "Reservations <reservations@example.com>",
      subject: "Re: Connecting rooms",
      extracted_text: "Duplicate delivery of the same provider message.",
    },
  });

  const stored = await t.run(async (ctx) => ({
    decision: await ctx.db.get("decisions", fixture.decisionId),
    request: await ctx.db.get("confirmationRequests", fixture.requestId),
    replies: await ctx.db
      .query("confirmationReplies")
      .withIndex("by_requestId_and_receivedAt", (q) =>
        q.eq("requestId", fixture.requestId),
      )
      .collect(),
  }));
  expect(stored.decision?.status).toBe("reply_received");
  expect(stored.request?.status).toBe("delivered");
  expect(stored.replies).toHaveLength(1);
  expect(stored.replies[0]).toMatchObject({
    messageId: "message_real_reply",
    sender: "Reservations <reservations@example.com>",
    analysisBody:
      "Yes, we can guarantee connecting rooms when both rooms use the Family Connect rate.",
  });
  const setAsideEvents = await t.run(async (ctx) =>
    ctx.db
      .query("decisionEvents")
      .withIndex("by_decisionId_and_occurredAt", (q) =>
        q.eq("decisionId", fixture.decisionId),
      )
      .collect(),
  );
  expect(
    setAsideEvents.filter((event) =>
      event.label.includes("unrecognized sender"),
    ),
  ).toHaveLength(1);
});

test("a reply from another mailbox on the recipient's own domain is accepted", async () => {
  vi.stubEnv("AGENTMAIL_INBOX_ID", "inbox_get_it_in_writing");
  const { t, ownerId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example stay",
      sourceUrl: "https://stay.example.com.au/rooms",
      sourceHost: "stay.example.com.au",
      requirementText: "Interconnecting rooms must be guaranteed.",
      category: "hotel",
      status: "waiting",
      createdAt: 1,
      updatedAt: 1,
    });
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId,
      ownerId,
      requestToken: "GIW-SAMEDOMAIN",
      recipient: "reservations@example.com.au",
      recipientSource: "official_page",
      subject: "Interconnecting rooms [GIW-SAMEDOMAIN]",
      body: "Can you confirm interconnecting rooms?",
      followUpCount: 0,
      status: "delivered",
      threadId: "thread_same_domain",
      sentAt: 2,
      deliveredAt: 3,
      createdAt: 2,
      updatedAt: 3,
    });
    return { decisionId, requestId };
  });

  await t.mutation(internal.confirmations.onMessageReceived, {
    eventId: "event_same_domain",
    thread: {},
    message: {
      inbox_id: "inbox_get_it_in_writing",
      thread_id: "thread_same_domain",
      message_id: "message_same_domain",
      from: "Front Desk <frontdesk@example.com.au>",
      subject: "Re: Interconnecting rooms",
      extracted_text: "Yes, both rooms are held for you.",
    },
  });

  const replies = await t.run(async (ctx) =>
    ctx.db
      .query("confirmationReplies")
      .withIndex("by_requestId_and_receivedAt", (q) =>
        q.eq("requestId", fixture.requestId),
      )
      .collect(),
  );
  expect(replies).toHaveLength(1);
  expect(replies[0]).toMatchObject({ messageId: "message_same_domain" });
});

test("source monitoring preserves both snapshots and deduplicates the same detected change", async () => {
  const { t, ownerId, otherId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example product",
      sourceUrl: "https://example.com/product",
      sourceHost: "example.com",
      requirementText: "The written warranty must last two years.",
      category: "product",
      status: "confirmed",
      createdAt: 1,
      updatedAt: 1,
    });
    const requirementId = await ctx.db.insert("decisionRequirements", {
      decisionId,
      ownerId,
      text: "The written warranty lasts two years.",
      order: 0,
      createdAt: 1,
    });
    const proofCardId = await ctx.db.insert("proofCards", {
      decisionId,
      ownerId,
      basis: "official_source",
      verdict: "confirmed",
      exactRequirement: "The written warranty lasts two years.",
      summary: "The original policy stated a two-year warranty.",
      conditions: [],
      sourceUrls: ["https://example.com/product"],
      sourceExcerpts: ["Includes a two-year written warranty."],
      createdAt: 2,
    });
    await ctx.db.insert("proofItems", {
      proofCardId,
      decisionId,
      requirementId,
      verdict: "confirmed",
      requirementText: "The written warranty lasts two years.",
      summary: "The original policy stated a two-year warranty.",
      conditions: [],
      sourceUrls: ["https://example.com/product"],
      sourceExcerpts: ["Includes a two-year written warranty."],
      order: 0,
      createdAt: 2,
    });
    await ctx.db.insert("sourceDocuments", {
      decisionId,
      crawlId: "crawl_original",
      url: "https://example.com/product",
      title: "Warranty",
      contentHash: "a".repeat(64),
      excerpt: "Includes a two-year written warranty.",
      capturedAt: 2,
    });
    const monitorId = await ctx.db.insert("changeMonitors", {
      decisionId,
      ownerId,
      active: true,
      intervalHours: 24,
      nextCheckAt: 3,
      createdAt: 2,
      updatedAt: 2,
    });
    return { decisionId, monitorId, proofCardId };
  });

  const changedResult = {
    url: "https://example.com/product",
    priorHash: "a".repeat(64),
    priorExcerpt: "Includes a two-year written warranty.",
    currentHash: "b".repeat(64),
    currentExcerpt: "Includes a one-year written warranty.",
    title: "Warranty",
  };
  await t.mutation(internal.changes.recordCheck, {
    decisionId: fixture.decisionId,
    monitorId: fixture.monitorId,
    checkedAt: 10,
    results: [changedResult],
  });
  await t.mutation(internal.changes.recordCheck, {
    decisionId: fixture.decisionId,
    monitorId: fixture.monitorId,
    checkedAt: 11,
    results: [changedResult],
  });

  const stored = await t.run(async (ctx) => ({
    card: await ctx.db.get("proofCards", fixture.proofCardId),
    sources: await ctx.db
      .query("sourceDocuments")
      .withIndex("by_decisionId_and_url", (q) =>
        q.eq("decisionId", fixture.decisionId),
      )
      .collect(),
    changes: await ctx.db
      .query("sourceChanges")
      .withIndex("by_decisionId_and_detectedAt", (q) =>
        q.eq("decisionId", fixture.decisionId),
      )
      .collect(),
  }));
  expect(stored.card?.sourceExcerpts).toEqual([
    "Includes a two-year written warranty.",
  ]);
  expect(stored.sources.map((source) => source.contentHash).sort()).toEqual([
    "a".repeat(64),
    "b".repeat(64),
  ]);
  expect(stored.changes).toHaveLength(1);
  expect(stored.changes[0]).toMatchObject({
    previousExcerpt: "Includes a two-year written warranty.",
    currentExcerpt: "Includes a one-year written warranty.",
    status: "open",
  });

  if (!stored.changes[0]) throw new Error("Expected one source change");
  await expect(
    t.withIdentity({ subject: otherId }).mutation(api.changes.acknowledge, {
      sourceChangeId: stored.changes[0]._id,
    }),
  ).rejects.toThrow("private");
  await t.withIdentity({ subject: ownerId }).mutation(api.changes.acknowledge, {
    sourceChangeId: stored.changes[0]._id,
  });
  const acknowledged = await t.run((ctx) =>
    ctx.db.get("sourceChanges", stored.changes[0]._id),
  );
  expect(acknowledged?.status).toBe("acknowledged");
});

test("late delivery events never regress a decision that moved past waiting", async () => {
  const { t, ownerId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example venue",
      sourceUrl: "https://example.com/venue",
      sourceHost: "example.com",
      requirementText: "Outside catering must be permitted.",
      category: "venue",
      status: "confirmed",
      createdAt: 1,
      updatedAt: 1,
    });
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId,
      ownerId,
      requestToken: "GIW-LATEEVENT1",
      recipient: "events@example.com",
      recipientSource: "official_page",
      subject: "Outside catering [GIW-LATEEVENT1]",
      body: "Can you confirm outside catering?",
      followUpCount: 0,
      status: "delivered",
      threadId: "thread_late",
      messageId: "message_late",
      sentAt: 2,
      deliveredAt: 3,
      createdAt: 2,
      updatedAt: 3,
    });
    return { decisionId, requestId };
  });

  // A delivery notification that lags behind the interpreted reply must not
  // pull the finished decision back to "waiting" or downgrade the request.
  await t.mutation(internal.confirmations.applyOutboundStatus, {
    requestId: fixture.requestId,
    status: "sent",
  });
  // A late spam-complaint event must not stamp a failure onto a finished case.
  await t.mutation(internal.confirmations.applyOutboundStatus, {
    requestId: fixture.requestId,
    status: "complained",
  });

  const stored = await t.run(async (ctx) => ({
    decision: await ctx.db.get("decisions", fixture.decisionId),
    request: await ctx.db.get("confirmationRequests", fixture.requestId),
  }));
  expect(stored.decision?.status).toBe("confirmed");
  expect(stored.decision?.operationalFailure).toBeUndefined();
  expect(stored.request?.status).toBe("delivered");
});

test("a failed reply interpretation can be retried by the owner only", async () => {
  const { t, ownerId, otherId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example rental",
      sourceUrl: "https://example.com/rental",
      sourceHost: "example.com",
      requirementText: "The bond must be refundable in full.",
      category: "rental",
      status: "interpreting_reply",
      operationalFailure: "reply_processing_failed",
      operationalMessage: "The written reply was saved, but its scope could not be interpreted yet.",
      createdAt: 1,
      updatedAt: 1,
    });
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId,
      ownerId,
      requestToken: "GIW-RETRYREPLY",
      recipient: "leasing@example.com",
      recipientSource: "official_page",
      subject: "Bond refund [GIW-RETRYREPLY]",
      body: "Can you confirm the bond is refundable in full?",
      followUpCount: 0,
      status: "delivered",
      threadId: "thread_retry",
      sentAt: 2,
      deliveredAt: 3,
      createdAt: 2,
      updatedAt: 3,
    });
    const replyId = await ctx.db.insert("confirmationReplies", {
      decisionId,
      requestId,
      messageId: "message_retry_reply",
      threadId: "thread_retry",
      sender: "leasing@example.com",
      subject: "Re: Bond refund",
      body: "Yes, the bond is refundable in full.",
      receivedAt: 4,
      createdAt: 4,
    });
    return { decisionId, requestId, replyId };
  });

  await expect(
    t
      .withIdentity({ subject: otherId })
      .mutation(api.confirmations.retryReplyInterpretation, {
        decisionId: fixture.decisionId,
      }),
  ).rejects.toThrow("could not be found");

  await t
    .withIdentity({ subject: ownerId })
    .mutation(api.confirmations.retryReplyInterpretation, {
      decisionId: fixture.decisionId,
    });

  const decision = await t.run((ctx) => ctx.db.get("decisions", fixture.decisionId));
  expect(decision?.status).toBe("reply_received");
  expect(decision?.operationalFailure).toBeUndefined();
});

test("research runs are metered per account on the shared beta", async () => {
  const { t, ownerId } = await createUserFixture();
  const asOwner = t.withIdentity({ subject: ownerId });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await asOwner.mutation(api.decisions.create, {
      sourceUrl: `https://www.example.com/stay-${attempt}`,
      requirementText: "Free cancellation until 48 hours before arrival.",
    });
  }
  await expect(
    asOwner.mutation(api.decisions.create, {
      sourceUrl: "https://www.example.com/stay-limited",
      requirementText: "Free cancellation until 48 hours before arrival.",
    }),
  ).rejects.toThrow("Try again in");
});

test("the demo wallet can explore and research but never send, edit, or delete", async () => {
  const { t } = await createUserFixture();
  const demoId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "judge@getitinwriting.demo" }),
  );

  // Judges may run bounded live research from the shared wallet.
  const createdId = await t
    .withIdentity({ subject: demoId })
    .mutation(api.decisions.create, {
      sourceUrl: "https://www.example.com/stay",
      requirementText: "Free cancellation until 48 hours before arrival.",
    });
  const created = await t
    .withIdentity({ subject: demoId })
    .query(api.decisions.getDetail, { decisionId: createdId });
  expect(created?.decision.status).toBe("scoping");

  const seededId = await t.mutation(internal.demo.seedDecision, {
    sourceUrl: "https://www.example.com/other-stay",
    requirementText: "Free cancellation until 48 hours before arrival.",
  });
  const seeded = await t
    .withIdentity({ subject: demoId })
    .query(api.decisions.getDetail, { decisionId: seededId });
  expect(seeded?.decision.status).toBe("scoping");

  await expect(
    t.withIdentity({ subject: demoId }).mutation(api.decisions.remove, {
      decisionId: seededId,
    }),
  ).rejects.toThrow("demo wallet");
});

test("the waitlist accepts an address once and stays calm on repeats", async () => {
  const { t } = await createUserFixture();
  await t.mutation(api.waitlist.join, { email: "Future.User@Example.com " });
  await t.mutation(api.waitlist.join, { email: "future.user@example.com" });
  const rows = await t.run((ctx) => ctx.db.query("waitlist").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]?.email).toBe("future.user@example.com");
});

test("an HTML-only reply is converted to readable text before interpretation", async () => {
  vi.stubEnv("AGENTMAIL_INBOX_ID", "inbox_get_it_in_writing");
  const { t, ownerId } = await createUserFixture();
  const fixture = await t.run(async (ctx) => {
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: "Example venue",
      sourceUrl: "https://example.com/venue",
      sourceHost: "example.com",
      requirementText: "Outside catering must be permitted.",
      category: "venue",
      status: "waiting",
      createdAt: 1,
      updatedAt: 1,
    });
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId,
      ownerId,
      requestToken: "GIW-HTMLREPLY1",
      recipient: "events@example.com",
      recipientSource: "official_page",
      subject: "Outside catering [GIW-HTMLREPLY1]",
      body: "Can you confirm outside catering?",
      followUpCount: 0,
      status: "delivered",
      threadId: "thread_html",
      sentAt: 2,
      deliveredAt: 3,
      createdAt: 2,
      updatedAt: 3,
    });
    return { decisionId, requestId };
  });

  await t.mutation(internal.confirmations.onMessageReceived, {
    eventId: "event_html_reply",
    thread: {},
    message: {
      inbox_id: "inbox_get_it_in_writing",
      thread_id: "thread_html",
      message_id: "message_html_reply",
      from: "events@example.com",
      subject: "Re: Outside catering",
      html: "<div><p>Yes,&nbsp;outside catering is <b>permitted</b>.</p><br><p>Kind regards</p></div>",
    },
  });

  const reply = await t.run(async (ctx) =>
    ctx.db
      .query("confirmationReplies")
      .withIndex("by_requestId_and_receivedAt", (q) =>
        q.eq("requestId", fixture.requestId),
      )
      .first(),
  );
  expect(reply?.body).toContain("outside catering is permitted");
  expect(reply?.body).not.toContain("<p>");
});
