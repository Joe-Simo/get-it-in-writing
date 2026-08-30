"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { AgentMailClient } from "agentmail";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export const sendFollowup = action({
  args: {
    missionId: v.id("missions"),
    impactId: v.id("changeImpacts"),
    name: v.string(),
    email: v.string(),
    trade: v.string(),
    company: v.optional(v.string()),
    question: v.string(),
  },
  returns: v.id("emailDeliveries"),
  handler: async (ctx, args): Promise<Id<"emailDeliveries">> => {
    const requesterId = await getAuthUserId(ctx);
    if (requesterId === null) throw new Error("401: sign in required");
    const context = await ctx.runMutation(internal.outreach.prepareFollowup, {
      ...args,
      requesterId,
    });
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    if (!apiKey || !inboxId) {
      throw new Error(
        "Outbound follow-up is not configured for this deployment",
      );
    }
    const client = new AgentMailClient({ apiKey });
    const message = await client.inboxes.messages.send(inboxId, {
      to: context.recipientEmail,
      subject: context.subject,
      text: `Hello ${context.recipientName},\n\nWe are updating our bid for ${context.missionTitle}.\n\nPackage change: ${context.impactTitle}\n${context.impactDetail}\n\nChanged source text:\n“${context.sourceQuote}”\n\n${context.question}\n\nPlease reply to this email so your answer remains attached to this bid impact.`,
      html: `<main style="font-family:system-ui;max-width:680px;margin:auto;color:#111"><p>Hello ${escapeHtml(context.recipientName)},</p><p>We are updating our bid for <strong>${escapeHtml(context.missionTitle)}</strong>.</p><h2>${escapeHtml(context.impactTitle)}</h2><p>${escapeHtml(context.impactDetail)}</p><blockquote style="border-left:3px solid #61764b;padding-left:16px;color:#444">${escapeHtml(context.sourceQuote)}</blockquote><p>${escapeHtml(context.question)}</p><p>Please reply to this email so your answer remains attached to this bid impact.</p></main>`,
    });
    return await ctx.runMutation(internal.outreach.recordSent, {
      threadId: context.threadId,
      teamId: context.teamId,
      missionId: args.missionId,
      impactId: args.impactId,
      contactId: context.contactId,
      recipientEmail: context.recipientEmail,
      inboxId,
      messageId: message.messageId,
      messageThreadId: message.threadId,
    });
  },
});
