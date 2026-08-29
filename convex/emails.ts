import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getSendContext = internalQuery({
  args: {
    briefId: v.id("briefs"),
    requesterId: v.id("users"),
    recipientEmail: v.string(),
  },
  returns: v.object({
    title: v.string(),
    summary: v.string(),
    body: v.string(),
  }),
  handler: async (ctx, args) => {
    const brief = await ctx.db.get("briefs", args.briefId);
    if (brief === null) throw new Error("Brief not found");
    const requester = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_teamId", (q) =>
        q.eq("userId", args.requesterId).eq("teamId", brief.teamId),
      )
      .unique();
    if (requester === null) throw new Error("403: team membership required");
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_teamId", (q) => q.eq("teamId", brief.teamId))
      .take(20);
    const users = await Promise.all(memberships.map((membership) => ctx.db.get("users", membership.userId)));
    const recipient = args.recipientEmail.toLowerCase();
    if (!users.some((user) => user?.email?.toLowerCase() === recipient)) {
      throw new Error("Briefs can only be sent to current team members");
    }
    return { title: brief.title, summary: brief.summary, body: brief.body };
  },
});

export const recordDelivery = internalMutation({
  args: {
    briefId: v.id("briefs"),
    recipientEmail: v.string(),
    inboxId: v.string(),
    messageId: v.string(),
    threadId: v.string(),
  },
  returns: v.id("emailDeliveries"),
  handler: async (ctx, args) => {
    const brief = await ctx.db.get("briefs", args.briefId);
    if (brief === null) throw new Error("Brief not found");
    const deliveryId = await ctx.db.insert("emailDeliveries", {
      teamId: brief.teamId,
      missionId: brief.missionId,
      briefId: brief._id,
      recipientEmail: args.recipientEmail.toLowerCase(),
      inboxId: args.inboxId,
      messageId: args.messageId,
      threadId: args.threadId,
      status: "sent",
      createdAt: Date.now(),
    });
    await ctx.db.insert("missionEvents", {
      missionId: brief.missionId,
      type: "email",
      label: "Brief delivered to AgentMail",
      detail: "Replies will be signature-checked and held for review.",
      createdAt: Date.now(),
    });
    return deliveryId;
  },
});
