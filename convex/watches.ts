import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireMissionMember } from "./model/auth";

const DAY_MS = 86_400_000;

export const forMission = query({
  args: { missionId: v.id("missions") },
  returns: v.object({
    watch: v.union(
      v.null(),
      v.object({
        enabled: v.boolean(),
        frequency: v.literal("daily"),
        lastCheckedAt: v.optional(v.number()),
        nextCheckAt: v.number(),
        packageVersion: v.number(),
      }),
    ),
    changes: v.array(
      v.object({
        _id: v.id("changeEvents"),
        summary: v.string(),
        status: v.union(v.literal("detected"), v.literal("reviewed")),
        detectedAt: v.number(),
        notifiedAt: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireMissionMember(ctx, args.missionId);
    const [watch, changes, snapshot] = await Promise.all([
      ctx.db
        .query("missionWatches")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .unique(),
      ctx.db
        .query("changeEvents")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .order("desc")
        .take(20),
      ctx.db
        .query("packageSnapshots")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .order("desc")
        .first(),
    ]);
    return {
      watch:
        watch === null
          ? null
          : {
              enabled: watch.enabled,
              frequency: watch.frequency,
              ...(watch.lastCheckedAt === undefined
                ? {}
                : { lastCheckedAt: watch.lastCheckedAt }),
              nextCheckAt: watch.nextCheckAt,
              packageVersion: snapshot?.version ?? 0,
            },
      changes: changes.map((change) => ({
        _id: change._id,
        summary: change.summary,
        status: change.status,
        detectedAt: change.detectedAt,
        ...(change.notifiedAt === undefined
          ? {}
          : { notifiedAt: change.notifiedAt }),
      })),
    };
  },
});

export const configure = mutation({
  args: { missionId: v.id("missions"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { mission } = await requireMissionMember(ctx, args.missionId);
    if (mission.workflowKind !== "prebid" || !mission.solicitationUrl) {
      throw new Error("Amendment watch requires a pre-bid solicitation URL");
    }
    const team = await ctx.db.get("teams", mission.teamId);
    if (team === null) throw new Error("Team not found");
    if (args.enabled && !team.reviewEmail) {
      throw new Error("Set an approved review email before enabling alerts");
    }
    const existing = await ctx.db
      .query("missionWatches")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .unique();
    const now = Date.now();
    if (existing === null) {
      await ctx.db.insert("missionWatches", {
        missionId: args.missionId,
        teamId: mission.teamId,
        recipientEmail: team.reviewEmail ?? "",
        enabled: args.enabled,
        frequency: "daily",
        nextCheckAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch("missionWatches", existing._id, {
        enabled: args.enabled,
        recipientEmail: team.reviewEmail ?? existing.recipientEmail,
        nextCheckAt: args.enabled ? now : existing.nextCheckAt,
        updatedAt: now,
      });
    }
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "watch",
      label: args.enabled
        ? "Daily amendment watch enabled"
        : "Amendment watch paused",
      detail: args.enabled
        ? "Firecrawl will compare the public notice and AgentMail will alert the approved review route when it changes."
        : "No scheduled checks will run while the watch is paused.",
      createdAt: now,
    });
    return null;
  },
});

export const ensureForPublishedMission = internalMutation({
  args: { slug: v.string() },
  returns: v.id("missionWatches"),
  handler: async (ctx, args) => {
    const garden = await ctx.db
      .query("publicGardens")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (garden === null || garden.revokedAt !== undefined) {
      throw new Error("Published bid record not found");
    }
    const mission = await ctx.db.get("missions", garden.missionId);
    if (
      mission === null ||
      mission.workflowKind !== "prebid" ||
      !mission.solicitationUrl
    ) {
      throw new Error("Published record is not a live pre-bid mission");
    }
    const team = await ctx.db.get("teams", mission.teamId);
    if (team === null || !team.reviewEmail) {
      throw new Error("The bid team has no approved review route");
    }
    const existing = await ctx.db
      .query("missionWatches")
      .withIndex("by_missionId", (q) => q.eq("missionId", mission._id))
      .unique();
    const now = Date.now();
    if (existing !== null) {
      await ctx.db.patch("missionWatches", existing._id, {
        enabled: true,
        recipientEmail: team.reviewEmail,
        nextCheckAt: now,
        updatedAt: now,
      });
      return existing._id;
    }
    const watchId = await ctx.db.insert("missionWatches", {
      missionId: mission._id,
      teamId: mission.teamId,
      recipientEmail: team.reviewEmail,
      enabled: true,
      frequency: "daily",
      nextCheckAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("missionEvents", {
      missionId: mission._id,
      type: "watch",
      label: "Daily package control enabled",
      detail:
        "The current public package will become version 1; later checks preserve new versions and route material changes to the release gate.",
      createdAt: now,
    });
    return watchId;
  },
});

export const markReviewed = mutation({
  args: { missionId: v.id("missions"), changeEventId: v.id("changeEvents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMissionMember(ctx, args.missionId);
    const change = await ctx.db.get("changeEvents", args.changeEventId);
    if (change === null || change.missionId !== args.missionId) {
      throw new Error("Change event not found");
    }
    if (change.status === "reviewed") return null;
    await ctx.db.patch("changeEvents", change._id, { status: "reviewed" });
    const remaining = await ctx.db
      .query("changeEvents")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .order("desc")
      .take(100);
    if (
      !remaining.some(
        (candidate) =>
          candidate._id !== change._id && candidate.status === "detected",
      )
    ) {
      await ctx.db.patch("missions", args.missionId, {
        reviewState: "current",
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const listDue = internalQuery({
  args: { now: v.number(), limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("missionWatches"),
      missionId: v.id("missions"),
      recipientEmail: v.string(),
      lastSourceHash: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(20, Math.trunc(args.limit)));
    const watches = await ctx.db
      .query("missionWatches")
      .withIndex("by_enabled_and_nextCheckAt", (q) =>
        q.eq("enabled", true).lte("nextCheckAt", args.now),
      )
      .take(limit);
    return watches.map((watch) => ({
      _id: watch._id,
      missionId: watch.missionId,
      recipientEmail: watch.recipientEmail,
      ...(watch.lastSourceHash === undefined
        ? {}
        : { lastSourceHash: watch.lastSourceHash }),
    }));
  },
});

export const getCheckContext = internalQuery({
  args: {
    watchId: v.optional(v.id("missionWatches")),
    missionId: v.optional(v.id("missions")),
    requesterId: v.optional(v.id("users")),
  },
  returns: v.object({
    watchId: v.id("missionWatches"),
    missionId: v.id("missions"),
    title: v.string(),
    solicitationUrl: v.string(),
    recipientEmail: v.string(),
    lastSourceHash: v.optional(v.string()),
    previousMarkdown: v.optional(v.string()),
    previousLinks: v.optional(v.array(v.string())),
    previousSnapshotId: v.optional(v.id("packageSnapshots")),
    previousVersion: v.number(),
  }),
  handler: async (ctx, args) => {
    const watch = args.watchId
      ? await ctx.db.get("missionWatches", args.watchId)
      : args.missionId
        ? await ctx.db
            .query("missionWatches")
            .withIndex("by_missionId", (q) =>
              q.eq("missionId", args.missionId!),
            )
            .unique()
        : null;
    if (watch === null) throw new Error("Amendment watch not found");
    const mission = await ctx.db.get("missions", watch.missionId);
    if (mission === null || !mission.solicitationUrl) {
      throw new Error("Solicitation not found");
    }
    if (args.requesterId !== undefined) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_teamId", (q) =>
          q.eq("userId", args.requesterId!).eq("teamId", mission.teamId),
        )
        .unique();
      if (membership === null) throw new Error("403: team membership required");
    }
    const snapshot = await ctx.db
      .query("packageSnapshots")
      .withIndex("by_watchId", (q) => q.eq("watchId", watch._id))
      .order("desc")
      .first();
    return {
      watchId: watch._id,
      missionId: mission._id,
      title: mission.opportunityTitle ?? mission.question,
      solicitationUrl: mission.solicitationUrl,
      recipientEmail: watch.recipientEmail,
      ...(watch.lastSourceHash === undefined
        ? {}
        : { lastSourceHash: watch.lastSourceHash }),
      ...(snapshot === null
        ? {}
        : {
            previousMarkdown: snapshot.markdown,
            previousLinks: snapshot.linkInventory,
            previousSnapshotId: snapshot._id,
          }),
      previousVersion: snapshot?.version ?? 0,
    };
  },
});

export const recordCheck = internalMutation({
  args: {
    watchId: v.id("missionWatches"),
    sourceHash: v.string(),
    summary: v.string(),
    markdown: v.string(),
    linkInventory: v.array(v.string()),
    trigger: v.union(v.literal("scheduled"), v.literal("manual")),
    addedText: v.optional(v.string()),
    removedText: v.optional(v.string()),
    impacts: v.array(
      v.object({
        title: v.string(),
        detail: v.string(),
        area: v.union(
          v.literal("deadline"),
          v.literal("scope"),
          v.literal("pricing"),
          v.literal("trade"),
          v.literal("forms"),
          v.literal("bonding"),
          v.literal("schedule"),
          v.literal("site_access"),
          v.literal("other"),
        ),
        severity: v.union(
          v.literal("blocking"),
          v.literal("high"),
          v.literal("standard"),
        ),
        blocksRelease: v.boolean(),
        sourceQuote: v.string(),
      }),
    ),
  },
  returns: v.union(v.null(), v.id("changeEvents")),
  handler: async (ctx, args) => {
    const watch = await ctx.db.get("missionWatches", args.watchId);
    if (watch === null) throw new Error("Amendment watch not found");
    const now = Date.now();
    const changed =
      watch.lastSourceHash !== undefined &&
      watch.lastSourceHash !== args.sourceHash;
    const previousSnapshot = await ctx.db
      .query("packageSnapshots")
      .withIndex("by_watchId", (q) => q.eq("watchId", watch._id))
      .order("desc")
      .first();
    const snapshotId = await ctx.db.insert("packageSnapshots", {
      missionId: watch.missionId,
      watchId: watch._id,
      version: (previousSnapshot?.version ?? 0) + 1,
      sourceHash: args.sourceHash,
      markdown: args.markdown.slice(0, 200_000),
      linkInventory: args.linkInventory.slice(0, 100),
      trigger: previousSnapshot === null ? "baseline" : args.trigger,
      capturedAt: now,
    });
    let changeEventId = null;
    if (changed) {
      changeEventId = await ctx.db.insert("changeEvents", {
        missionId: watch.missionId,
        watchId: watch._id,
        previousHash: watch.lastSourceHash,
        currentHash: args.sourceHash,
        summary: args.summary.slice(0, 500),
        ...(previousSnapshot === null
          ? {}
          : { previousSnapshotId: previousSnapshot._id }),
        currentSnapshotId: snapshotId,
        ...(args.addedText === undefined
          ? {}
          : { addedText: args.addedText.slice(0, 20_000) }),
        ...(args.removedText === undefined
          ? {}
          : { removedText: args.removedText.slice(0, 20_000) }),
        status: "detected",
        detectedAt: now,
      });
      for (const impact of args.impacts.slice(0, 12)) {
        await ctx.db.insert("changeImpacts", {
          missionId: watch.missionId,
          changeEventId,
          title: impact.title.slice(0, 160),
          detail: impact.detail.slice(0, 1_500),
          area: impact.area,
          severity: impact.severity,
          status: "open",
          blocksRelease: impact.blocksRelease,
          sourceQuote: impact.sourceQuote.slice(0, 2_000),
          createdAt: now,
          updatedAt: now,
        });
      }
      await ctx.db.patch("missions", watch.missionId, {
        reviewState: "change_detected",
        releaseState: "blocked",
        releaseApprovedAt: undefined,
        releaseApprovedBy: undefined,
        lastPackageCheckedAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("missionEvents", {
        missionId: watch.missionId,
        type: "watch",
        label: "Solicitation change detected",
        detail:
          "The bid/no-bid record is held for human review; no decision was changed automatically.",
        createdAt: now,
      });
      await ctx.db.insert("missionEvents", {
        missionId: watch.missionId,
        type: "impact",
        label: `${args.impacts.length} amendment impact${args.impacts.length === 1 ? "" : "s"} routed to the release gate`,
        detail:
          "Each impact retains the changed source passage and must be cleared by a person before release.",
        createdAt: now,
      });
    } else {
      await ctx.db.patch("missions", watch.missionId, {
        lastPackageCheckedAt: now,
        ...(previousSnapshot === null
          ? { releaseState: "blocked" as const }
          : {}),
        updatedAt: now,
      });
    }
    await ctx.db.patch("missionWatches", watch._id, {
      lastSourceHash: args.sourceHash,
      lastCheckedAt: now,
      nextCheckAt: now + DAY_MS,
      updatedAt: now,
    });
    return changeEventId;
  },
});

export const markNotified = internalMutation({
  args: { changeEventId: v.id("changeEvents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const change = await ctx.db.get("changeEvents", args.changeEventId);
    if (change !== null && change.notifiedAt === undefined) {
      await ctx.db.patch("changeEvents", change._id, {
        notifiedAt: Date.now(),
      });
    }
    return null;
  },
});
