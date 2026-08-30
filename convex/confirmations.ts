import {
  AgentMail,
  type AgentMailEvent,
  type OutboundId,
  vEvent,
  vOutboundStatus,
} from "@agentmail/convex";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { proofVerdict } from "./lib/decisionState";
import { boundedText, normalizeEmail } from "./lib/validation";
import { requireUserId } from "./model/auth";
import schema from "./schema";

declare const process: { env: Record<string, string | undefined> };

const agentmail: AgentMail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.confirmations.onMessageReceived,
  onEvent: internal.confirmations.onAgentMailEvent,
});

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function addressEmail(value: string) {
  const bracketed = value.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1];
  return (bracketed ?? value).trim().toLowerCase();
}

function eventPayload(event: AgentMailEvent) {
  return asRecord(
    event.message ??
      event.send ??
      event.delivery ??
      event.bounce ??
      event.complaint ??
      event.reject,
  );
}

function statusFromEvent(eventType: AgentMailEvent["event_type"]) {
  switch (eventType) {
    case "message.sent":
      return "sent" as const;
    case "message.delivered":
      return "delivered" as const;
    case "message.bounced":
      return "bounced" as const;
    case "message.complained":
      return "complained" as const;
    case "message.rejected":
      return "rejected" as const;
    case "message.received":
    case "domain.verified":
      return null;
  }
}

async function applyStatus(
  ctx: MutationCtx,
  requestId: Id<"confirmationRequests">,
  status: "pending" | "sent" | "failed" | "delivered" | "bounced" | "complained" | "rejected",
  threadId?: string,
  messageId?: string,
  errorMessage?: string,
) {
  const request = await ctx.db.get("confirmationRequests", requestId);
  if (request === null) return;
  const decision = await ctx.db.get("decisions", request.decisionId);
  if (decision === null) return;
  const now = Date.now();
  await ctx.db.patch("confirmationRequests", request._id, {
    status,
    ...(threadId ? { threadId } : {}),
    ...(messageId ? { messageId } : {}),
    ...(status === "delivered" ? { deliveredAt: now } : {}),
    updatedAt: now,
  });
  if (status === "sent" || status === "delivered") {
    if (decision.status !== "waiting" && decision.status !== "reply_received") {
      await ctx.db.patch("decisions", decision._id, {
        status: "waiting",
        operationalFailure: undefined,
        operationalMessage: undefined,
        updatedAt: now,
      });
      await ctx.db.insert("decisionEvents", {
        decisionId: decision._id,
        fromStatus: decision.status,
        toStatus: "waiting",
        label: "Written request sent — waiting for a real reply",
        occurredAt: now,
      });
    }
    return;
  }
  if (["failed", "bounced", "complained", "rejected"].includes(status)) {
    await ctx.db.patch("decisions", decision._id, {
      operationalFailure: "delivery_failed",
      operationalMessage: (errorMessage || "The confirmation email was not delivered. Review the recipient and try again.").slice(0, 500),
      updatedAt: now,
    });
  }
}

async function requireOwnedRequest(
  ctx: MutationCtx,
  requestId: Id<"confirmationRequests">,
) {
  const ownerId = await requireUserId(ctx);
  const request = await ctx.db.get("confirmationRequests", requestId);
  if (request === null) throw new Error("404: confirmation request not found");
  if (request.ownerId !== ownerId) throw new Error("403: confirmation request is private");
  return request;
}

