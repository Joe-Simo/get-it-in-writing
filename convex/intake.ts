import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const reserve = internalMutation({
  args: {
    websiteUrl: v.string(),
    emailHash: v.string(),
    testReference: v.optional(v.string()),
  },
  returns: v.id("websiteAuditRequests"),
  handler: async (ctx, args) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1_000;
    const recent = await ctx.db
      .query("websiteAuditRequests")
      .withIndex("by_emailHash_and_createdAt", (q) =>
        q.eq("emailHash", args.emailHash).gte("createdAt", oneHourAgo),
      )
      .take(3);
    if (recent.length >= 3) {
      throw new Error("Too many recent requests. Try again in an hour.");
    }
    const now = Date.now();
    return await ctx.db.insert("websiteAuditRequests", {
      websiteUrl: args.websiteUrl,
      emailHash: args.emailHash,
      ...(args.testReference === undefined
        ? {}
        : { testReference: args.testReference }),
      status: "reserved",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const markSent = internalMutation({
  args: {
    requestId: v.id("websiteAuditRequests"),
    messageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get("websiteAuditRequests", args.requestId);
    if (request !== null && request.status === "reserved") {
      await ctx.db.patch("websiteAuditRequests", request._id, {
        status: "sent",
        messageId: args.messageId,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const markFailed = internalMutation({
  args: { requestId: v.id("websiteAuditRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get("websiteAuditRequests", args.requestId);
    if (request !== null && request.status === "reserved") {
      await ctx.db.patch("websiteAuditRequests", request._id, {
        status: "failed",
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});
