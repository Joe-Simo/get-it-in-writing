import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMissionMember } from "./model/auth";

const publicGarden = v.union(
  v.null(),
  v.object({
    question: v.string(),
    publishedAt: v.number(),
    sources: v.array(v.object({
      _id: v.id("sources"),
      url: v.string(),
      title: v.string(),
      excerpt: v.string(),
    })),
    claims: v.array(v.object({
      _id: v.id("claims"),
      text: v.string(),
      summary: v.string(),
      status: v.union(v.literal("supported"), v.literal("disputed"), v.literal("unresolved")),
      confidence: v.number(),
      positionX: v.number(),
      positionY: v.number(),
    })),
    links: v.array(v.object({
      _id: v.id("claimSources"),
      claimId: v.id("claims"),
      sourceId: v.id("sources"),
      support: v.union(v.literal("supports"), v.literal("challenges"), v.literal("context")),
    })),
    brief: v.union(v.null(), v.object({ title: v.string(), summary: v.string(), body: v.string() })),
  }),
);

export const publish = mutation({
  args: { missionId: v.id("missions") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { mission, userId } = await requireMissionMember(ctx, args.missionId);
    if (mission.status !== "ready") throw new Error("Only ready missions can be published");
    const existing = await ctx.db
      .query("publicGardens")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .unique();
    if (existing !== null && existing.revokedAt === undefined) return existing.slug;
    const slug = `${mission.question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "garden"}-${crypto.randomUUID().slice(0, 8)}`;
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
      await ctx.db.patch("publicGardens", garden._id, { revokedAt: Date.now() });
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
    const [mission, sources, claims, links, briefs] = await Promise.all([
      ctx.db.get("missions", garden.missionId),
      ctx.db.query("sources").withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId)).take(250),
      ctx.db.query("claims").withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId)).take(250),
      ctx.db.query("claimSources").withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId)).take(500),
      ctx.db.query("briefs").withIndex("by_missionId", (q) => q.eq("missionId", garden.missionId)).order("desc").take(1),
    ]);
    if (mission === null) return null;
    return {
      question: mission.question,
      publishedAt: garden.publishedAt,
      sources: sources.map((source) => ({ _id: source._id, url: source.url, title: source.title, excerpt: source.excerpt })),
      claims: claims.map((claim) => ({ _id: claim._id, text: claim.text, summary: claim.summary, status: claim.status, confidence: claim.confidence, positionX: claim.positionX, positionY: claim.positionY })),
      links: links.map((link) => ({ _id: link._id, claimId: link.claimId, sourceId: link.sourceId, support: link.support })),
      brief: briefs[0]
        ? {
            title: briefs[0].title,
            summary: briefs[0].summary,
            body: briefs[0].body,
          }
        : null,
    };
  },
});
