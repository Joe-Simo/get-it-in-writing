import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { containsCorrelationToken, senderDomain } from "./lib/journeySafety";

function matchesExpectedSender(actual: string, expected: string) {
  return actual === expected || actual.endsWith(`.${expected}`);
}

export const acceptAgentMail = internalMutation({
  args: {
    deliveryId: v.string(),
    eventId: v.string(),
    inboxId: v.string(),
    threadId: v.string(),
    messageId: v.string(),
    sender: v.string(),
    subject: v.string(),
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

    const domain = senderDomain(args.sender);
    const content = `${args.subject}\n${args.body}`;
    const now = Date.now();
    const waiting = await ctx.db
      .query("journeyEmailExpectations")
      .withIndex("by_inboxId_and_status", (q) =>
        q.eq("inboxId", args.inboxId).eq("status", "waiting"),
      )
      .order("desc")
      .take(20);
    const expectation = waiting.find(
      (candidate) =>
        candidate.deadlineAt >= now &&
        (containsCorrelationToken(content, candidate.correlationToken) ||
          (candidate.expectedSenderDomain !== undefined &&
            matchesExpectedSender(domain, candidate.expectedSenderDomain))),
    );
    if (expectation === undefined) return false;

    await ctx.db.insert("webhookReceipts", {
      provider: "agentmail",
      deliveryId: args.deliveryId,
      status: "accepted",
      receivedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.journeys.recordEmailReceived, {
      expectationId: expectation._id,
      messageId: args.messageId,
      senderDomain: domain,
      evidenceExcerpt:
        expectation.expectedKind === "confirmation"
          ? "The expected confirmation email arrived in the private test inbox."
          : "The expected follow-up email arrived in the private test inbox.",
    });
    return true;
  },
});
