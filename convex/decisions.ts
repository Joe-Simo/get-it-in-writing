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
  decisionCategory,
  decisionStatus,
  operationalFailure,
} from "./lib/decisionState";
import {
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
      contacts: v.array(schema.doc("officialContacts")),
      requests: v.array(schema.doc("confirmationRequests")),
      replies: v.array(schema.doc("confirmationReplies")),
      proofCard: v.union(v.null(), schema.doc("proofCards")),
      events: v.array(schema.doc("decisionEvents")),
    }),
  ),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null || decision.ownerId !== ownerId) return null;
    const [requirements, sources, assessments, contacts, requests, proofCard, events] =
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
          .query("officialContacts")
          .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
          .take(20),
        ctx.db
          .query("confirmationRequests")
          .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
          .order("desc")
          .take(5),
        ctx.db
          .query("proofCards")
          .withIndex("by_decisionId", (q) => q.eq("decisionId", decision._id))
          .order("desc")
          .first(),
        ctx.db
          .query("decisionEvents")
          .withIndex("by_decisionId_and_occurredAt", (q) => q.eq("decisionId", decision._id))
          .take(100),
      ]);
    const replies = requests[0]
      ? await ctx.db
          .query("confirmationReplies")
          .withIndex("by_requestId_and_receivedAt", (q) => q.eq("requestId", requests[0]._id))
          .take(10)
      : [];
    return { decision, requirements, sources, assessments, contacts, requests, replies, proofCard, events };
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
    await ctx.db.insert("decisionRequirements", {
      decisionId,
      ownerId,
      text: requirementText,
      order: 0,
      createdAt: now,
    });
    await addEvent(ctx, decisionId, undefined, "draft", "Decision created", now);
    await addEvent(ctx, decisionId, "draft", "scoping", "Requirement scoped", now);
    await ctx.scheduler.runAfter(0, internal.research.start, { decisionId });
    return decisionId;
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
        sourceUrl: v.optional(v.string()),
        sourceTitle: v.optional(v.string()),
        sourceExcerpt: v.optional(v.string()),
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
    const oldSources = await ctx.db
      .query("sourceDocuments")
      .withIndex("by_decisionId_and_url", (q) => q.eq("decisionId", decision._id))
      .take(50);
    const oldAssessments = await ctx.db
      .query("claimAssessments")
      .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
      .take(100);
    const oldContacts = await ctx.db
      .query("officialContacts")
      .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
      .take(50);
    for (const row of oldSources) {
      await ctx.db.delete("sourceDocuments", row._id);
    }
    for (const row of oldAssessments) {
      await ctx.db.delete("claimAssessments", row._id);
    }
    for (const row of oldContacts) {
      await ctx.db.delete("officialContacts", row._id);
    }
    for (const source of args.sources.slice(0, 40)) {
      await ctx.db.insert("sourceDocuments", { decisionId: decision._id, ...source });
    }
    for (const assessment of args.assessments.slice(0, 50)) {
      await ctx.db.insert("claimAssessments", { decisionId: decision._id, createdAt: now, ...assessment });
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
      await addEvent(ctx, decision._id, "analyzing", "fully_established", "Official source establishes the requirement", now);
      const supporting = args.assessments.filter((item) => item.status === "established");
      await ctx.db.insert("proofCards", {
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
    await addEvent(ctx, decision._id, "analyzing", "confirmation_available", "A consequential gap needs written confirmation", now);
    await ctx.db.patch("decisions", decision._id, { status: "drafting_confirmation", updatedAt: now });
    await addEvent(ctx, decision._id, "confirmation_available", "drafting_confirmation", "Confirmation request drafted", now);
    const preferredContact = args.contacts[0];
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
