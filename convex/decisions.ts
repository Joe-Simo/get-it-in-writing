import { Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  ambiguityKind,
  decisionCategory,
  decisionStatus,
  evidenceStrength,
  operationalFailure,
  requirementImportance,
} from "./lib/decisionState";
import {
  assertSupportedDecision,
  normalizeContext,
  normalizeOfficialUrl,
  normalizeRequirement,
  sourceHost,
} from "./lib/validation";
import { requireUserId } from "./model/auth";
import schema from "./schema";

type DecisionStatus = Infer<typeof decisionStatus>;

async function addEvent(
  ctx: MutationCtx,
  decisionId: Id<"decisions">,
  fromStatus: DecisionStatus | undefined,
  toStatus: DecisionStatus,
  label: string,
  occurredAt = Date.now(),
) {
  await ctx.db.insert("decisionEvents", {
    decisionId,
    ...(fromStatus === undefined ? {} : { fromStatus }),
    toStatus,
    label,
    occurredAt,
  });
}

async function requireOwnedDecision(
  ctx: MutationCtx,
  decisionId: Id<"decisions">,
) {
  const ownerId = await requireUserId(ctx);
  const decision = await ctx.db.get("decisions", decisionId);
  if (decision === null) throw new Error("404: decision not found");
  if (decision.ownerId !== ownerId) throw new Error("403: decision is private");
  return decision;
}

async function deleteDecisionGraph(ctx: MutationCtx, decisionId: Id<"decisions">) {
  const proofCards = await ctx.db
    .query("proofCards")
    .withIndex("by_decisionId", (q) => q.eq("decisionId", decisionId))
    .take(20);
  for (const card of proofCards) {
    const items = await ctx.db
      .query("proofItems")
      .withIndex("by_proofCardId_and_order", (q) => q.eq("proofCardId", card._id))
      .take(50);
    for (const item of items) await ctx.db.delete("proofItems", item._id);
    await ctx.db.delete("proofCards", card._id);
  }

  const requests = await ctx.db
    .query("confirmationRequests")
    .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decisionId))
    .take(20);
  for (const request of requests) {
    const replies = await ctx.db
      .query("confirmationReplies")
      .withIndex("by_requestId_and_receivedAt", (q) => q.eq("requestId", request._id))
      .take(50);
    for (const reply of replies) {
      const outcomes = await ctx.db
        .query("confirmationOutcomes")
        .withIndex("by_replyId", (q) => q.eq("replyId", reply._id))
        .take(50);
      for (const outcome of outcomes) {
        await ctx.db.delete("confirmationOutcomes", outcome._id);
      }
      await ctx.db.delete("confirmationReplies", reply._id);
    }
    await ctx.db.delete("confirmationRequests", request._id);
  }

  const assessments = await ctx.db
    .query("claimAssessments")
    .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decisionId))
    .take(100);
  for (const assessment of assessments) {
    const evidence = await ctx.db
      .query("claimEvidence")
      .withIndex("by_assessmentId", (q) => q.eq("assessmentId", assessment._id))
      .take(100);
    for (const item of evidence) await ctx.db.delete("claimEvidence", item._id);
    await ctx.db.delete("claimAssessments", assessment._id);
  }

  const requirements = await ctx.db
    .query("decisionRequirements")
    .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decisionId))
    .take(50);
  for (const requirement of requirements) {
    const ambiguities = await ctx.db
      .query("decisionAmbiguities")
      .withIndex("by_requirementId", (q) => q.eq("requirementId", requirement._id))
      .take(50);
    for (const ambiguity of ambiguities) {
      await ctx.db.delete("decisionAmbiguities", ambiguity._id);
    }
    await ctx.db.delete("decisionRequirements", requirement._id);
  }

  const [sources, contacts, changes, monitors, events] = await Promise.all([
    ctx.db.query("sourceDocuments").withIndex("by_decisionId_and_url", (q) => q.eq("decisionId", decisionId)).take(100),
    ctx.db.query("officialContacts").withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decisionId)).take(50),
    ctx.db.query("sourceChanges").withIndex("by_decisionId_and_detectedAt", (q) => q.eq("decisionId", decisionId)).take(50),
    ctx.db.query("changeMonitors").withIndex("by_decisionId", (q) => q.eq("decisionId", decisionId)).take(10),
    ctx.db.query("decisionEvents").withIndex("by_decisionId_and_occurredAt", (q) => q.eq("decisionId", decisionId)).take(200),
  ]);
  for (const row of sources) await ctx.db.delete("sourceDocuments", row._id);
  for (const row of contacts) await ctx.db.delete("officialContacts", row._id);
  for (const row of changes) await ctx.db.delete("sourceChanges", row._id);
  for (const row of monitors) await ctx.db.delete("changeMonitors", row._id);
  for (const row of events) await ctx.db.delete("decisionEvents", row._id);
  await ctx.db.delete("decisions", decisionId);
}

