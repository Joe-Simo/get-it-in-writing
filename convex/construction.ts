import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { evaluateConstructionRules } from "./lib/constructionRules";
import { requireMissionMember } from "./model/auth";

const ruleStatus = v.union(
  v.literal("verified"),
  v.literal("unverified"),
  v.literal("resolved"),
  v.literal("not_applicable"),
);

const ruleResult = v.object({
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
  status: ruleStatus,
  sourceVerified: v.boolean(),
  ownerLabel: v.optional(v.string()),
  note: v.optional(v.string()),
});

export const forMission = query({
  args: { missionId: v.id("missions") },
  returns: v.array(ruleResult),
  handler: async (ctx, args) => {
    await requireMissionMember(ctx, args.missionId);
    const [sources, requirements, overrides] = await Promise.all([
      ctx.db
        .query("sources")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(250),
      ctx.db
        .query("requirements")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(300),
      ctx.db
        .query("constructionOverrides")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(30),
    ]);
    return evaluateConstructionRules({ sources, requirements, overrides });
  },
});

function optionalText(
  value: string | undefined,
  field: string,
  maximumLength: number,
) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length > maximumLength) {
    throw new Error(`${field} must be ${maximumLength} characters or fewer`);
  }
  return trimmed || undefined;
}

export const setOverride = mutation({
  args: {
    missionId: v.id("missions"),
    ruleKey: v.string(),
    status: v.union(v.literal("resolved"), v.literal("not_applicable")),
    ownerLabel: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireMissionMember(ctx, args.missionId);
    const ruleKey = args.ruleKey.trim();
    if (!/^[a-z0-9_]{3,80}$/.test(ruleKey)) {
      throw new Error("Invalid construction check");
    }
    const existing = await ctx.db
      .query("constructionOverrides")
      .withIndex("by_missionId_and_ruleKey", (q) =>
        q.eq("missionId", args.missionId).eq("ruleKey", ruleKey),
      )
      .unique();
    const note = optionalText(args.note, "Note", 1_000);
    if (note === undefined || note.length < 4) {
      throw new Error("Add a short evidence note before resolving this check");
    }
    const record = {
      status: args.status,
      ownerLabel: optionalText(args.ownerLabel, "Owner", 80),
      note,
      updatedBy: userId,
      updatedAt: Date.now(),
    };
    if (existing === null) {
      await ctx.db.insert("constructionOverrides", {
        missionId: args.missionId,
        ruleKey,
        ...record,
      });
    } else {
      await ctx.db.patch("constructionOverrides", existing._id, record);
    }
    return null;
  },
});

export const clearOverride = mutation({
  args: { missionId: v.id("missions"), ruleKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMissionMember(ctx, args.missionId);
    const existing = await ctx.db
      .query("constructionOverrides")
      .withIndex("by_missionId_and_ruleKey", (q) =>
        q.eq("missionId", args.missionId).eq("ruleKey", args.ruleKey),
      )
      .unique();
    if (existing !== null) await ctx.db.delete("constructionOverrides", existing._id);
    return null;
  },
});
