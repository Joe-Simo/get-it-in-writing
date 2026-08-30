import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation } from "./_generated/server";

const firecrawl = new FirecrawlClient(components.firecrawl);

export const start = internalAction({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context: {
      decision: Doc<"decisions">;
      requirements: Doc<"decisionRequirements">[];
    } | null = await ctx.runQuery(internal.decisions.getForResearch, args);
    if (context === null) return null;
    await ctx.runMutation(internal.decisions.markResearching, args);
    try {
      const requirement = context.requirements.map((item) => item.text).join("; ");
      const result = await firecrawl.startCrawl(ctx, {
        url: context.decision.sourceUrl,
        mode: "webhook",
        storeContent: true,
        options: {
          prompt: `Find only official pages on this site that can establish or limit this requirement, plus an official contact page: ${requirement}`,
          limit: 12,
          maxDiscoveryDepth: 2,
          sitemap: "include",
          deduplicateSimilarURLs: true,
          allowExternalLinks: false,
          allowSubdomains: false,
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
            maxAge: 0,
            removeBase64Images: true,
          },
        },
        onComplete: internal.research.onCrawlComplete,
        context: { decisionId: args.decisionId },
      });
      await ctx.runMutation(internal.decisions.attachCrawl, {
        decisionId: args.decisionId,
        crawlId: result.crawlId,
      });
    } catch (error) {
      console.error(
        "Get It in Writing research start failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      await ctx.runMutation(internal.decisions.recordOperationalFailure, {
        decisionId: args.decisionId,
        kind: "research_failed",
        message: "The official pages could not be read. Nothing was sent. Try the research again.",
      });
    }
    return null;
  },
});

export const onCrawlComplete = internalMutation({
  args: {
    crawlId: v.string(),
    jobId: v.optional(v.string()),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
    pageCount: v.number(),
    unstored: v.optional(v.number()),
    error: v.optional(v.string()),
    context: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rawContext = args.context;
    if (typeof rawContext !== "object" || rawContext === null) return null;
    const rawDecisionId = (rawContext as Record<string, unknown>).decisionId;
    if (typeof rawDecisionId !== "string") return null;
    const decisionId = ctx.db.normalizeId("decisions", rawDecisionId);
    if (decisionId === null) return null;
    if (args.status !== "completed" || args.pageCount < 1) {
      await ctx.runMutation(internal.decisions.recordOperationalFailure, {
        decisionId,
        kind: "research_failed",
        message: "The official-site research did not complete. Nothing was sent. You can retry safely.",
      });
      return null;
    }
    await ctx.runMutation(internal.decisions.markAnalyzing, {
      decisionId,
    });
    await ctx.scheduler.runAfter(0, internal.researchOpenAI.analyze, {
      decisionId,
      crawlId: args.crawlId,
    });
    return null;
  },
});
