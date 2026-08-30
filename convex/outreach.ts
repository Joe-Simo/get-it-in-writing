import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireMissionMember } from "./model/auth";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const forMission = query({
  args: { missionId: v.id("missions") },
  returns: v.array(
    v.object({
      _id: v.id("outreachThreads"),
      impactId: v.id("changeImpacts"),
      contactName: v.string(),
      contactEmail: v.string(),
      trade: v.string(),
      subject: v.string(),
      question: v.string(),
      status: v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("replied"),
        v.literal("closed"),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireMissionMember(ctx, args.missionId);
    const threads = await ctx.db
      .query("outreachThreads")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .order("desc")
      .take(100);
    return await Promise.all(
      threads.map(async (thread) => {
        const contact = await ctx.db.get("bidContacts", thread.contactId);
        if (contact === null) throw new Error("Contact not found");
        return {
          _id: thread._id,
          impactId: thread.impactId,
          contactName: contact.name,
          contactEmail: contact.email,
          trade: contact.trade,
          subject: thread.subject,
          question: thread.question,
          status: thread.status,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        };
      }),
    );
  },
});

export const prepareFollowup = internalMutation({
  args: {
    missionId: v.id("missions"),
    impactId: v.id("changeImpacts"),
    requesterId: v.id("users"),
    name: v.string(),
    email: v.string(),
    trade: v.string(),
    company: v.optional(v.string()),
    question: v.string(),
  },
  returns: v.object({
    threadId: v.id("outreachThreads"),
    contactId: v.id("bidContacts"),
    teamId: v.id("teams"),
    missionTitle: v.string(),
    impactTitle: v.string(),
    impactDetail: v.string(),
    sourceQuote: v.string(),
    recipientEmail: v.string(),
    recipientName: v.string(),
    question: v.string(),
    subject: v.string(),
  }),
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (mission === null) throw new Error("Mission not found");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_teamId", (q) =>
        q.eq("userId", args.requesterId).eq("teamId", mission.teamId),
      )
      .unique();
    if (membership === null) throw new Error("403: team membership required");
    const impact = await ctx.db.get("changeImpacts", args.impactId);
    if (impact === null || impact.missionId !== mission._id) {
      throw new Error("Impact not found");
    }
    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    const trade = args.trade.trim();
    const question = args.question.trim();
    if (!emailPattern.test(email))
      throw new Error("Enter a valid contact email");
    if (name.length < 2 || name.length > 80)
      throw new Error("Enter the contact name");
    if (trade.length < 2 || trade.length > 80)
      throw new Error("Enter the contact trade or role");
    if (question.length < 8 || question.length > 2_000) {
      throw new Error("Write a focused follow-up question (8-2000 characters)");
    }
    const existingContact = await ctx.db
      .query("bidContacts")
      .withIndex("by_teamId_and_email", (q) =>
        q.eq("teamId", mission.teamId).eq("email", email),
      )
      .unique();
    const now = Date.now();
    const contactId =
      existingContact?._id ??
      (await ctx.db.insert("bidContacts", {
        teamId: mission.teamId,
        name,
        email,
        trade,
        ...(args.company?.trim()
          ? { company: args.company.trim().slice(0, 120) }
          : {}),
        createdAt: now,
      }));
    const subject = `Bid package change: ${impact.title}`.slice(0, 160);
    const threadId = await ctx.db.insert("outreachThreads", {
      missionId: mission._id,
      impactId: impact._id,
      contactId,
      subject,
      question,
      status: "draft",
      createdBy: args.requesterId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("changeImpacts", impact._id, {
      ownerLabel: impact.ownerLabel ?? `${name} · ${trade}`,
      status: "waiting",
      updatedAt: now,
    });
    return {
      threadId,
      contactId,
      teamId: mission.teamId,
      missionTitle: mission.opportunityTitle ?? mission.question,
      impactTitle: impact.title,
      impactDetail: impact.detail,
      sourceQuote: impact.sourceQuote,
      recipientEmail: email,
      recipientName: name,
      question,
      subject,
    };
  },
});

export const recordSent = internalMutation({
  args: {
    threadId: v.id("outreachThreads"),
    teamId: v.id("teams"),
    missionId: v.id("missions"),
    impactId: v.id("changeImpacts"),
    contactId: v.id("bidContacts"),
    recipientEmail: v.string(),
    inboxId: v.string(),
    messageId: v.string(),
    messageThreadId: v.string(),
  },
  returns: v.id("emailDeliveries"),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get("outreachThreads", args.threadId);
    if (
      thread === null ||
      thread.missionId !== args.missionId ||
      thread.impactId !== args.impactId ||
      thread.contactId !== args.contactId
    ) {
      throw new Error("Follow-up draft not found");
    }
    const now = Date.now();
    const deliveryId = await ctx.db.insert("emailDeliveries", {
      teamId: args.teamId,
      missionId: args.missionId,
      purpose: "impact_followup",
      impactId: args.impactId,
      contactId: args.contactId,
      recipientEmail: args.recipientEmail,
      inboxId: args.inboxId,
      messageId: args.messageId,
      threadId: args.messageThreadId,
      status: "sent",
      createdAt: now,
    });
    await ctx.db.patch("outreachThreads", thread._id, {
      deliveryId,
      status: "sent",
      updatedAt: now,
    });
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "email",
      label: "Package-change follow-up sent",
      detail: "The reply will remain linked to its exact amendment impact.",
      createdAt: now,
    });
    return deliveryId;
  },
});

export const close = mutation({
  args: { missionId: v.id("missions"), threadId: v.id("outreachThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMissionMember(ctx, args.missionId);
    const thread = await ctx.db.get("outreachThreads", args.threadId);
    if (thread === null || thread.missionId !== args.missionId) {
      throw new Error("Follow-up not found");
    }
    await ctx.db.patch("outreachThreads", thread._id, {
      status: "closed",
      updatedAt: Date.now(),
    });
    return null;
  },
});
