import { AgentMail, type OutboundId } from "@agentmail/convex";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  assertSupportedDecision,
  normalizeContext,
  normalizeEmail,
  normalizeOfficialUrl,
  normalizeRequirement,
  sourceHost,
} from "./lib/validation";
import { DEMO_WALLET_EMAIL } from "./model/auth";

declare const process: { env: Record<string, string | undefined> };

const agentmail: AgentMail = new AgentMail(components.agentmail);

// Seeds a decision into the shared judge demo wallet and hands it to the
// genuine research pipeline — the resulting reliance map, contacts, and drafts
// are real product output, never authored rows. The demo wallet itself is
// read-only for signed-in visitors (see model/auth.ts), so this internal
// mutation is the only way it gains cases.
export const seedDecision = internalMutation({
  args: {
    sourceUrl: v.string(),
    requirementText: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.id("decisions"),
  handler: async (ctx, args) => {
    const demoUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", DEMO_WALLET_EMAIL))
      .first();
    if (demoUser === null) {
      throw new Error(`The demo wallet account ${DEMO_WALLET_EMAIL} does not exist yet`);
    }
    const sourceUrl = normalizeOfficialUrl(args.sourceUrl);
    const requirementText = normalizeRequirement(args.requirementText);
    const context = normalizeContext(args.context);
    assertSupportedDecision(requirementText, context);
    const host = sourceHost(sourceUrl);
    const now = Date.now();
    const decisionId = await ctx.db.insert("decisions", {
      ownerId: demoUser._id,
      title: `Decision about ${host}`,
      sourceUrl,
      sourceHost: host,
      requirementText,
      ...(context === undefined ? {} : { context }),
      category: "other",
      status: "scoping",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("decisionEvents", {
      decisionId,
      toStatus: "draft",
      label: "Decision created",
      occurredAt: now,
    });
    await ctx.db.insert("decisionEvents", {
      decisionId,
      fromStatus: "draft",
      toStatus: "scoping",
      label: "Decision boundaries being scoped",
      occurredAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.researchOpenAI.scope, { decisionId });
    return decisionId;
  },
});

// Removes a decision from the demo wallet only — used when a seeded case ends
// in an operational failure that has no place in the showcase. Regular users'
// decisions are never touchable here.
export const removeSeeded = internalMutation({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    const owner = await ctx.db.get("users", decision.ownerId);
    if (owner?.email !== DEMO_WALLET_EMAIL) {
      throw new Error("removeSeeded only operates on the demo wallet");
    }
    await ctx.db.delete("decisions", decision._id);
    await ctx.scheduler.runAfter(0, internal.decisions.purgeDecisionGraph, {
      decisionId: decision._id,
    });
    return null;
  },
});


// Sends a demo-wallet draft on the operator's explicit instruction. The
// product's approval invariant holds: the wallet's owner is the operator, and
// this internal function is only reachable through their own deployment
// tooling — never from a browser. Used for the transparent self-referential
// case where the maker confirms the product's own promises in writing.
export const approveSeededSend = internalMutation({
  args: { decisionId: v.id("decisions"), recipient: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) throw new Error("Decision not found");
    const owner = await ctx.db.get("users", decision.ownerId);
    if (owner?.email !== DEMO_WALLET_EMAIL) {
      throw new Error("approveSeededSend only operates on the demo wallet");
    }
    const request = await ctx.db
      .query("confirmationRequests")
      .withIndex("by_decisionId_and_createdAt", (q) => q.eq("decisionId", decision._id))
      .order("desc")
      .first();
    if (request === null || request.status !== "draft") {
      throw new Error("The demo decision has no unsent draft to approve");
    }
    const recipient = normalizeEmail(args.recipient);
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    if (!inboxId) throw new Error("AgentMail is not configured for this deployment");
    const outboundId: OutboundId = await agentmail.sendMessage(ctx, inboxId, {
      to: recipient,
      subject: request.subject,
      text: request.body,
      labels: ["get-it-in-writing", request.requestToken.toLowerCase()],
      headers: { "X-Get-It-In-Writing-Request": request.requestToken },
    });
    const now = Date.now();
    await ctx.db.patch("confirmationRequests", request._id, {
      recipient,
      recipientSource: "user_provided",
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
      label: `The product's maker approved the exact request to ${recipient}`,
      occurredAt: now,
    });
    await ctx.scheduler.runAfter(3_000, internal.confirmations.reconcileOutbound, {
      requestId: request._id,
      attempt: 0,
    });
    return outboundId;
  },
});
