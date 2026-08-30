import {
  AgentMail,
  type AgentMailEvent,
  type OutboundId,
  vEvent,
  vOutboundStatus,
} from "@agentmail/convex";
import { type Infer, v } from "convex/values";
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

type ProofVerdict = Infer<typeof proofVerdict>;

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

function replyOnly(value: string) {
  const boundaryPatterns = [
    /\nOn .{0,300}wrote:\s*\n/i,
    /\nFrom:\s*.{0,300}\nSent:\s*.{0,300}\n/i,
    /\n-{2,}\s*Original Message\s*-{2,}\s*\n/i,
  ];
  let body = value.replace(/\r\n/g, "\n");
  for (const pattern of boundaryPatterns) {
    const boundary = body.search(pattern);
    if (boundary >= 0) body = body.slice(0, boundary);
  }
  body = body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
  const signatureBoundary = body.search(/\n--\s*\n/);
  if (signatureBoundary >= 0) body = body.slice(0, signatureBoundary);
  return (body.trim() || value.trim()).slice(0, 20_000);
}

function overallVerdict(outcomes: Array<{ verdict: ProofVerdict }>): ProofVerdict {
  const verdicts = outcomes.map((outcome) => outcome.verdict);
  if (verdicts.length === 0 || verdicts.some((verdict) => verdict === "needs_followup")) {
    return "needs_followup";
  }
  if (verdicts.every((verdict) => verdict === "confirmed")) return "confirmed";
  if (verdicts.every((verdict) => verdict === "confirmed" || verdict === "confirmed_with_conditions")) {
    return "confirmed_with_conditions";
  }
  if (verdicts.every((verdict) => verdict === "not_confirmed")) return "not_confirmed";
  if (verdicts.every((verdict) => verdict === "declined")) return "declined";
  return "partially_confirmed";
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

export const ingestAgentMailEvent = internalMutation({
  args: { event: vEvent },
  returns: v.null(),
  handler: async (ctx, args) => {
    const prior = await ctx.db
      .query("webhookReceipts")
      .withIndex("by_provider_and_deliveryId", (q) =>
        q.eq("provider", "agentmail").eq("deliveryId", args.event.event_id),
      )
      .first();
    if (prior !== null) return null;
    await ctx.db.insert("webhookReceipts", {
      provider: "agentmail",
      deliveryId: args.event.event_id,
      status: "accepted",
      receivedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.confirmations.onAgentMailEvent, {
      event: args.event,
    });
    if (args.event.event_type === "message.received" && args.event.message) {
      await ctx.scheduler.runAfter(0, internal.confirmations.onMessageReceived, {
        message: args.event.message,
        thread: args.event.thread ?? {},
        eventId: args.event.event_id,
      });
    }
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
    const analysisBody = replyOnly(body);
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
      analysisBody,
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

export const monitoredReplyTargets = internalQuery({
  args: {},
  returns: v.array(v.object({
    threadId: v.optional(v.string()),
    requestToken: v.string(),
  })),
  handler: async (ctx) => {
    const groups = await Promise.all(
      (["pending", "sent", "delivered"] as const).map((status) =>
        ctx.db
          .query("confirmationRequests")
          .withIndex("by_status_and_createdAt", (q) => q.eq("status", status))
          .order("desc")
          .take(100),
      ),
    );
    return groups.flat().map((request) => ({
      ...(request.threadId ? { threadId: request.threadId } : {}),
      requestToken: request.requestToken,
    }));
  },
});

export const knownAgentMailDeliveries = internalQuery({
  args: { deliveryIds: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const known = await Promise.all(
      args.deliveryIds.slice(0, 100).map(async (deliveryId) => {
        const receipt = await ctx.db
          .query("webhookReceipts")
          .withIndex("by_provider_and_deliveryId", (q) =>
            q.eq("provider", "agentmail").eq("deliveryId", deliveryId),
          )
          .first();
        return receipt === null ? null : deliveryId;
      }),
    );
    return known.filter((deliveryId): deliveryId is string => deliveryId !== null);
  },
});

export const ingestPolledMessage = internalMutation({
  args: { message: v.any(), eventId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const prior = await ctx.db
      .query("webhookReceipts")
      .withIndex("by_provider_and_deliveryId", (q) =>
        q.eq("provider", "agentmail").eq("deliveryId", args.eventId),
      )
      .first();
    if (prior !== null) return false;
    await ctx.db.insert("webhookReceipts", {
      provider: "agentmail",
      deliveryId: args.eventId,
      status: "accepted",
      receivedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.confirmations.onMessageReceived, {
      message: args.message,
      thread: {},
      eventId: args.eventId,
    });
    return true;
  },
});

export const pollInbox = internalAction({
  args: {},
  returns: v.object({
    reachable: v.boolean(),
    scanned: v.number(),
    matched: v.number(),
  }),
  handler: async (ctx) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    if (!apiKey || !inboxId) return { reachable: false, scanned: 0, matched: 0 };
    const targets = await ctx.runQuery(internal.confirmations.monitoredReplyTargets, {});
    if (targets.length === 0) return { reachable: true, scanned: 0, matched: 0 };
    const threadIds = new Set(targets.flatMap((target) => target.threadId ? [target.threadId] : []));
    const requestTokens = new Set(targets.map((target) => target.requestToken));
    const baseUrl = (process.env.AGENTMAIL_BASE_URL ?? "https://api.agentmail.to/v0").replace(/\/$/, "");
    const authorization = { Authorization: `Bearer ${apiKey}` };
    const listResponse = await fetch(
      `${baseUrl}/inboxes/${encodeURIComponent(inboxId)}/messages?limit=100`,
      { headers: authorization },
    );
    if (!listResponse.ok) return { reachable: false, scanned: 0, matched: 0 };
    const payload = asRecord(await listResponse.json());
    const messages = Array.isArray(payload.messages) ? payload.messages.map(asRecord) : [];
    const candidates = messages.flatMap((summary) => {
      const threadId = stringField(summary, "thread_id");
      const messageId = stringField(summary, "message_id");
      const subject = stringField(summary, "subject") ?? "";
      const token = subject.match(/GIW-[A-Z0-9]{10}/i)?.[0]?.toUpperCase();
      if (!messageId || !(
        (threadId !== undefined && threadIds.has(threadId)) ||
        (token !== undefined && requestTokens.has(token))
      )) return [];
      return [{ messageId, eventId: `poll:${messageId}` }];
    });
    const known = new Set(await ctx.runQuery(internal.confirmations.knownAgentMailDeliveries, {
      deliveryIds: candidates.map((candidate) => candidate.eventId),
    }));
    let matched = 0;
    for (const candidate of candidates) {
      if (known.has(candidate.eventId)) continue;
      const detailResponse = await fetch(
        `${baseUrl}/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(candidate.messageId)}`,
        { headers: authorization },
      );
      if (!detailResponse.ok) continue;
      const accepted = await ctx.runMutation(internal.confirmations.ingestPolledMessage, {
        message: await detailResponse.json(),
        eventId: candidate.eventId,
      });
      if (accepted) matched += 1;
    }
    return { reachable: true, scanned: messages.length, matched };
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
      requirements: v.array(schema.doc("decisionRequirements")),
    }),
  ),
  handler: async (ctx, args) => {
    const reply = await ctx.db.get("confirmationReplies", args.replyId);
    if (reply === null) return null;
    const request = await ctx.db.get("confirmationRequests", reply.requestId);
    const decision = await ctx.db.get("decisions", reply.decisionId);
    if (request === null || decision === null) return null;
    const [assessments, requirements] = await Promise.all([
      ctx.db
        .query("claimAssessments")
        .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
        .take(50),
      ctx.db
        .query("decisionRequirements")
        .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
        .take(20),
    ]);
    return { decision, request, reply, assessments, requirements };
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
    outcomes: v.array(
      v.object({
        requirementId: v.id("decisionRequirements"),
        verdict: proofVerdict,
        summary: v.string(),
        conditions: v.array(v.string()),
        supportingQuote: v.optional(v.string()),
      }),
    ),
    summary: v.string(),
    suggestedFollowUp: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reply = await ctx.db.get("confirmationReplies", args.replyId);
    if (reply === null) return null;
    const request = await ctx.db.get("confirmationRequests", reply.requestId);
    const decision = await ctx.db.get("decisions", reply.decisionId);
    if (request === null || decision === null) return null;
    const [assessments, requirements] = await Promise.all([
      ctx.db
        .query("claimAssessments")
        .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
        .take(50),
      ctx.db
        .query("decisionRequirements")
        .withIndex("by_decisionId_and_order", (q) => q.eq("decisionId", decision._id))
        .take(20),
    ]);
    const requirementIds = new Set(requirements.map((requirement) => requirement._id));
    const uniqueOutcomes = new Map(
      args.outcomes
        .filter((outcome) => requirementIds.has(outcome.requirementId))
        .map((outcome) => [outcome.requirementId, outcome]),
    );
    if (uniqueOutcomes.size !== requirements.length) {
      throw new Error("Every scoped requirement must receive one reply outcome");
    }
    const orderedOutcomes = requirements.map((requirement) => uniqueOutcomes.get(requirement._id)!);
    const verdict = overallVerdict(orderedOutcomes);
    const sourceUrls = [...new Set([
      decision.sourceUrl,
      ...assessments.flatMap((item) => (item.sourceUrl ? [item.sourceUrl] : [])),
    ])].slice(0, 8);
    const sourceExcerpts = [
      ...assessments.flatMap((item) => (item.sourceExcerpt ? [item.sourceExcerpt] : [])),
      ...orderedOutcomes.flatMap((item) => (item.supportingQuote ? [item.supportingQuote] : [])),
    ].slice(0, 12);
    const oldOutcomes = await ctx.db
      .query("confirmationOutcomes")
      .withIndex("by_replyId", (q) => q.eq("replyId", reply._id))
      .take(20);
    for (const outcome of oldOutcomes) await ctx.db.delete("confirmationOutcomes", outcome._id);
    const now = Date.now();
    for (const outcome of orderedOutcomes) {
      await ctx.db.insert("confirmationOutcomes", {
        decisionId: decision._id,
        requestId: request._id,
        replyId: reply._id,
        requirementId: outcome.requirementId,
        verdict: outcome.verdict,
        summary: outcome.summary.slice(0, 1_000),
        conditions: outcome.conditions.map((item) => item.slice(0, 500)).slice(0, 10),
        ...(outcome.supportingQuote ? { supportingQuote: outcome.supportingQuote.slice(0, 900) } : {}),
        createdAt: now,
      });
    }
    const oldCards = await ctx.db
      .query("proofCards")
      .withIndex("by_decisionId", (q) => q.eq("decisionId", decision._id))
      .take(10);
    for (const card of oldCards) {
      const oldItems = await ctx.db
        .query("proofItems")
        .withIndex("by_proofCardId_and_order", (q) => q.eq("proofCardId", card._id))
        .take(20);
      for (const item of oldItems) await ctx.db.delete("proofItems", item._id);
      await ctx.db.delete("proofCards", card._id);
    }
    const proofCardId = await ctx.db.insert("proofCards", {
      decisionId: decision._id,
      ownerId: decision.ownerId,
      basis: "written_reply",
      verdict,
      exactRequirement: decision.requirementText,
      summary: args.summary.slice(0, 1_000),
      conditions: [...new Set(orderedOutcomes.flatMap((item) => item.conditions))].slice(0, 20),
      sourceUrls,
      sourceExcerpts,
      writtenMessage: reply.body,
      ...(args.suggestedFollowUp ? { suggestedFollowUp: args.suggestedFollowUp.slice(0, 1_000) } : {}),
      ...(request.recipient ? { recipient: request.recipient } : {}),
      ...(request.sentAt ? { sentAt: request.sentAt } : {}),
      receivedAt: reply.receivedAt,
      createdAt: now,
    });
    const assessmentByRequirement = new Map(
      assessments.map((assessment) => [assessment.requirementId, assessment]),
    );
    for (const [order, requirement] of requirements.entries()) {
      const outcome = uniqueOutcomes.get(requirement._id)!;
      const assessment = assessmentByRequirement.get(requirement._id);
      await ctx.db.insert("proofItems", {
        proofCardId,
        decisionId: decision._id,
        requirementId: requirement._id,
        verdict: outcome.verdict,
        requirementText: requirement.text,
        summary: outcome.summary.slice(0, 1_000),
        conditions: outcome.conditions.map((item) => item.slice(0, 500)).slice(0, 10),
        sourceUrls: [...new Set([
          ...(assessment?.sourceUrl ? [assessment.sourceUrl] : []),
          decision.sourceUrl,
        ])].slice(0, 8),
        sourceExcerpts: [
          ...(assessment?.sourceExcerpt ? [assessment.sourceExcerpt] : []),
          ...(outcome.supportingQuote ? [outcome.supportingQuote] : []),
        ].slice(0, 8),
        order,
        createdAt: now,
      });
    }
    const monitor = await ctx.db
      .query("changeMonitors")
      .withIndex("by_decisionId", (q) => q.eq("decisionId", decision._id))
      .first();
    if (monitor === null) {
      await ctx.db.insert("changeMonitors", {
        decisionId: decision._id,
        ownerId: decision.ownerId,
        active: true,
        intervalHours: 24,
        nextCheckAt: now + 24 * 60 * 60 * 1_000,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch("decisions", decision._id, {
      status: verdict,
      operationalFailure: undefined,
      operationalMessage: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("decisionEvents", {
      decisionId: decision._id,
      fromStatus: "interpreting_reply",
      toStatus: verdict,
      label: "Private Proof Card preserved",
      occurredAt: now,
    });
    return null;
  },
});

export const createFollowUpDraft = mutation({
  args: { proofCardId: v.id("proofCards") },
  returns: v.id("confirmationRequests"),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const proofCard = await ctx.db.get("proofCards", args.proofCardId);
    if (proofCard === null || proofCard.ownerId !== ownerId) {
      throw new Error("404: Proof Card not found");
    }
    if (!proofCard.suggestedFollowUp) throw new Error("This reply does not need a follow-up");
    const decision = await ctx.db.get("decisions", proofCard.decisionId);
    if (decision === null || decision.ownerId !== ownerId) throw new Error("403: decision is private");
    const requests = await ctx.db
      .query("confirmationRequests")
      .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
      .order("desc")
      .take(10);
    if (requests.some((request) => request.followUpCount >= 1)) {
      throw new Error("The one permitted follow-up has already been prepared");
    }
    const prior = requests[0];
    if (!prior?.recipient) throw new Error("The original recipient is unavailable");
    const now = Date.now();
    const requestToken = `GIW-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const requestId = await ctx.db.insert("confirmationRequests", {
      decisionId: decision._id,
      ownerId,
      requestToken,
      recipient: prior.recipient,
      recipientSource: prior.recipientSource,
      ...(prior.recipientSourceUrl ? { recipientSourceUrl: prior.recipientSourceUrl } : {}),
      subject: `Follow-up: ${prior.subject.replace(/\s*\[GIW-[A-Z0-9]{10}\]\s*$/i, "").slice(0, 150)} [${requestToken}]`,
      body: proofCard.suggestedFollowUp.slice(0, 8_000),
      followUpCount: 1,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("decisions", decision._id, {
      status: "awaiting_approval",
      operationalFailure: undefined,
      operationalMessage: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("decisionEvents", {
      decisionId: decision._id,
      fromStatus: decision.status,
      toStatus: "awaiting_approval",
      label: "One follow-up drafted — waiting for your approval",
      occurredAt: now,
    });
    return requestId;
  },
});