export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("decisions"),
      title: v.string(),
      sourceHost: v.string(),
      requirementText: v.string(),
      category: decisionCategory,
      status: decisionStatus,
      operationalFailure: schema.doc("decisions").fields.operationalFailure,
      operationalMessage: schema.doc("decisions").fields.operationalMessage,
      updatedAt: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(50);
    return decisions.map((decision) => ({
      _id: decision._id,
      title: decision.title,
      sourceHost: decision.sourceHost,
      requirementText: decision.requirementText,
      category: decision.category,
      status: decision.status,
      operationalFailure: decision.operationalFailure,
      operationalMessage: decision.operationalMessage,
      updatedAt: decision.updatedAt,
      createdAt: decision.createdAt,
    }));
  },
});

export const getDetail = query({
  args: { decisionId: v.id("decisions") },
  returns: v.union(
    v.null(),
    v.object({
      decision: schema.doc("decisions"),
      requirements: v.array(schema.doc("decisionRequirements")),
      sources: v.array(schema.doc("sourceDocuments")),
      assessments: v.array(schema.doc("claimAssessments")),
      evidence: v.array(schema.doc("claimEvidence")),
      ambiguities: v.array(schema.doc("decisionAmbiguities")),
      contacts: v.array(schema.doc("officialContacts")),
      requests: v.array(schema.doc("confirmationRequests")),
      replies: v.array(schema.doc("confirmationReplies")),
      outcomes: v.array(schema.doc("confirmationOutcomes")),
      proofCard: v.union(v.null(), schema.doc("proofCards")),
      proofItems: v.array(schema.doc("proofItems")),
      sourceChanges: v.array(schema.doc("sourceChanges")),
      events: v.array(schema.doc("decisionEvents")),
    }),
  ),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null || decision.ownerId !== ownerId) return null;
    const [
      requirements,
      sources,
      assessments,
      evidence,
      ambiguities,
      contacts,
      requests,
      outcomes,
      proofCard,
      sourceChanges,
      events,
    ] =
      await Promise.all([
        ctx.db
          .query("decisionRequirements")
          .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
          .take(20),
        ctx.db
          .query("sourceDocuments")
          .withIndex("by_decisionId_and_url", (q) => q.eq("decisionId", decision._id))
          .take(40),
        ctx.db
          .query("claimAssessments")
          .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
          .take(50),
        ctx.db
          .query("claimEvidence")
          .withIndex("by_decisionId_and_observedAt", (q) => q.eq("decisionId", decision._id))
          .order("desc")
          .take(100),
        ctx.db
          .query("decisionAmbiguities")
          .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
          .take(50),
        ctx.db
          .query("officialContacts")
          .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
          .take(20),
        ctx.db
          .query("confirmationRequests")
          .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
          .order("desc")
          .take(5),
        ctx.db
          .query("confirmationOutcomes")
          .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
          .order("desc")
          .take(50),
        ctx.db
          .query("proofCards")
          .withIndex("by_decisionId", (q) => q.eq("decisionId", decision._id))
          .order("desc")
          .first(),
        ctx.db
          .query("sourceChanges")
          .withIndex("by_decisionId_and_detectedAt", (q) => q.eq("decisionId", decision._id))
          .order("desc")
          .take(20),
        ctx.db
          .query("decisionEvents")
          .withIndex("by_decisionId_and_occurredAt", (q) => q.eq("decisionId", decision._id))
          .take(100),
      ]);
    const replies = (
      await Promise.all(
        requests.map((request) =>
          ctx.db
            .query("confirmationReplies")
            .withIndex("by_requestId_and_receivedAt", (q) => q.eq("requestId", request._id))
            .take(10),
        ),
      )
    ).flat().sort((left, right) => right.receivedAt - left.receivedAt);
    const proofItems = proofCard
      ? await ctx.db
          .query("proofItems")
          .withIndex("by_proofCardId_and_order", (q) => q.eq("proofCardId", proofCard._id))
          .take(20)
      : [];
    return {
      decision,
      requirements,
      sources,
      assessments,
      evidence,
      ambiguities,
      contacts,
      requests,
      replies,
      outcomes,
      proofCard,
      proofItems,
      sourceChanges,
      events,
    };
  },
});

