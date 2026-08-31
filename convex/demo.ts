import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  assertSupportedDecision,
  normalizeContext,
  normalizeOfficialUrl,
  normalizeRequirement,
  sourceHost,
} from "./lib/validation";
import { DEMO_WALLET_EMAIL } from "./model/auth";

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
