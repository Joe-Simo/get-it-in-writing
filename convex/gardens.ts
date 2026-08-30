import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { evaluateConstructionRules } from "./lib/constructionRules";
import { deriveReleaseState } from "./lib/releaseGate";
import { requireMissionMember } from "./model/auth";

const publicGarden = v.union(
  v.null(),
  v.object({
    question: v.string(),
    opportunity: v.union(
      v.null(),
      v.object({
        title: v.string(),
        solicitationUrl: v.string(),
        solicitationNumber: v.optional(v.string()),
        agency: v.optional(v.string()),
        bidDueAt: v.optional(v.number()),
        decision: v.optional(
          v.union(
            v.literal("undecided"),
            v.literal("bid"),
            v.literal("no_bid"),
          ),
        ),
      }),
    ),
    publishedAt: v.number(),
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
    requirements: v.array(
      v.object({
        _id: v.id("requirements"),
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
        dueDateText: v.optional(v.string()),
        sourceTitle: v.string(),
        sourceUrl: v.string(),
      }),
    ),
    constructionChecks: v.array(
      v.object({
        ruleKey: v.string(),
        label: v.string(),
        category: v.union(
          v.literal("package"),
          v.literal("submission"),
          v.literal("eligibility"),
          v.literal("bonding"),
          v.literal("labor"),
          v.literal("site_visit"),
          v.literal("schedule"),
          v.literal("safety"),
          v.literal("commercial"),
        ),
        severity: v.union(
          v.literal("blocking"),
          v.literal("high"),
          v.literal("standard"),
        ),
        explanation: v.string(),
        status: v.union(
          v.literal("verified"),
          v.literal("unverified"),
          v.literal("resolved"),
          v.literal("not_applicable"),
        ),
        sourceVerified: v.boolean(),
      }),
    ),
    control: v.object({
      state: v.union(
        v.literal("blocked"),
        v.literal("ready"),
        v.literal("approved"),
      ),
      packageVersion: v.number(),
      lastCapturedAt: v.optional(v.number()),
      impactCount: v.number(),
      blockers: v.array(
        v.object({
          kind: v.union(
            v.literal("package"),
            v.literal("requirement"),
            v.literal("construction"),
            v.literal("change"),
          ),
          title: v.string(),
        }),
      ),
    }),
    brief: v.union(
      v.null(),
      v.object({ title: v.string(), summary: v.string(), body: v.string() }),
    ),
    process: v.object({
      pagesProcessed: v.number(),
      sourceCount: v.number(),
      claimCount: v.number(),
      deliveryCount: v.number(),
      verifiedReplyCount: v.number(),
      events: v.array(
        v.object({
          type: v.union(
            v.literal("mission"),
            v.literal("crawl"),
            v.literal("source"),
            v.literal("claim"),
            v.literal("brief"),
            v.literal("email"),
            v.literal("watch"),
            v.literal("release"),
            v.literal("impact"),
          ),
          label: v.string(),
        }),
      ),
    }),
  }),
);

export const publish = mutation({
  args: { missionId: v.id("missions") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { mission, userId } = await requireMissionMember(ctx, args.missionId);
    if (mission.status !== "ready")
      throw new Error("Only ready missions can be published");
    const existing = await ctx.db
      .query("publicGardens")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .unique();
    if (existing !== null && existing.revokedAt === undefined)
      return existing.slug;
    const slug = `${
      mission.question
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 36) || "garden"
    }-${crypto.randomUUID().slice(0, 8)}`;
    if (existing === null) {
      await ctx.db.insert("publicGardens", {
        slug,
        missionId: args.missionId,
        teamId: mission.teamId,
        publishedBy: userId,
        publishedAt: Date.now(),
      });
    } else {
      await ctx.db.delete("publicGardens", existing._id);
      await ctx.db.insert("publicGardens", {
        slug,
        missionId: args.missionId,
        teamId: mission.teamId,
        publishedBy: userId,
        publishedAt: Date.now(),
      });
    }
    return slug;
  },
});