export const remove = mutation({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedDecision(ctx, args.decisionId);
    await deleteDecisionGraph(ctx, args.decisionId);
    return null;
  },
});

export const create = mutation({
  args: {
    sourceUrl: v.string(),
    requirementText: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.id("decisions"),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const sourceUrl = normalizeOfficialUrl(args.sourceUrl);
    const requirementText = normalizeRequirement(args.requirementText);
    const context = normalizeContext(args.context);
    assertSupportedDecision(requirementText, context);
    const host = sourceHost(sourceUrl);
    const now = Date.now();
    const decisionId = await ctx.db.insert("decisions", {
      ownerId,
      title: `Decision about ${host}`,
      sourceUrl,
      sourceHost: host,
      requirementText,
      ...(context === undefined ? {} : { context }),
      category: "other",
      status: "scoping",
      createdAt: now,
      updatedAt: now,
    });
    await addEvent(ctx, decisionId, undefined, "draft", "Decision created", now);
    await addEvent(ctx, decisionId, "draft", "scoping", "Decision boundaries being scoped", now);
    await ctx.scheduler.runAfter(0, internal.researchOpenAI.scope, { decisionId });
    return decisionId;
  },
});

export const storeScope = internalMutation({
  args: {
    decisionId: v.id("decisions"),
    entityName: v.string(),
    category: decisionCategory,
    supportedConsumerDomain: v.boolean(),
    unsupportedReason: v.optional(v.string()),
    requirements: v.array(
      v.object({
        text: v.string(),
        normalizedMeaning: v.string(),
        importance: requirementImportance,
        scope: v.string(),
        dates: v.array(v.string()),
        quantities: v.array(v.string()),
        hardConstraint: v.boolean(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    const now = Date.now();
    if (!args.supportedConsumerDomain) {
      await ctx.db.patch("decisions", decision._id, {
        operationalFailure: "unsupported_decision",
        operationalMessage: (
          args.unsupportedReason ||
          "This decision falls outside ordinary consumer purchases, bookings, rentals, venues, products, contractors, or services. Nothing was sent."
        ).slice(0, 500),
        updatedAt: now,
      });
      await addEvent(ctx, decision._id, decision.status, "scoping", "Decision stopped outside the safe product scope", now);
      return null;
    }
    const scoped = args.requirements
      .map((requirement) => ({
        text: requirement.text.trim().slice(0, 800),
        normalizedMeaning: requirement.normalizedMeaning.trim().slice(0, 800),
        importance: requirement.importance,
        scope: requirement.scope.trim().slice(0, 800),
        dates: requirement.dates.map((date) => date.trim().slice(0, 120)).filter(Boolean).slice(0, 10),
        quantities: requirement.quantities.map((quantity) => quantity.trim().slice(0, 120)).filter(Boolean).slice(0, 10),
        hardConstraint: requirement.hardConstraint,
      }))
      .filter((requirement) => requirement.text.length >= 3)
      .slice(0, 10);
    const requirements = scoped.length > 0
      ? scoped
      : [{
          text: decision.requirementText,
          normalizedMeaning: decision.requirementText,
          importance: "critical" as const,
          scope: decision.context ?? "This decision",
          dates: [],
          quantities: [],
          hardConstraint: true,
        }];
    const existingRequirements = await ctx.db
      .query("decisionRequirements")
      .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
      .take(20);
    for (const existing of existingRequirements) {
      await ctx.db.delete("decisionRequirements", existing._id);
    }
    for (const [order, requirement] of requirements.entries()) {
      await ctx.db.insert("decisionRequirements", {
        decisionId: decision._id,
        ownerId: decision.ownerId,
        ...requirement,
        order,
        createdAt: now,
      });
    }
    const canonicalUrl = new URL(decision.sourceUrl).origin;
    let entity = await ctx.db
      .query("decisionEntities")
      .withIndex("by_ownerId_and_canonicalUrl", (q) =>
        q.eq("ownerId", decision.ownerId).eq("canonicalUrl", canonicalUrl),
      )
      .unique();
    if (entity === null) {
      const entityId = await ctx.db.insert("decisionEntities", {
        ownerId: decision.ownerId,
        canonicalUrl,
        displayName: args.entityName.trim().slice(0, 120) || decision.sourceHost,
        type: args.category,
        createdAt: now,
        updatedAt: now,
      });
      entity = await ctx.db.get("decisionEntities", entityId);
    } else {
      await ctx.db.patch("decisionEntities", entity._id, {
        displayName: args.entityName.trim().slice(0, 120) || entity.displayName,
        type: args.category,
        updatedAt: now,
      });
    }
    await ctx.db.patch("decisions", decision._id, {
      ...(entity ? { entityId: entity._id } : {}),
      title: args.entityName.trim().slice(0, 120) || decision.title,
      category: args.category,
      operationalFailure: undefined,
      operationalMessage: undefined,
      updatedAt: now,
    });
    await addEvent(
      ctx,
      decision._id,
      "scoping",
      "scoping",
      `${requirements.length} decision ${requirements.length === 1 ? "boundary" : "boundaries"} scoped`,
      now,
    );
    await ctx.scheduler.runAfter(0, internal.research.start, { decisionId: decision._id });
    return null;
  },
});

export const retryResearch = mutation({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await requireOwnedDecision(ctx, args.decisionId);
    if (
      decision.operationalFailure !== "research_failed" &&
      decision.operationalFailure !== "analysis_failed"
    ) {
      throw new Error("This decision does not need a research retry");
    }
    await ctx.db.patch("decisions", decision._id, {
      status: "scoping",
      operationalFailure: undefined,
      operationalMessage: undefined,
      crawlId: undefined,
      updatedAt: Date.now(),
    });
    await addEvent(ctx, decision._id, decision.status, "scoping", "Research retry requested");
    await ctx.scheduler.runAfter(0, internal.research.start, { decisionId: decision._id });
    return null;
  },
});

export const getForResearch = internalQuery({
  args: { decisionId: v.id("decisions") },
  returns: v.union(
    v.null(),
    v.object({
      decision: schema.doc("decisions"),
      requirements: v.array(schema.doc("decisionRequirements")),
    }),
  ),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    const requirements = await ctx.db
      .query("decisionRequirements")
      .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
      .take(20);
    return { decision, requirements };
  },
});

export const markResearching = internalMutation({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    const now = Date.now();
    await ctx.db.patch("decisions", decision._id, {
      status: "researching",
      operationalFailure: undefined,
      operationalMessage: undefined,
      researchStartedAt: now,
      updatedAt: now,
    });
    await addEvent(ctx, decision._id, decision.status, "researching", "Official sources opened", now);
    return null;
  },
});

export const attachCrawl = internalMutation({
  args: { decisionId: v.id("decisions"), crawlId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    await ctx.db.patch("decisions", decision._id, { crawlId: args.crawlId, updatedAt: Date.now() });
    return null;
  },
});

export const markAnalyzing = internalMutation({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    const now = Date.now();
    await ctx.db.patch("decisions", decision._id, { status: "analyzing", updatedAt: now });
    await addEvent(ctx, decision._id, decision.status, "analyzing", "Reliance map being checked", now);
    return null;
  },
});

