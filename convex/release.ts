import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { evaluateConstructionRules } from "./lib/constructionRules";
import { deriveReleaseState } from "./lib/releaseGate";
import { requireMissionMember } from "./model/auth";

const impactArea = v.union(
  v.literal("deadline"),
  v.literal("scope"),
  v.literal("pricing"),
  v.literal("trade"),
  v.literal("forms"),
  v.literal("bonding"),
  v.literal("schedule"),
  v.literal("site_access"),
  v.literal("other"),
);

const impactSeverity = v.union(
  v.literal("blocking"),
  v.literal("high"),
  v.literal("standard"),
);

const impactStatus = v.union(
  v.literal("open"),
  v.literal("waiting"),
  v.literal("cleared"),
  v.literal("not_applicable"),
);

const blocker = v.object({
  key: v.string(),
  kind: v.union(
    v.literal("package"),
    v.literal("requirement"),
    v.literal("construction"),
    v.literal("change"),
  ),
  title: v.string(),
  detail: v.string(),
  ownerLabel: v.optional(v.string()),
});

export const forMission = query({
  args: { missionId: v.id("missions") },
  returns: v.object({
    state: v.union(
      v.literal("blocked"),
      v.literal("ready"),
      v.literal("approved"),
    ),
    approvedAt: v.optional(v.number()),
    packageVersion: v.number(),
    lastCapturedAt: v.optional(v.number()),
    blockers: v.array(blocker),
    impacts: v.array(
      v.object({
        _id: v.id("changeImpacts"),
        changeEventId: v.id("changeEvents"),
        title: v.string(),
        detail: v.string(),
        area: impactArea,
        severity: impactSeverity,
        status: impactStatus,
        blocksRelease: v.boolean(),
        sourceQuote: v.string(),
        ownerLabel: v.optional(v.string()),
        resolutionNote: v.optional(v.string()),
        updatedAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { mission } = await requireMissionMember(ctx, args.missionId);
    const [requirements, sources, overrides, impacts, changes, snapshot] =
      await Promise.all([
        ctx.db
          .query("requirements")
          .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
          .take(300),
        ctx.db
          .query("sources")
          .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
          .take(250),
        ctx.db
          .query("constructionOverrides")
          .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
          .take(30),
        ctx.db
          .query("changeImpacts")
          .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
          .order("desc")
          .take(100),
        ctx.db
          .query("changeEvents")
          .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
          .order("desc")
          .take(100),
        ctx.db
          .query("packageSnapshots")
          .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
          .order("desc")
          .first(),
      ]);
    const constructionChecks = evaluateConstructionRules({
      sources,
      requirements,
      overrides,
    });
    const derived = deriveReleaseState({
      hasBaseline: snapshot !== null,
      requirements: requirements.map((requirement) => ({
        ...requirement,
        _id: String(requirement._id),
      })),
      constructionChecks,
      impacts: impacts.map((impact) => ({
        ...impact,
        _id: String(impact._id),
      })),
      changes: changes.map((change) => ({
        ...change,
        _id: String(change._id),
      })),
    });
    const state: "blocked" | "ready" | "approved" =
      derived.state === "ready" && mission.releaseState === "approved"
        ? "approved"
        : derived.state;
    return {
      state,
      ...(state === "approved" && mission.releaseApprovedAt !== undefined
        ? { approvedAt: mission.releaseApprovedAt }
        : {}),
      packageVersion: snapshot?.version ?? 0,
      ...(snapshot === null ? {} : { lastCapturedAt: snapshot.capturedAt }),
      blockers: derived.blockers,
      impacts: impacts.map((impact) => ({
        _id: impact._id,
        changeEventId: impact.changeEventId,
        title: impact.title,
        detail: impact.detail,
        area: impact.area,
        severity: impact.severity,
        status: impact.status,
        blocksRelease: impact.blocksRelease,
        sourceQuote: impact.sourceQuote,
        ...(impact.ownerLabel === undefined
          ? {}
          : { ownerLabel: impact.ownerLabel }),
        ...(impact.resolutionNote === undefined
          ? {}
          : { resolutionNote: impact.resolutionNote }),
        updatedAt: impact.updatedAt,
      })),
    };
  },
});

function optionalText(value: string | undefined, maximum: number) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length > maximum)
    throw new Error(`Text must be ${maximum} characters or fewer`);
  return trimmed || undefined;
}

export const updateImpact = mutation({
  args: {
    missionId: v.id("missions"),
    impactId: v.id("changeImpacts"),
    status: impactStatus,
    ownerLabel: v.optional(v.string()),
    resolutionNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { mission } = await requireMissionMember(ctx, args.missionId);
    const impact = await ctx.db.get("changeImpacts", args.impactId);
    if (impact === null || impact.missionId !== args.missionId) {
      throw new Error("Impact not found");
    }
    const resolutionNote = optionalText(args.resolutionNote, 1_500);
    if (
      (args.status === "cleared" || args.status === "not_applicable") &&
      (resolutionNote === undefined || resolutionNote.length < 4)
    ) {
      throw new Error(
        "Add a source or decision note before clearing this impact",
      );
    }
    const now = Date.now();
    await ctx.db.patch("changeImpacts", impact._id, {
      status: args.status,
      ownerLabel: optionalText(args.ownerLabel, 80),
      resolutionNote,
      updatedAt: now,
    });
    await ctx.db.patch("missions", mission._id, {
      releaseState: "blocked",
      releaseApprovedAt: undefined,
      releaseApprovedBy: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("missionEvents", {
      missionId: mission._id,
      type: "impact",
      label: `Impact ${args.status.replace("_", " ")}: ${impact.title}`,
      detail: resolutionNote,
      createdAt: now,
    });
    return null;
  },
});

export const approve = mutation({
  args: { missionId: v.id("missions"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { mission, userId } = await requireMissionMember(ctx, args.missionId);
    const note = args.note.trim();
    if (note.length < 8 || note.length > 1_000) {
      throw new Error("Add a concise release rationale (8-1000 characters)");
    }
    const [requirements, sources, overrides, impacts, changes, snapshot] =
      await Promise.all([
        ctx.db
          .query("requirements")
          .withIndex("by_missionId", (q) => q.eq("missionId", mission._id))
          .take(300),
        ctx.db
          .query("sources")
          .withIndex("by_missionId", (q) => q.eq("missionId", mission._id))
          .take(250),
        ctx.db
          .query("constructionOverrides")
          .withIndex("by_missionId", (q) => q.eq("missionId", mission._id))
          .take(30),
        ctx.db
          .query("changeImpacts")
          .withIndex("by_missionId", (q) => q.eq("missionId", mission._id))
          .take(100),
        ctx.db
          .query("changeEvents")
          .withIndex("by_missionId", (q) => q.eq("missionId", mission._id))
          .take(100),
        ctx.db
          .query("packageSnapshots")
          .withIndex("by_missionId", (q) => q.eq("missionId", mission._id))
          .order("desc")
          .first(),
      ]);
    const derived = deriveReleaseState({
      hasBaseline: snapshot !== null,
      requirements: requirements.map((item) => ({
        ...item,
        _id: String(item._id),
      })),
      constructionChecks: evaluateConstructionRules({
        sources,
        requirements,
        overrides,
      }),
      impacts: impacts.map((item) => ({ ...item, _id: String(item._id) })),
      changes: changes.map((item) => ({ ...item, _id: String(item._id) })),
    });
    if (derived.blockers.length > 0) {
      throw new Error(
        `Release is blocked by ${derived.blockers.length} unresolved item${derived.blockers.length === 1 ? "" : "s"}`,
      );
    }
    const now = Date.now();
    await ctx.db.patch("missions", mission._id, {
      releaseState: "approved",
      releaseApprovedAt: now,
      releaseApprovedBy: userId,
      updatedAt: now,
    });
    await ctx.db.insert("missionEvents", {
      missionId: mission._id,
      type: "release",
      label: "Bid package approved for release",
      detail: note,
      createdAt: now,
    });
    return null;
  },
});

export const reopen = mutation({
  args: { missionId: v.id("missions"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { mission } = await requireMissionMember(ctx, args.missionId);
    const note = args.note.trim();
    if (note.length < 4 || note.length > 1_000) {
      throw new Error("Add a reason for reopening release");
    }
    const now = Date.now();
    await ctx.db.patch("missions", mission._id, {
      releaseState: "blocked",
      releaseApprovedAt: undefined,
      releaseApprovedBy: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("missionEvents", {
      missionId: mission._id,
      type: "release",
      label: "Bid release reopened",
      detail: note,
      createdAt: now,
    });
    return null;
  },
});