export const revoke = mutation({
  args: { missionId: v.id("missions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMissionMember(ctx, args.missionId);
    const garden = await ctx.db
      .query("publicGardens")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .unique();
    if (garden !== null && garden.revokedAt === undefined) {
      await ctx.db.patch("publicGardens", garden._id, {
        revokedAt: Date.now(),
      });
    }
    return null;
  },
});

export const getPublic = query({
  args: { slug: v.string() },
  returns: publicGarden,
  handler: async (ctx, args) => {
    const garden = await ctx.db
      .query("publicGardens")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (garden === null || garden.revokedAt !== undefined) return null;
    const [
      mission,
      sources,
      claims,
      links,
      requirements,
      briefs,
      events,
      deliveries,
      replies,
      constructionOverrides,
      impacts,
      changes,
      snapshot,
    ] = await Promise.all([
      ctx.db.get("missions", garden.missionId),
      ctx.db
        .query("sources")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .take(250),
      ctx.db
        .query("claims")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .take(250),
      ctx.db
        .query("claimSources")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .take(500),
      ctx.db
        .query("requirements")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .take(300),
      ctx.db
        .query("briefs")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .order("desc")
        .take(1),
      ctx.db
        .query("missionEvents")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .order("desc")
        .take(16),
      ctx.db
        .query("emailDeliveries")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .take(50),
      ctx.db
        .query("inboundReplies")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .take(50),
      ctx.db
        .query("constructionOverrides")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .take(30),
      ctx.db
        .query("changeImpacts")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .order("desc")
        .take(100),
      ctx.db
        .query("changeEvents")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .order("desc")
        .take(100),
      ctx.db
        .query("packageSnapshots")
        .withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId))
        .order("desc")
        .first(),
    ]);
    if (mission === null) return null;
    const claimSummaries = new Map(
      claims.map((claim) => [claim._id, claim.summary] as const),
    );
    const sourcesById = new Map(
      sources.map((source) => [source._id, source] as const),
    );
    const summariesBySource = new Map<string, string[]>();
    for (const link of links) {
      const summary = claimSummaries.get(link.claimId);
      if (!summary) continue;
      const existing = summariesBySource.get(link.sourceId) ?? [];
      if (!existing.includes(summary)) existing.push(summary);
      summariesBySource.set(link.sourceId, existing);
    }
    const constructionChecks = evaluateConstructionRules({
      sources,
      requirements,
      overrides: constructionOverrides,
    });
    const release = deriveReleaseState({
      hasBaseline: snapshot !== null,
      requirements: requirements.map((item) => ({
        ...item,
        _id: String(item._id),
      })),
      constructionChecks,
      impacts: impacts.map((item) => ({ ...item, _id: String(item._id) })),
      changes: changes.map((item) => ({ ...item, _id: String(item._id) })),
    });
    const releaseState: "blocked" | "ready" | "approved" =
      release.state === "ready" && mission.releaseState === "approved"
        ? "approved"
        : release.state;
    return {
      question: mission.question,
      opportunity:
        mission.workflowKind === "prebid" &&
        mission.opportunityTitle !== undefined &&
        mission.solicitationUrl !== undefined
          ? {
              title: mission.opportunityTitle,
              solicitationUrl: mission.solicitationUrl,
              ...(mission.solicitationNumber === undefined
                ? {}
                : { solicitationNumber: mission.solicitationNumber }),
              ...(mission.agency === undefined
                ? {}
                : { agency: mission.agency }),
              ...(mission.bidDueAt === undefined
                ? {}
                : { bidDueAt: mission.bidDueAt }),
              ...(mission.decision === undefined
                ? {}
                : { decision: mission.decision }),
            }
          : null,
      publishedAt: garden.publishedAt,
      sources: sources.map((source) => ({
        _id: source._id,
        url: source.url,
        title: source.title,
        excerpt:
          summariesBySource.get(source._id)?.slice(0, 2).join(" ") ||
          source.excerpt,
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
      requirements: requirements.flatMap((requirement) => {
        const source = sourcesById.get(requirement.sourceId);
        if (source === undefined) return [];
        return [
          {
            _id: requirement._id,
            text: requirement.text,
            category: requirement.category,
            criticality: requirement.criticality,
            status: requirement.status,
            requiredWithBid: requirement.requiredWithBid,
            ...(requirement.dueDateText === undefined
              ? {}
              : { dueDateText: requirement.dueDateText }),
            sourceTitle: source.title,
            sourceUrl: source.url,
          },
        ];
      }),
      constructionChecks: constructionChecks.map((check) => ({
        ruleKey: check.ruleKey,
        label: check.label,
        category: check.category,
        severity: check.severity,
        explanation: check.explanation,
        status: check.status,
        sourceVerified: check.sourceVerified,
      })),
      control: {
        state: releaseState,
        packageVersion: snapshot?.version ?? 0,
        ...(snapshot === null ? {} : { lastCapturedAt: snapshot.capturedAt }),
        impactCount: impacts.length,
        blockers: release.blockers
          .slice(0, 8)
          .map(({ kind, title }) => ({ kind, title })),
      },
      brief: briefs[0]
        ? {
            title: briefs[0].title,
            summary: briefs[0].summary,
            body: briefs[0].body,
          }
        : null,
      process: {
        pagesProcessed: mission.pagesProcessed,
        sourceCount: mission.sourceCount,
        claimCount: mission.claimCount,
        deliveryCount: deliveries.length,
        verifiedReplyCount: replies.length,
        events: events
          .slice()
          .reverse()
          .map((event) => ({ type: event.type, label: event.label })),
      },
    };
  },
});