export const recordOperationalFailure = internalMutation({
  args: {
    decisionId: v.id("decisions"),
    kind: operationalFailure,
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    await ctx.db.patch("decisions", decision._id, {
      operationalFailure: args.kind,
      operationalMessage: args.message.slice(0, 500),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const storeAnalysis = internalMutation({
  args: {
    decisionId: v.id("decisions"),
    title: v.string(),
    category: decisionCategory,
    sources: v.array(
      v.object({
        crawlId: v.string(),
        url: v.string(),
        title: v.optional(v.string()),
        contentHash: v.string(),
        excerpt: v.string(),
        capturedAt: v.number(),
      }),
    ),
    assessments: v.array(
      v.object({
        requirementId: v.id("decisionRequirements"),
        status: schema.doc("claimAssessments").fields.status,
        statement: v.string(),
        reason: v.string(),
        languageStrength: evidenceStrength,
        assessedScope: v.string(),
        sourceUrl: v.optional(v.string()),
        sourceTitle: v.optional(v.string()),
        sourceExcerpt: v.optional(v.string()),
        evidence: v.array(
          v.object({
            sourceUrl: v.string(),
            sourceTitle: v.optional(v.string()),
            sourceExcerpt: v.string(),
            supports: v.boolean(),
          }),
        ),
        ambiguity: v.optional(
          v.object({
            kind: ambiguityKind,
            explanation: v.string(),
          }),
        ),
        order: v.number(),
      }),
    ),
    contacts: v.array(
      v.object({
        email: v.string(),
        label: v.string(),
        sourceUrl: v.string(),
        sourceExcerpt: v.string(),
      }),
    ),
    fullyEstablished: v.boolean(),
    summary: v.string(),
    draftSubject: v.string(),
    draftBody: v.string(),
  },
  returns: v.union(v.null(), v.id("confirmationRequests")),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    const now = Date.now();
    const oldAssessments = await ctx.db
      .query("claimAssessments")
      .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
      .take(100);
    const oldContacts = await ctx.db
      .query("officialContacts")
      .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
      .take(50);
    for (const row of oldAssessments) {
      const oldEvidence = await ctx.db
        .query("claimEvidence")
        .withIndex("by_assessmentId", (q) => q.eq("assessmentId", row._id))
        .take(20);
      for (const item of oldEvidence) await ctx.db.delete("claimEvidence", item._id);
      await ctx.db.delete("claimAssessments", row._id);
    }
    const oldAmbiguities = await ctx.db
      .query("decisionAmbiguities")
      .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
      .take(50);
    for (const row of oldAmbiguities) await ctx.db.delete("decisionAmbiguities", row._id);
    for (const row of oldContacts) {
      await ctx.db.delete("officialContacts", row._id);
    }
    for (const source of args.sources.slice(0, 40)) {
      const prior = await ctx.db
        .query("sourceDocuments")
        .withIndex("by_decisionId_and_contentHash", (q) =>
          q.eq("decisionId", decision._id).eq("contentHash", source.contentHash),
        )
        .first();
      if (prior === null) {
        await ctx.db.insert("sourceDocuments", { decisionId: decision._id, ...source });
      }
    }
    for (const assessment of args.assessments.slice(0, 50)) {
      const { evidence, ambiguity, ...assessmentFields } = assessment;
      const assessmentId = await ctx.db.insert("claimAssessments", {
        decisionId: decision._id,
        createdAt: now,
        ...assessmentFields,
      });
      for (const item of evidence.slice(0, 8)) {
        await ctx.db.insert("claimEvidence", {
          decisionId: decision._id,
          assessmentId,
          ...item,
          observedAt: now,
        });
      }
      if (ambiguity !== undefined) {
        await ctx.db.insert("decisionAmbiguities", {
          decisionId: decision._id,
          requirementId: assessment.requirementId,
          kind: ambiguity.kind,
          explanation: ambiguity.explanation.slice(0, 1_000),
          createdAt: now,
        });
      }
    }
    for (const contact of args.contacts.slice(0, 20)) {
      await ctx.db.insert("officialContacts", { decisionId: decision._id, createdAt: now, ...contact });
    }
    if (args.fullyEstablished) {
      await ctx.db.patch("decisions", decision._id, {
        title: args.title.slice(0, 120),
        category: args.category,
        status: "fully_established",
        operationalFailure: undefined,
        operationalMessage: undefined,
        analyzedAt: now,
        updatedAt: now,
      });
      await addEvent(
        ctx,
        decision._id,
        decision.status,
        "fully_established",
        "Official sources establish every decision boundary",
        now,
      );
      const supporting = args.assessments.filter((item) => item.status === "established");
      const oldCards = await ctx.db
        .query("proofCards")
        .withIndex("by_decisionId", (q) => q.eq("decisionId", decision._id))
        .take(10);
      for (const card of oldCards) {
        const oldItems = await ctx.db
          .query("proofItems")
          .withIndex("by_proofCardId_and_order", (q) => q.eq("proofCardId", card._id))
          .take(20);
        for (const item of oldItems) await ctx.db.delete("proofItems", item._id);
        await ctx.db.delete("proofCards", card._id);
      }
      const proofCardId = await ctx.db.insert("proofCards", {
        decisionId: decision._id,
        ownerId: decision.ownerId,
        basis: "official_source",
        verdict: "confirmed",
        exactRequirement: decision.requirementText,
        summary: args.summary.slice(0, 1_000),
        conditions: [],
        sourceUrls: supporting.flatMap((item) => (item.sourceUrl ? [item.sourceUrl] : [])).slice(0, 8),
        sourceExcerpts: supporting.flatMap((item) => (item.sourceExcerpt ? [item.sourceExcerpt] : [])).slice(0, 8),
        createdAt: now,
      });
      const requirements = await ctx.db
        .query("decisionRequirements")
        .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
        .take(20);
      const requirementById = new Map(requirements.map((requirement) => [requirement._id, requirement]));
      for (const assessment of supporting) {
        const requirement = requirementById.get(assessment.requirementId);
        if (!requirement) continue;
        await ctx.db.insert("proofItems", {
          proofCardId,
          decisionId: decision._id,
          requirementId: requirement._id,
          verdict: "confirmed",
          requirementText: requirement.text,
          summary: assessment.reason.slice(0, 1_000),
          conditions: [],
          sourceUrls: assessment.evidence.map((item) => item.sourceUrl).slice(0, 8),
          sourceExcerpts: assessment.evidence.map((item) => item.sourceExcerpt).slice(0, 8),
          order: assessment.order,
          createdAt: now,
        });
      }
      const monitor = await ctx.db
        .query("changeMonitors")
        .withIndex("by_decisionId", (q) => q.eq("decisionId", decision._id))
        .first();
      if (monitor === null) {
        await ctx.db.insert("changeMonitors", {
          decisionId: decision._id,
          ownerId: decision.ownerId,
          active: true,
          intervalHours: 24,
          nextCheckAt: now + 24 * 60 * 60 * 1_000,
          createdAt: now,
          updatedAt: now,
        });
      }
      return null;
    }

    await ctx.db.patch("decisions", decision._id, {
      title: args.title.slice(0, 120),
      category: args.category,
      status: "confirmation_available",
      operationalFailure: undefined,
      operationalMessage: undefined,
      analyzedAt: now,
      updatedAt: now,
    });
    await addEvent(
      ctx,
      decision._id,
      decision.status,
      "confirmation_available",
      "At least one decision boundary needs written confirmation",
      now,
    );
    await ctx.db.patch("decisions", decision._id, { status: "drafting_confirmation", updatedAt: now });
    await addEvent(ctx, decision._id, "confirmation_available", "drafting_confirmation", "Confirmation request drafted", now);
    const preferredContact = args.contacts[0];
    const oldDrafts = await ctx.db
      .query("confirmationRequests")
      .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
      .take(10);
    for (const oldDraft of oldDrafts) {
      if (["draft", "failed", "bounced", "complained", "rejected"].includes(oldDraft.status)) {
        await ctx.db.delete("confirmationRequests", oldDraft._id);
      }
    }
    const requestToken = `GIW-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId: decision._id,
      ownerId: decision.ownerId,
      requestToken,
      ...(preferredContact ? { recipient: preferredContact.email, recipientSourceUrl: preferredContact.sourceUrl } : {}),
      recipientSource: preferredContact ? "official_page" : "unselected",
      subject: `${args.draftSubject.slice(0, 180)} [${requestToken}]`,
      body: args.draftBody.slice(0, 8_000),
      followUpCount: 0,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("decisions", decision._id, { status: "awaiting_approval", updatedAt: now });
    await addEvent(ctx, decision._id, "drafting_confirmation", "awaiting_approval", "Waiting for your approval", now);
    return requestId;
  },
});
