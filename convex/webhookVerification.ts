"use node";

import { Webhook } from "svix";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { verifyFirecrawlWebhook } from "./lib/webhookAuth";

export const verifyFirecrawl = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
    authorization: v.string(),
  },
  returns: v.boolean(),
  handler: async (_ctx, args) => {
    const secret = process.env.FIRECRAWL_WEBHOOK_SECRET;
    if (!secret) return false;
    return verifyFirecrawlWebhook(
      args.payload,
      secret,
      args.signature,
      args.authorization,
    );
  },
});

export const verifyAgentMail = internalAction({
  args: {
    payload: v.string(),
    svixId: v.string(),
    svixTimestamp: v.string(),
    svixSignature: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      deliveryId: v.string(),
      eventId: v.string(),
      inboxId: v.string(),
      threadId: v.string(),
      messageId: v.string(),
      sender: v.string(),
      subject: v.string(),
      body: v.string(),
    }),
  ),
  handler: async (_ctx, args) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!secret) return null;
    try {
      const verified = new Webhook(secret).verify(args.payload, {
        "svix-id": args.svixId,
        "svix-timestamp": args.svixTimestamp,
        "svix-signature": args.svixSignature,
      }) as {
        event_type?: string;
        event_id?: string;
        message?: {
          inbox_id?: string;
          thread_id?: string;
          message_id?: string;
          from?: string;
          subject?: string;
          extracted_text?: string;
          text?: string;
          preview?: string;
        };
      };
      const message = verified.message;
      if (
        verified.event_type !== "message.received" ||
        !verified.event_id ||
        !message?.inbox_id ||
        !message.thread_id ||
        !message.message_id ||
        !message.from
      ) {
        return null;
      }
      return {
        deliveryId: args.svixId,
        eventId: verified.event_id,
        inboxId: message.inbox_id,
        threadId: message.thread_id,
        messageId: message.message_id,
        sender: message.from,
        subject: (message.subject ?? "").slice(0, 500),
        body: (message.extracted_text ?? message.text ?? message.preview ?? "").slice(0, 12_000),
      };
    } catch {
      return null;
    }
  },
});
