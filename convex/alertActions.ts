"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { AgentMailClient } from "agentmail";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function checkpointLabel(kind: "website" | "form" | "confirmation" | "human_reply") {
  if (kind === "website") return "Website did not open";
  if (kind === "form") return "Lead form did not complete";
  if (kind === "confirmation") return "Confirmation did not arrive";
  return "Customer reply did not arrive";
}

export const sendDelivery = internalAction({
  args: { deliveryId: v.id("journeyAlertDeliveries") },
  returns: v.union(v.literal("sent"), v.literal("failed"), v.literal("skipped")),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.alerts.getDeliveryContext, args);
    if (context === null) {
      await ctx.runMutation(internal.alerts.markFailed, {
        deliveryId: args.deliveryId,
        failureCode: "recipient",
      });
      return "failed" as const;
    }
    const claimed = await ctx.runMutation(internal.alerts.claim, args);
    if (!claimed) return "skipped" as const;
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    const appUrl = process.env.PUBLIC_APP_URL;
    if (!apiKey || !inboxId || !appUrl) {
      await ctx.runMutation(internal.alerts.markFailed, {
        deliveryId: args.deliveryId,
        failureCode: "configuration",
      });
      return "failed" as const;
    }
    const client = new AgentMailClient({ apiKey });
    try {
      const existing = await client.inboxes.messages.search(inboxId, {
        q: context.token,
        limit: 10,
        after: new Date(context.createdAt - 60_000),
      });
      const previouslySent = existing.messages.find((message) =>
        message.labels.includes("sent"),
      );
      if (previouslySent !== undefined) {
        await ctx.runMutation(internal.alerts.markSent, {
          deliveryId: args.deliveryId,
          messageId: previouslySent.messageId,
        });
        return "sent" as const;
      }
      const isTest = context.kind === "test";
      const checkUrl = context.journeyId
        ? new URL(`/app/journeys/${context.journeyId}`, appUrl).toString()
        : new URL("/app", appUrl).toString();
      const subject = isTest
        ? "Signal Garden test alert: your lead-form alerts are working"
        : `Lead form check failed on ${context.domain ?? "your website"}`;
      const brokenStep = context.checkpointKind
        ? checkpointLabel(context.checkpointKind)
        : "Test alert delivered";
      const text = isTest
        ? `This is a test alert from Signal Garden. Your lead-form failure alerts are configured and can reach you.\n\nOpen Signal Garden: ${checkUrl}\n\nNo website check failed. This message was requested by the workspace owner.\n\nDelivery reference: ${context.token}`
        : `Signal Garden found a problem during the scheduled lead-form check for ${context.domain ?? "your website"}.\n\nBroken step: ${brokenStep}\nWhat happened: ${context.detail ?? "The check did not complete."}\n\nOpen the evidence and rerun the check: ${checkUrl}\n\nThis is an automated check, not a customer lead.\n\nDelivery reference: ${context.token}`;
      const html = isTest
        ? `<main style="font-family:system-ui;max-width:620px;margin:auto;color:#111"><p style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#4f7134">Signal Garden test alert</p><h1>Your lead-form alerts are working.</h1><p>This is a real delivery test requested by the workspace owner. No website check failed.</p><p><a href="${escapeHtml(checkUrl)}">Open Signal Garden</a></p><p style="color:#666;font-size:12px">Delivery reference: ${escapeHtml(context.token)}</p></main>`
        : `<main style="font-family:system-ui;max-width:620px;margin:auto;color:#111"><p style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#a83222">Lead-form check failed</p><h1>${escapeHtml(brokenStep)}</h1><p>${escapeHtml(context.detail ?? "The check did not complete.")}</p><p><a href="${escapeHtml(checkUrl)}">Open the evidence and rerun the check</a></p><p style="color:#666">This is an automated check, not a customer lead.</p><p style="color:#666;font-size:12px">Delivery reference: ${escapeHtml(context.token)}</p></main>`;
      const message = await client.inboxes.messages.send(inboxId, {
        to: context.recipientEmail,
        subject,
        text,
        html,
      });
      await ctx.runMutation(internal.alerts.markSent, {
        deliveryId: args.deliveryId,
        messageId: message.messageId,
      });
      return "sent" as const;
    } catch (error) {
      console.error(
        "Signal Garden alert delivery failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      await ctx.runMutation(internal.alerts.markFailed, {
        deliveryId: args.deliveryId,
        failureCode: "delivery",
      });
      return "failed" as const;
    }
  },
});

export const retryDue = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const due = await ctx.runQuery(internal.alerts.listDue, {});
    let sent = 0;
    for (const deliveryId of due) {
      const result = await ctx.runAction(internal.alertActions.sendDelivery, {
        deliveryId,
      });
      if (result === "sent") sent += 1;
    }
    return sent;
  },
});

export const sendTestAlert = action({
  args: { teamId: v.id("teams") },
  returns: v.object({ sent: v.literal(true) }),
  handler: async (ctx, args) => {
    const requesterId = await getAuthUserId(ctx);
    if (requesterId === null) throw new Error("401: sign in required");
    const deliveryId = await ctx.runMutation(internal.alerts.reserveTest, {
      teamId: args.teamId,
      requesterId,
    });
    const result = await ctx.runAction(internal.alertActions.sendDelivery, {
      deliveryId,
    });
    if (result !== "sent") {
      throw new Error("The test alert could not be delivered. Try again shortly.");
    }
    return { sent: true as const };
  },
});
