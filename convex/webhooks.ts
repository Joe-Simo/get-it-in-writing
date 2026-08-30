import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const acceptFirecrawl = internalMutation({
  args: { deliveryId: v.string(), crawlJobId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const prior = await ctx.db
      .query("webhookReceipts")
      .withIndex("by_provider_and_deliveryId", (q) =>
        q.eq("provider", "firecrawl").eq("deliveryId", args.deliveryId),
      )
      .unique();
    if (prior !== null) return false;
    const seed = await ctx.db
      .query("missionSeeds")
      .withIndex("by_crawlJobId", (q) => q.eq("crawlJobId", args.crawlJobId))
      .unique();
    if (seed === null || seed.status !== "crawling") return false;
    const mission = await ctx.db.get("missions", seed.missionId);
    if (
      mission === null ||
      !["crawling", "extracting"].includes(mission.status)
    )
      return false;
    await ctx.db.insert("webhookReceipts", {
      provider: "firecrawl",
      deliveryId: args.deliveryId,
      status: "accepted",
      receivedAt: Date.now(),
    });
    await ctx.db.patch("missionSeeds", seed._id, { status: "processing" });
    await ctx.scheduler.runAfter(0, internal.pipelineActions.processCrawlJob, {
      missionId: seed.missionId,
      seedId: seed._id,
      crawlJobId: args.crawlJobId,
    });
    return true;
  },
});

function normalizeAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

function classifyIntent(
  body: string,
): "comment" | "question" | "refresh_request" | "unrecognized" {
  const normalized = body.toLowerCase();
  if (/\b(refresh|rerun|re-run|crawl|expand|more sources)\b/.test(normalized))
    return "refresh_request";
  if (
    normalized.includes("?") ||
    /^(how|why|what|when|where|who|can|could|would)\b/.test(normalized.trim())
  )
    return "question";
  if (normalized.trim().length >= 12) return "comment";
  return "unrecognized";
}

export const acceptAgentMail = internalMutation({
  args: {
    deliveryId: v.string(),
    eventId: v.string(),
    inboxId: v.string(),
    threadId: v.string(),
    messageId: v.string(),
    sender: v.string(),
    body: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const prior = await ctx.db
      .query("webhookReceipts")
      .withIndex("by_provider_and_deliveryId", (q) =>
        q.eq("provider", "agentmail").eq("deliveryId", args.deliveryId),
      )
      .unique();
    if (prior !== null) return false;
    const delivery = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (
      delivery === null ||
      delivery.inboxId !== args.inboxId ||
      normalizeAddress(args.sender) !== delivery.recipientEmail.toLowerCase()
    ) {
      return false;
    }
    const duplicateMessage = await ctx.db
      .query("inboundReplies")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();
    if (duplicateMessage !== null) return false;
    await ctx.db.insert("webhookReceipts", {
      provider: "agentmail",
      deliveryId: args.deliveryId,
      status: "accepted",
      receivedAt: Date.now(),
    });
    await ctx.db.insert("inboundReplies", {
      deliveryId: delivery._id,
      missionId: delivery.missionId,
      messageId: args.messageId,
      senderEmail: normalizeAddress(args.sender),
      intent: classifyIntent(args.body),
      body: args.body,
      status: "pending",
      receivedAt: Date.now(),
    });
    await ctx.db.insert("missionEvents", {
      missionId: delivery.missionId,
      type: "email",
      label: "Verified email reply received",
      detail:
        "Pending review in Signal Garden; no crawl was started automatically.",
      createdAt: Date.now(),
    });
    if (delivery.purpose === "impact_followup") {
      const threads = await ctx.db
        .query("outreachThreads")
        .withIndex("by_missionId", (q) => q.eq("missionId", delivery.missionId))
        .take(100);
      const outreach = threads.find(
        (thread) => thread.deliveryId === delivery._id,
      );
      if (outreach !== undefined) {
        await ctx.db.patch("outreachThreads", outreach._id, {
          status: "replied",
          updatedAt: Date.now(),
        });
      }
    }
    return true;
  },
});