export const saveDraft = mutation({
  args: {
    requestId: v.id("confirmationRequests"),
    recipient: v.string(),
    contactId: v.optional(v.id("officialContacts")),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const request = await requireOwnedRequest(ctx, args.requestId);
    if (!["draft", "failed", "bounced", "complained", "rejected"].includes(request.status)) {
      throw new Error("A sent request cannot be edited");
    }
    const recipient = normalizeEmail(args.recipient);
    const subject = boundedText(args.subject, 220, "Subject");
    const body = boundedText(args.body, 8_000, "Message");
    let recipientSource: "official_page" | "user_provided" = "user_provided";
    let recipientSourceUrl: string | undefined;
    if (args.contactId !== undefined) {
      const contact = await ctx.db.get("officialContacts", args.contactId);
      if (
        contact === null ||
        contact.decisionId !== request.decisionId ||
        contact.email !== recipient
      ) {
        throw new Error("Choose a verified official contact or enter the address yourself");
      }
      recipientSource = "official_page";
      recipientSourceUrl = contact.sourceUrl;
    }
    await ctx.db.patch("confirmationRequests", request._id, {
      recipient,
      recipientSource,
      ...(recipientSourceUrl ? { recipientSourceUrl } : { recipientSourceUrl: undefined }),
      subject,
      body,
      status: "draft",
      outboundId: undefined,
      threadId: undefined,
      messageId: undefined,
      updatedAt: Date.now(),
    });
    const decision = await ctx.db.get("decisions", request.decisionId);
    if (decision !== null) {
      await ctx.db.patch("decisions", decision._id, {
        status: "awaiting_approval",
        operationalFailure: undefined,
        operationalMessage: undefined,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const approveAndSend = mutation({
  args: {
    requestId: v.id("confirmationRequests"),
    approvedExactRecipientAndMessage: v.literal(true),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const request = await requireOwnedRequest(ctx, args.requestId);
    if (request.status !== "draft") throw new Error("Review the draft before sending");
    if (!request.recipient) throw new Error("Choose or enter the official recipient");
    const decision = await ctx.db.get("decisions", request.decisionId);
    if (decision === null) throw new Error("404: decision not found");
    if (decision.status !== "awaiting_approval") {
      throw new Error("This decision is not waiting for send approval");
    }
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    if (!inboxId) throw new Error("AgentMail is not configured for this deployment");
    const outboundId: OutboundId = await agentmail.sendMessage(ctx, inboxId, {
      to: request.recipient,
      subject: request.subject,
      text: request.body,
      labels: ["get-it-in-writing", request.requestToken.toLowerCase()],
      headers: { "X-Get-It-In-Writing-Request": request.requestToken },
    });
    const now = Date.now();
    await ctx.db.patch("confirmationRequests", request._id, {
      status: "pending",
      outboundId,
      approvedAt: now,
      sentAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("decisions", decision._id, {
      status: "sending",
      operationalFailure: undefined,
      operationalMessage: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("decisionEvents", {
      decisionId: decision._id,
      fromStatus: decision.status,
      toStatus: "sending",
      label: `You approved the exact request to ${request.recipient}`,
      occurredAt: now,
    });
    await ctx.scheduler.runAfter(3_000, internal.confirmations.reconcileOutbound, {
      requestId: request._id,
      attempt: 0,
    });
    return outboundId;
  },
});

export const sendStatus = query({
  args: { requestId: v.id("confirmationRequests") },
  returns: v.union(
    v.null(),
    v.object({
      status: vOutboundStatus,
      agentmailMessageId: v.union(v.null(), v.string()),
      threadId: v.union(v.null(), v.string()),
      errorMessage: v.union(v.null(), v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const request = await ctx.db.get("confirmationRequests", args.requestId);
    if (request === null || request.ownerId !== ownerId || !request.outboundId) return null;
    return await agentmail.status(ctx, request.outboundId as OutboundId);
  },
});

export const getOutboundContext = internalQuery({
  args: { requestId: v.id("confirmationRequests") },
  returns: v.union(
    v.null(),
    v.object({
      request: schema.doc("confirmationRequests"),
      decision: schema.doc("decisions"),
    }),
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db.get("confirmationRequests", args.requestId);
    if (request === null) return null;
    const decision = await ctx.db.get("decisions", request.decisionId);
    return decision === null ? null : { request, decision };
  },
});

export const reconcileOutbound = internalAction({
  args: { requestId: v.id("confirmationRequests"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.attempt) || args.attempt < 0 || args.attempt > 8) return null;
    const context = await ctx.runQuery(internal.confirmations.getOutboundContext, {
      requestId: args.requestId,
    });
    if (context === null || !context.request.outboundId) return null;
    const status = await agentmail.status(
      ctx as unknown as Parameters<AgentMail["status"]>[0],
      context.request.outboundId as OutboundId,
    );
    if (status === null) return null;
    await ctx.runMutation(internal.confirmations.applyOutboundStatus, {
      requestId: args.requestId,
      status: status.status,
      ...(status.threadId ? { threadId: status.threadId } : {}),
      ...(status.agentmailMessageId ? { messageId: status.agentmailMessageId } : {}),
      ...(status.errorMessage ? { errorMessage: status.errorMessage } : {}),
    });
    if (status.status === "pending" && args.attempt < 8) {
      await ctx.scheduler.runAfter(Math.min(60_000, 4_000 * 2 ** args.attempt), internal.confirmations.reconcileOutbound, {
        requestId: args.requestId,
        attempt: args.attempt + 1,
      });
    }
    return null;
  },
});

export const applyOutboundStatus = internalMutation({
  args: {
    requestId: v.id("confirmationRequests"),
    status: vOutboundStatus,
    threadId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await applyStatus(ctx, args.requestId, args.status, args.threadId, args.messageId, args.errorMessage);
    return null;
  },
});

export const onAgentMailEvent = internalMutation({
  args: { event: vEvent },
  returns: v.null(),
  handler: async (ctx, args) => {
    const status = statusFromEvent(args.event.event_type);
    if (status === null) return null;
    const payload = eventPayload(args.event);
    const threadId = stringField(payload, "thread_id");
    const messageId = stringField(payload, "message_id");
    const request = threadId
      ? await ctx.db
          .query("confirmationRequests")
          .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
          .unique()
      : messageId
        ? await ctx.db
            .query("confirmationRequests")
            .withIndex("by_messageId", (q) => q.eq("messageId", messageId))
            .unique()
        : null;
    if (request !== null) await applyStatus(ctx, request._id, status, threadId, messageId);
    return null;
  },
});

export const onMessageReceived = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = asRecord(args.message);
    const inboxId = stringField(message, "inbox_id");
    const configuredInbox = process.env.AGENTMAIL_INBOX_ID;
    if (!configuredInbox || inboxId !== configuredInbox) return null;
    const threadId = stringField(message, "thread_id");
    const messageId = stringField(message, "message_id");
    const sender = stringField(message, "from");
    if (!threadId || !messageId || !sender) return null;
    const prior = await ctx.db
      .query("confirmationReplies")
      .withIndex("by_messageId", (q) => q.eq("messageId", messageId))
      .unique();
    if (prior !== null) return null;
    const subject = (stringField(message, "subject") ?? "").slice(0, 500);
    const body = (
      stringField(message, "extracted_text") ??
      stringField(message, "text") ??
      stringField(message, "preview") ??
      ""
    ).slice(0, 20_000);
    let request = await ctx.db
      .query("confirmationRequests")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .unique();
    if (request === null) {
      const token = `${subject}\n${body}`.match(/GIW-[A-Z0-9]{10}/i)?.[0]?.toUpperCase();
      request = token
        ? await ctx.db
            .query("confirmationRequests")
            .withIndex("by_requestToken", (q) => q.eq("requestToken", token))
            .unique()
        : null;
    }
    if (request === null) return null;
    if (
      request.recipient !== undefined &&
      addressEmail(sender) !== request.recipient.toLowerCase()
    ) {
      return null;
    }
    const decision = await ctx.db.get("decisions", request.decisionId);
    if (decision === null) return null;
    const receivedAtRaw = stringField(message, "timestamp") ?? stringField(message, "created_at");
    const receivedAt = receivedAtRaw ? Date.parse(receivedAtRaw) : Date.now();
    const safeReceivedAt = Number.isFinite(receivedAt) ? receivedAt : Date.now();
    const replyId = await ctx.db.insert("confirmationReplies", {
      decisionId: decision._id,
      requestId: request._id,
      messageId,
      threadId,
      sender: sender.slice(0, 500),
      subject,
      body,
      receivedAt: safeReceivedAt,
      createdAt: Date.now(),
    });
    await ctx.db.patch("confirmationRequests", request._id, { threadId, status: "delivered", updatedAt: Date.now() });
    await ctx.db.patch("decisions", decision._id, {
      status: "reply_received",
      operationalFailure: undefined,
      operationalMessage: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("decisionEvents", {
      decisionId: decision._id,
      fromStatus: decision.status,
      toStatus: "reply_received",
      label: "A real written reply arrived",
      occurredAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.confirmationOpenAI.interpret, { replyId });
    return null;
  },
});

export const getReplyContext = internalQuery({
  args: { replyId: v.id("confirmationReplies") },
  returns: v.union(
    v.null(),
    v.object({
      decision: schema.doc("decisions"),
      request: schema.doc("confirmationRequests"),
      reply: schema.doc("confirmationReplies"),
      assessments: v.array(schema.doc("claimAssessments")),
    }),
  ),
  handler: async (ctx, args) => {
    const reply = await ctx.db.get("confirmationReplies", args.replyId);
    if (reply === null) return null;
    const request = await ctx.db.get("confirmationRequests", reply.requestId);
    const decision = await ctx.db.get("decisions", reply.decisionId);
    if (request === null || decision === null) return null;
    const assessments = await ctx.db
      .query("claimAssessments")
      .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
      .take(50);
    return { decision, request, reply, assessments };
  },
});

export const markInterpretingReply = internalMutation({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    await ctx.db.patch("decisions", decision._id, { status: "interpreting_reply", updatedAt: Date.now() });
    await ctx.db.insert("decisionEvents", {
      decisionId: decision._id,
      fromStatus: decision.status,
      toStatus: "interpreting_reply",
      label: "Reply scope being interpreted",
      occurredAt: Date.now(),
    });
    return null;
  },
});

export const storeReplyInterpretation = internalMutation({
  args: {
    replyId: v.id("confirmationReplies"),
    verdict: proofVerdict,
    summary: v.string(),
    conditions: v.array(v.string()),
    supportingQuote: v.optional(v.string()),
    suggestedFollowUp: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reply = await ctx.db.get("confirmationReplies", args.replyId);
    if (reply === null) return null;
    const request = await ctx.db.get("confirmationRequests", reply.requestId);
    const decision = await ctx.db.get("decisions", reply.decisionId);
    if (request === null || decision === null) return null;
    const assessments = await ctx.db
      .query("claimAssessments")
      .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
      .take(50);
    const sourceUrls = [...new Set([decision.sourceUrl, ...assessments.flatMap((item) => (item.sourceUrl ? [item.sourceUrl] : []))])].slice(0, 8);
    const sourceExcerpts = [
      ...assessments.flatMap((item) => (item.sourceExcerpt ? [item.sourceExcerpt] : [])),
      ...(args.supportingQuote ? [args.supportingQuote] : []),
    ].slice(0, 8);
    const oldCards = await ctx.db
      .query("proofCards")
      .withIndex("by_decisionId", (q) => q.eq("decisionId", decision._id))
      .take(5);
    for (const card of oldCards) await ctx.db.delete("proofCards", card._id);
    await ctx.db.insert("proofCards", {
      decisionId: decision._id,
      ownerId: decision.ownerId,
      basis: "written_reply",
      verdict: args.verdict,
      exactRequirement: decision.requirementText,
      summary: args.summary.slice(0, 1_000),
      conditions: args.conditions.map((item) => item.slice(0, 500)).slice(0, 10),
      sourceUrls,
      sourceExcerpts,
      writtenMessage: reply.body,
      ...(args.suggestedFollowUp ? { suggestedFollowUp: args.suggestedFollowUp.slice(0, 1_000) } : {}),
      ...(request.recipient ? { recipient: request.recipient } : {}),
      ...(request.sentAt ? { sentAt: request.sentAt } : {}),
      receivedAt: reply.receivedAt,
      createdAt: Date.now(),
    });
    await ctx.db.patch("decisions", decision._id, {
      status: args.verdict,
      operationalFailure: undefined,
      operationalMessage: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("decisionEvents", {
      decisionId: decision._id,
      fromStatus: "interpreting_reply",
      toStatus: args.verdict,
      label: "Private Proof Card preserved",
      occurredAt: Date.now(),
    });
    return null;
  },
});
