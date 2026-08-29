"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { AgentMailClient } from "agentmail";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

export const sendBrief = action({
  args: { briefId: v.id("briefs"), recipientEmail: v.string() },
  returns: v.id("emailDeliveries"),
  handler: async (ctx, args): Promise<Id<"emailDeliveries">> => {
    const requesterId = await getAuthUserId(ctx);
    if (requesterId === null) throw new Error("401: sign in required");
    const recipientEmail = args.recipientEmail.trim().toLowerCase();
    if (!emailPattern.test(recipientEmail)) throw new Error("Enter a valid team member email");
    const brief = await ctx.runQuery(internal.emails.getSendContext, {
      briefId: args.briefId,
      requesterId,
      recipientEmail,
    });
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    if (!apiKey || !inboxId) throw new Error("AgentMail is not configured for this deployment");
    const client = new AgentMailClient({ apiKey });
    const message = await client.inboxes.messages.send(inboxId, {
      to: recipientEmail,
      subject: `[Signal Garden] ${brief.title}`,
      text: `${brief.summary}\n\n${brief.body}\n\nReply with a comment or question. Refresh requests are held for approval in the app.`,
      html: `<main style="font-family:system-ui;max-width:680px;margin:auto;color:#111"><p style="font-size:12px;text-transform:uppercase;letter-spacing:.12em">Signal Garden research brief</p><h1>${escapeHtml(brief.title)}</h1><p><strong>${escapeHtml(brief.summary)}</strong></p><div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(brief.body)}</div><hr><p>Reply with a comment or question. Refresh requests are held for approval in the app.</p></main>`,
    });
    return await ctx.runMutation(internal.emails.recordDelivery, {
      briefId: args.briefId,
      recipientEmail,
      inboxId,
      messageId: message.messageId,
      threadId: message.threadId,
    });
  },
});
