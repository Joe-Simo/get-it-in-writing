import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { requireTeamMember } from "./model/auth";

const deliveryStatus = v.union(
  v.literal("pending"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed"),
);

const checkpointKind = v.union(
  v.literal("website"),
  v.literal("form"),
  v.literal("confirmation"),
  v.literal("human_reply"),
);

const alertContext = v.object({
  deliveryId: v.id("journeyAlertDeliveries"),
  teamId: v.id("teams"),
  kind: v.union(v.literal("incident"), v.literal("test")),
  token: v.string(),
  status: deliveryStatus,
  attemptCount: v.number(),
  createdAt: v.number(),
  recipientEmail: v.string(),
  domain: v.optional(v.string()),
  incidentId: v.optional(v.id("journeyIncidents")),
  journeyId: v.optional(v.id("customerJourneys")),
  journeyName: v.optional(v.string()),
  title: v.optional(v.string()),
  detail: v.optional(v.string()),
  checkpointKind: v.optional(checkpointKind),
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const testAlertCooldownMs = 5 * 60 * 1_000;
const sendingLeaseMs = 10 * 60 * 1_000;

export const getStatus = query({
  args: { teamId: v.id("teams") },
  returns: v.object({
    enabled: v.boolean(),
    lastTestStatus: v.union(v.null(), deliveryStatus),
    lastTestAt: v.union(v.null(), v.number()),
  }),
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId);
    const team = await ctx.db.get("teams", args.teamId);
    if (team === null) throw new Error("404: team not found");
    const owner = await ctx.db.get("users", team.ownerId);
    const recipientEmail = team.reviewEmail ?? owner?.email;
    const recent = await ctx.db
      .query("journeyAlertDeliveries")
      .withIndex("by_teamId_and_createdAt", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .take(20);
    const latestTest = recent.find((delivery) => delivery.kind === "test");
    return {
      enabled:
        typeof recipientEmail === "string" && emailPattern.test(recipientEmail),
      lastTestStatus: latestTest?.status ?? null,
      lastTestAt: latestTest?.createdAt ?? null,
    };
  },
});

export const reserveTest = internalMutation({
  args: {
    teamId: v.id("teams"),
    requesterId: v.id("users"),
  },
  returns: v.id("journeyAlertDeliveries"),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_teamId", (q) =>
        q.eq("userId", args.requesterId).eq("teamId", args.teamId),
      )
      .unique();
    if (membership?.role !== "owner") {
      throw new Error("Only the workspace owner can send a test alert");
    }
    const team = await ctx.db.get("teams", args.teamId);
    if (team === null) throw new Error("404: team not found");
    const owner = await ctx.db.get("users", team.ownerId);
    const recipientEmail = team.reviewEmail ?? owner?.email;
    if (typeof recipientEmail !== "string" || !emailPattern.test(recipientEmail)) {
      throw new Error("Add a valid owner email before testing alerts");
    }
    const now = Date.now();
    const recent = await ctx.db
      .query("journeyAlertDeliveries")
      .withIndex("by_teamId_and_createdAt", (q) =>
        q.eq("teamId", args.teamId).gte("createdAt", now - testAlertCooldownMs),
      )
      .take(20);
    if (recent.some((delivery) => delivery.kind === "test")) {
      throw new Error("A test alert was already sent recently. Try again in a few minutes.");
    }
    return await ctx.db.insert("journeyAlertDeliveries", {
      teamId: args.teamId,
      kind: "test",
      token: `SG-ALERT-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
      status: "pending",
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getDeliveryContext = internalQuery({
  args: { deliveryId: v.id("journeyAlertDeliveries") },
  returns: v.union(v.null(), alertContext),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("journeyAlertDeliveries", args.deliveryId);
    if (delivery === null) return null;
    const team = await ctx.db.get("teams", delivery.teamId);
    if (team === null) return null;
    const owner = await ctx.db.get("users", team.ownerId);
    const recipientEmail = team.reviewEmail ?? owner?.email;
    if (typeof recipientEmail !== "string" || !emailPattern.test(recipientEmail)) {
      return null;
    }
    if (delivery.kind === "test") {
      return {
        deliveryId: delivery._id,
        teamId: delivery.teamId,
        kind: delivery.kind,
        token: delivery.token,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        createdAt: delivery.createdAt,
        recipientEmail,
      };
    }
    if (delivery.incidentId === undefined) return null;
    const incident = await ctx.db.get("journeyIncidents", delivery.incidentId);
    if (incident === null) return null;
    const journey = await ctx.db.get("customerJourneys", incident.journeyId);
    if (journey === null) return null;
    return {
      deliveryId: delivery._id,
      teamId: delivery.teamId,
      kind: delivery.kind,
      token: delivery.token,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      createdAt: delivery.createdAt,
      recipientEmail,
      domain: new URL(journey.startUrl).hostname,
      incidentId: incident._id,
      journeyId: journey._id,
      journeyName: journey.name,
      title: incident.title,
      detail: incident.detail,
      checkpointKind: incident.checkpointKind,
    };
  },
});

export const claim = internalMutation({
  args: { deliveryId: v.id("journeyAlertDeliveries") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("journeyAlertDeliveries", args.deliveryId);
    if (delivery === null || delivery.status === "sent") return false;
    const now = Date.now();
    if (
      delivery.status === "sending" &&
      delivery.updatedAt > now - sendingLeaseMs
    ) {
      return false;
    }
    await ctx.db.patch("journeyAlertDeliveries", delivery._id, {
      status: "sending",
      attemptCount: delivery.attemptCount + 1,
      failureCode: undefined,
      updatedAt: now,
    });
    return true;
  },
});

export const markSent = internalMutation({
  args: {
    deliveryId: v.id("journeyAlertDeliveries"),
    messageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("journeyAlertDeliveries", args.deliveryId);
    if (delivery === null) return null;
    await ctx.db.patch("journeyAlertDeliveries", delivery._id, {
      status: "sent",
      messageId: args.messageId,
      failureCode: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    deliveryId: v.id("journeyAlertDeliveries"),
    failureCode: v.union(
      v.literal("configuration"),
      v.literal("recipient"),
      v.literal("delivery"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("journeyAlertDeliveries", args.deliveryId);
    if (delivery === null || delivery.status === "sent") return null;
    await ctx.db.patch("journeyAlertDeliveries", delivery._id, {
      status: "failed",
      failureCode: args.failureCode,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listDue = internalQuery({
  args: {},
  returns: v.array(v.id("journeyAlertDeliveries")),
  handler: async (ctx) => {
    const now = Date.now();
    const [pending, failed, stale] = await Promise.all([
      ctx.db
        .query("journeyAlertDeliveries")
        .withIndex("by_status_and_updatedAt", (q) =>
          q.eq("status", "pending").lte("updatedAt", now),
        )
        .take(25),
      ctx.db
        .query("journeyAlertDeliveries")
        .withIndex("by_status_and_updatedAt", (q) =>
          q.eq("status", "failed").lt("updatedAt", now - testAlertCooldownMs),
        )
        .take(15),
      ctx.db
        .query("journeyAlertDeliveries")
        .withIndex("by_status_and_updatedAt", (q) =>
          q.eq("status", "sending").lt("updatedAt", now - sendingLeaseMs),
        )
        .take(10),
    ]);
    return [...pending, ...failed, ...stale]
      .filter((delivery) => delivery.attemptCount < 5)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, 50)
      .map((delivery) => delivery._id);
  },
});
