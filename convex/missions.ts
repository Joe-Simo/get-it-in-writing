import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMissionMember, requireTeamMember } from "./model/auth";
import { missionWorkflowManager } from "./workflowManager";
import type { WorkflowId } from "@convex-dev/workflow";

const missionStatus = v.union(
  v.literal("draft"),
  v.literal("crawling"),
  v.literal("extracting"),
  v.literal("synthesizing"),
  v.literal("ready"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const missionSummary = v.object({
  _id: v.id("missions"),
  question: v.string(),
  workflowKind: v.optional(v.union(v.literal("research"), v.literal("prebid"))),
  opportunityTitle: v.optional(v.string()),
  solicitationNumber: v.optional(v.string()),
  agency: v.optional(v.string()),
  bidDueAt: v.optional(v.number()),
  decision: v.optional(
    v.union(v.literal("undecided"), v.literal("bid"), v.literal("no_bid")),
  ),
  releaseState: v.optional(
    v.union(v.literal("blocked"), v.literal("ready"), v.literal("approved")),
  ),
  reviewState: v.optional(
    v.union(v.literal("current"), v.literal("change_detected")),
  ),
  lastPackageCheckedAt: v.optional(v.number()),
  status: missionStatus,
  pageBudget: v.number(),
  depth: v.number(),
  pagesProcessed: v.number(),
  sourceCount: v.number(),
  claimCount: v.number(),
  updatedAt: v.number(),
});

const workspaceResult = v.object({
  mission: v.object({
    _id: v.id("missions"),
    question: v.string(),
    workflowKind: v.optional(
      v.union(v.literal("research"), v.literal("prebid")),
    ),
    opportunityTitle: v.optional(v.string()),
    solicitationUrl: v.optional(v.string()),
    solicitationNumber: v.optional(v.string()),
    agency: v.optional(v.string()),
    bidDueAt: v.optional(v.number()),
    decision: v.optional(
      v.union(v.literal("undecided"), v.literal("bid"), v.literal("no_bid")),
    ),
    decisionRationale: v.optional(v.string()),
    status: missionStatus,
    pageBudget: v.number(),
    depth: v.number(),
    pagesProcessed: v.number(),
    sourceCount: v.number(),
    claimCount: v.number(),
    error: v.optional(v.string()),
  }),
  seeds: v.array(
    v.object({
      _id: v.id("missionSeeds"),
      url: v.string(),
      status: v.union(
        v.literal("queued"),
        v.literal("crawling"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    }),
  ),
  sources: v.array(
    v.object({
      _id: v.id("sources"),
      url: v.string(),
      title: v.string(),
      excerpt: v.string(),
    }),
  ),
  claims: v.array(
    v.object({
      _id: v.id("claims"),
      text: v.string(),
      summary: v.string(),
      status: v.union(
        v.literal("supported"),
        v.literal("disputed"),
        v.literal("unresolved"),
      ),
      confidence: v.number(),
      positionX: v.number(),
      positionY: v.number(),
    }),
  ),
  links: v.array(
    v.object({
      _id: v.id("claimSources"),
      claimId: v.id("claims"),
      sourceId: v.id("sources"),
      support: v.union(
        v.literal("supports"),
        v.literal("challenges"),
        v.literal("context"),
      ),
    }),
  ),
  events: v.array(
    v.object({
      _id: v.id("missionEvents"),
      label: v.string(),
      detail: v.optional(v.string()),
    }),
  ),
  brief: v.union(
    v.null(),
    v.object({
      _id: v.id("briefs"),
      title: v.string(),
      summary: v.string(),
      body: v.string(),
    }),
  ),
  notes: v.array(
    v.object({
      _id: v.id("claimNotes"),
      claimId: v.id("claims"),
      body: v.string(),
      createdAt: v.number(),
    }),
  ),
  replies: v.array(
    v.object({
      _id: v.id("inboundReplies"),
      senderEmail: v.string(),
      intent: v.union(
        v.literal("comment"),
        v.literal("question"),
        v.literal("refresh_request"),
        v.literal("unrecognized"),
      ),
      body: v.string(),
      status: v.union(v.literal("pending"), v.literal("reviewed")),
      receivedAt: v.number(),
    }),
  ),
  requirements: v.array(
    v.object({
      _id: v.id("requirements"),
      sourceId: v.id("sources"),
      claimId: v.id("claims"),
      text: v.string(),
      category: v.union(
        v.literal("submission"),
        v.literal("bonding"),
        v.literal("insurance"),
        v.literal("eligibility"),
        v.literal("labor"),
        v.literal("safety"),
        v.literal("schedule"),
        v.literal("technical"),
        v.literal("pricing"),
        v.literal("other"),
      ),
      criticality: v.union(
        v.literal("disqualifier"),
        v.literal("high"),
        v.literal("standard"),
      ),
      status: v.union(
        v.literal("open"),
        v.literal("satisfied"),
        v.literal("missing"),
        v.literal("not_applicable"),
      ),
      requiredWithBid: v.boolean(),
      sourceQuote: v.string(),
      dueDateText: v.optional(v.string()),
      ownerLabel: v.optional(v.string()),
      note: v.optional(v.string()),
      sourceTitle: v.string(),
      sourceUrl: v.string(),
    }),
  ),
  garden: v.union(
    v.null(),
    v.object({
      slug: v.string(),
      publishedAt: v.number(),
      revokedAt: v.optional(v.number()),
    }),
  ),
  reviewEmail: v.union(v.null(), v.string()),
});

function parseSeedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Seed URLs must use http or https");
  }
  url.hash = "";
  return url.toString();
}

export const create = mutation({
  args: {
    teamId: v.id("teams"),
    question: v.string(),
    seeds: v.array(v.string()),
    pageBudget: v.number(),
    depth: v.number(),
    workflowKind: v.optional(
      v.union(v.literal("research"), v.literal("prebid")),
    ),
    opportunityTitle: v.optional(v.string()),
    solicitationUrl: v.optional(v.string()),
    solicitationNumber: v.optional(v.string()),
    agency: v.optional(v.string()),
    bidDueAt: v.optional(v.number()),
  },
  returns: v.id("missions"),
  handler: async (ctx, args) => {
    const { userId } = await requireTeamMember(ctx, args.teamId);
    const question = args.question.trim();
    if (question.length < 20 || question.length > 500) {
      throw new Error(
        "Research questions must be between 20 and 500 characters",
      );
    }
    if (
      !Number.isInteger(args.pageBudget) ||
      args.pageBudget < 1 ||
      args.pageBudget > 50
    ) {
      throw new Error("Page budget must be an integer between 1 and 50");
    }
    if (!Number.isInteger(args.depth) || args.depth < 0 || args.depth > 2) {
      throw new Error("Crawl depth must be 0, 1, or 2");
    }
    const workflowKind = args.workflowKind ?? "research";
    const opportunityTitle = args.opportunityTitle?.trim();
    if (
      workflowKind === "prebid" &&
      (opportunityTitle === undefined ||
        opportunityTitle.length < 3 ||
        opportunityTitle.length > 180)
    ) {
      throw new Error(
        "Opportunity titles must be between 3 and 180 characters",
      );
    }
    const solicitationUrl =
      args.solicitationUrl === undefined
        ? undefined
        : parseSeedUrl(args.solicitationUrl.trim());
    if (workflowKind === "prebid" && solicitationUrl === undefined) {
      throw new Error("Add the public solicitation URL for this opportunity");
    }
    if (
      args.bidDueAt !== undefined &&
      (!Number.isFinite(args.bidDueAt) ||
        args.bidDueAt < Date.UTC(2000, 0, 1) ||
        args.bidDueAt > Date.UTC(2100, 0, 1))
    ) {
      throw new Error("Bid deadline must be a valid date");
    }
    const seeds = [
      ...new Set(
        [solicitationUrl, ...args.seeds]
          .filter((seed): seed is string => seed !== undefined)
          .map((seed) => parseSeedUrl(seed.trim())),
      ),
    ];
    if (seeds.length < 1 || seeds.length > 4) {
      throw new Error("Add between one and four unique seed URLs");
    }
    if (args.pageBudget < seeds.length) {
      throw new Error("Page budget must allow at least one page per seed");
    }
    const now = Date.now();
    const missionId = await ctx.db.insert("missions", {
      teamId: args.teamId,
      createdBy: userId,
      question,
      workflowKind,
      ...(opportunityTitle === undefined ? {} : { opportunityTitle }),
      ...(solicitationUrl === undefined ? {} : { solicitationUrl }),
      ...(args.solicitationNumber?.trim()
        ? { solicitationNumber: args.solicitationNumber.trim().slice(0, 120) }
        : {}),
      ...(args.agency?.trim()
        ? { agency: args.agency.trim().slice(0, 180) }
        : {}),
      ...(args.bidDueAt === undefined ? {} : { bidDueAt: args.bidDueAt }),
      decision: "undecided",
      status: "draft",
      pageBudget: args.pageBudget,
      depth: args.depth,
      pagesProcessed: 0,
      sourceCount: 0,
      claimCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const pagesPerSeed = Math.floor(args.pageBudget / seeds.length);
    const remainder = args.pageBudget % seeds.length;
    await Promise.all(
      seeds.map((url, index) =>
        ctx.db.insert("missionSeeds", {
          missionId,
          url,
          pageLimit: pagesPerSeed + (index < remainder ? 1 : 0),
          status: "queued",
        }),
      ),
    );
    await ctx.db.insert("missionEvents", {
      missionId,
      type: "mission",
      label: "Mission framed",
      detail: `${seeds.length} seed${seeds.length === 1 ? "" : "s"} · ${args.pageBudget} page budget`,
      createdAt: now,
    });
    return missionId;
  },
});

export const list = query({
  args: { teamId: v.id("teams") },
  returns: v.array(missionSummary),
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId);
    const missions = await ctx.db
      .query("missions")
      .withIndex("by_teamId_and_updatedAt", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .take(24);
    return missions.map((mission) => ({
      _id: mission._id,
      question: mission.question,
      ...(mission.workflowKind === undefined
        ? {}
        : { workflowKind: mission.workflowKind }),
      ...(mission.opportunityTitle === undefined
        ? {}
        : { opportunityTitle: mission.opportunityTitle }),
      ...(mission.solicitationNumber === undefined
        ? {}
        : { solicitationNumber: mission.solicitationNumber }),
      ...(mission.agency === undefined ? {} : { agency: mission.agency }),
      ...(mission.bidDueAt === undefined ? {} : { bidDueAt: mission.bidDueAt }),
      ...(mission.decision === undefined ? {} : { decision: mission.decision }),
      ...(mission.releaseState === undefined
        ? {}
        : { releaseState: mission.releaseState }),
      ...(mission.reviewState === undefined
        ? {}
        : { reviewState: mission.reviewState }),
      ...(mission.lastPackageCheckedAt === undefined
        ? {}
        : { lastPackageCheckedAt: mission.lastPackageCheckedAt }),
      status: mission.status,
      pageBudget: mission.pageBudget,
      depth: mission.depth,
      pagesProcessed: mission.pagesProcessed,
      sourceCount: mission.sourceCount,
      claimCount: mission.claimCount,
      updatedAt: mission.updatedAt,
    }));
  },
});

export const getWorkspace = query({
  args: { missionId: v.id("missions") },
  returns: workspaceResult,
  handler: async (ctx, args) => {
    const { mission } = await requireMissionMember(ctx, args.missionId);
    const [
      seeds,
      sources,
      claims,
      links,
      events,
      briefs,
      notes,
      replies,
      requirements,
      garden,
      team,
    ] = await Promise.all([
      ctx.db
        .query("missionSeeds")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(8),
      ctx.db
        .query("sources")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(250),
      ctx.db
        .query("claims")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(250),
      ctx.db
        .query("claimSources")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(500),
      ctx.db
        .query("missionEvents")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .order("desc")
        .take(40),
      ctx.db
        .query("briefs")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .order("desc")
        .take(1),
      ctx.db
        .query("claimNotes")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .order("desc")
        .take(250),
      ctx.db
        .query("inboundReplies")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .order("desc")
        .take(100),
      ctx.db
        .query("requirements")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(300),
      ctx.db
        .query("publicGardens")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .unique(),
      ctx.db.get("teams", mission.teamId),
    ]);
    return {
      mission: {
        _id: mission._id,
        question: mission.question,
        ...(mission.workflowKind === undefined
          ? {}
          : { workflowKind: mission.workflowKind }),
        ...(mission.opportunityTitle === undefined
          ? {}
          : { opportunityTitle: mission.opportunityTitle }),
        ...(mission.solicitationUrl === undefined
          ? {}
          : { solicitationUrl: mission.solicitationUrl }),
        ...(mission.solicitationNumber === undefined
          ? {}
          : { solicitationNumber: mission.solicitationNumber }),
        ...(mission.agency === undefined ? {} : { agency: mission.agency }),
        ...(mission.bidDueAt === undefined
          ? {}
          : { bidDueAt: mission.bidDueAt }),
        ...(mission.decision === undefined
          ? {}
          : { decision: mission.decision }),
        ...(mission.decisionRationale === undefined
          ? {}
          : { decisionRationale: mission.decisionRationale }),
        status: mission.status,
        pageBudget: mission.pageBudget,
        depth: mission.depth,
        pagesProcessed: mission.pagesProcessed,
        sourceCount: mission.sourceCount,
        claimCount: mission.claimCount,
        ...(mission.error === undefined ? {} : { error: mission.error }),
      },
      seeds: seeds.map((seed) => ({
        _id: seed._id,
        url: seed.url,
        status: seed.status,
      })),
      sources: sources.map((source) => ({
        _id: source._id,
        url: source.url,
        title: source.title,
        excerpt: source.excerpt,
      })),
      claims: claims.map((claim) => ({
        _id: claim._id,
        text: claim.text,
        summary: claim.summary,
        status: claim.status,
        confidence: claim.confidence,
        positionX: claim.positionX,
        positionY: claim.positionY,
      })),
      links: links.map((link) => ({
        _id: link._id,
        claimId: link.claimId,
        sourceId: link.sourceId,
        support: link.support,
      })),
      events: events.map((event) => ({
        _id: event._id,
        label: event.label,
        ...(event.detail === undefined ? {} : { detail: event.detail }),
      })),
      brief: briefs[0]
        ? {
            _id: briefs[0]._id,
            title: briefs[0].title,
            summary: briefs[0].summary,
            body: briefs[0].body,
          }
        : null,
      notes: notes.map((note) => ({
        _id: note._id,
        claimId: note.claimId,
        body: note.body,
        createdAt: note.createdAt,
      })),
      replies: replies.map((reply) => ({
        _id: reply._id,
        senderEmail: reply.senderEmail,
        intent: reply.intent,
        body: reply.body,
        status: reply.status,
        receivedAt: reply.receivedAt,
      })),
      requirements: requirements.flatMap((requirement) => {
        const source = sources.find(
          (candidate) => candidate._id === requirement.sourceId,
        );
        if (source === undefined) return [];
        return [
          {
            _id: requirement._id,
            sourceId: requirement.sourceId,
            claimId: requirement.claimId,
            text: requirement.text,
            category: requirement.category,
            criticality: requirement.criticality,
            status: requirement.status,
            requiredWithBid: requirement.requiredWithBid,
            sourceQuote: requirement.sourceQuote,
            ...(requirement.dueDateText === undefined
              ? {}
              : { dueDateText: requirement.dueDateText }),
            ...(requirement.ownerLabel === undefined
              ? {}
              : { ownerLabel: requirement.ownerLabel }),
            ...(requirement.note === undefined
              ? {}
              : { note: requirement.note }),
            sourceTitle: source.title,
            sourceUrl: source.url,
          },
        ];
      }),
      garden:
        garden === null
          ? null
          : {
              slug: garden.slug,
              publishedAt: garden.publishedAt,
              ...(garden.revokedAt === undefined
                ? {}
                : { revokedAt: garden.revokedAt }),
            },
      reviewEmail: team?.reviewEmail ?? null,
    };
  },
});

export const cancel = mutation({
  args: { missionId: v.id("missions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { mission } = await requireMissionMember(ctx, args.missionId);
    if (["ready", "failed", "cancelled"].includes(mission.status)) return null;
    if (mission.workflowId !== undefined) {
      await missionWorkflowManager.cancel(
        ctx,
        mission.workflowId as WorkflowId,
      );
    }
    await ctx.db.patch("missions", args.missionId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "mission",
      label: "Mission cancelled",
      createdAt: Date.now(),
    });
    return null;
  },
});
