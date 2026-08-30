"use node";

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { firecrawlRetryDelayMs } from "./lib/firecrawlRetry";
import type { StoredSource } from "./pipeline";

const crawlResponse = z.object({ success: z.boolean(), id: z.string() });
const crawlPage = z.object({
  markdown: z.string().optional(),
  metadata: z
    .object({
      sourceURL: z.string().optional(),
      url: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .passthrough()
    .optional(),
});
const crawlResult = z.object({
  success: z.boolean(),
  status: z.string().optional(),
  data: z.array(crawlPage).default([]),
});

const claimExtraction = z.object({
  claims: z
    .array(
      z.object({
        text: z.string(),
        summary: z.string(),
        topic: z.string(),
        status: z.enum(["supported", "disputed", "unresolved"]),
        confidence: z.number().min(0).max(1),
        quote: z.string(),
        support: z.enum(["supports", "challenges", "context"]),
      }),
    )
    .max(12),
});

const briefOutput = z.object({
  title: z.string(),
  summary: z.string(),
  body: z.string(),
});

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured for this deployment`);
  return value;
}

export const submitCrawl = internalAction({
  args: {
    missionId: v.id("missions"),
    seedId: v.id("missionSeeds"),
    url: v.string(),
    pageLimit: v.number(),
    depth: v.number(),
  },
  returns: v.union(
    v.object({ kind: v.literal("accepted"), crawlJobId: v.string() }),
    v.object({ kind: v.literal("retry"), retryAfterMs: v.number() }),
    v.object({ kind: v.literal("halted") }),
  ),
  handler: async (ctx, args) => {
    const mission = await ctx.runQuery(internal.pipeline.getSynthesisInput, {
      missionId: args.missionId,
    });
    if (["cancelled", "failed", "ready"].includes(mission.mission.status)) {
      return { kind: "halted" as const };
    }
    const apiKey = requiredEnv("FIRECRAWL_API_KEY");
    const webhookSecret = requiredEnv("FIRECRAWL_WEBHOOK_SECRET");
    const siteUrl = requiredEnv("CONVEX_SITE_URL");
    const response = await fetch("https://api.firecrawl.dev/v2/crawl", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: args.url,
        maxDiscoveryDepth: args.depth,
        sitemap: "skip",
        limit: Math.max(1, Math.min(50, Math.trunc(args.pageLimit))),
        maxConcurrency: 2,
        allowExternalLinks: false,
        allowSubdomains: false,
        ignoreRobotsTxt: false,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
          removeBase64Images: true,
          blockAds: true,
        },
        webhook: {
          url: `${siteUrl}/webhooks/firecrawl`,
          headers: { Authorization: `Bearer ${webhookSecret}` },
          metadata: { missionId: args.missionId, seedId: args.seedId },
        },
      }),
    });
    if (!response.ok) {
      const retryAfterMs = firecrawlRetryDelayMs(
        response.status,
        response.headers.get("retry-after"),
        0,
      );
      if (retryAfterMs !== null) {
        return { kind: "retry" as const, retryAfterMs };
      }
      throw new Error(`Firecrawl rejected the seed (${response.status})`);
    }
    const parsed = crawlResponse.parse(await response.json());
    if (!parsed.success) throw new Error("Firecrawl rejected the crawl request");
    await ctx.runMutation(internal.pipeline.markSeedStarted, {
      seedId: args.seedId,
      crawlJobId: parsed.id,
    });
    return { kind: "accepted" as const, crawlJobId: parsed.id };
  },
});

async function extractClaims(
  openai: OpenAI,
  question: string,
  page: z.infer<typeof crawlPage>,
) {
  const content = page.markdown?.slice(0, 90_000) ?? "";
  if (content.length < 80) return [];
  const response = await openai.responses.parse({
    model: process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-5.6-luna",
    input: [
      {
        role: "system",
        content:
          "Extract only claims explicitly supported by the supplied source. Quotes must be exact substrings. Mark uncertainty rather than inferring facts. Return at most 12 concise claims.",
      },
      {
        role: "user",
        content: `Research question: ${question}\n\nSOURCE:\n${content}`,
      },
    ],
    text: { format: zodTextFormat(claimExtraction, "claim_extraction") },
  });
  return response.output_parsed?.claims ?? [];
}

export const processCrawlJob = internalAction({
  args: {
    missionId: v.id("missions"),
    seedId: v.id("missionSeeds"),
    crawlJobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let failureStage: "crawl" | "synthesis" = "crawl";
    try {
      const firecrawlKey = requiredEnv("FIRECRAWL_API_KEY");
      const openai = new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
      const input = await ctx.runQuery(internal.pipeline.getSynthesisInput, {
        missionId: args.missionId,
      });
      if (input.mission.status === "cancelled") return null;
      const response = await fetch(
        `https://api.firecrawl.dev/v2/crawl/${encodeURIComponent(args.crawlJobId)}`,
        {
          headers: { Authorization: `Bearer ${firecrawlKey}` },
        },
      );
      if (!response.ok)
        throw new Error(
          `Firecrawl result retrieval failed (${response.status})`,
        );
      const result = crawlResult.parse(await response.json());
      if (!result.success)
        throw new Error("Firecrawl returned an unsuccessful result");
      const sources: StoredSource[] = [];
      for (const page of result.data.slice(0, 50)) {
        const content = page.markdown?.slice(0, 180_000) ?? "";
        const url = page.metadata?.sourceURL ?? page.metadata?.url;
        if (!url || content.length < 80) continue;
        const claims = await extractClaims(
          openai,
          input.mission.question,
          page,
        );
        sources.push({
          url,
          title: page.metadata?.title?.slice(0, 240) || new URL(url).hostname,
          excerpt: (
            page.metadata?.description || content.replace(/\s+/g, " ")
          ).slice(0, 320),
          content,
          sourceHash: createHash("sha256")
            .update(url)
            .update("\0")
            .update(content)
            .digest("hex"),
          claims,
        });
      }
      const stored = await ctx.runMutation(
        internal.pipeline.storeProcessedSources,
        {
          missionId: args.missionId,
          seedId: args.seedId,
          crawlJobId: args.crawlJobId,
          sources,
        },
      );
      if (!stored.accepted) return null;
      const synthesisOwner = await ctx.runMutation(
        internal.pipeline.claimSynthesis,
        { missionId: args.missionId },
      );
      if (!synthesisOwner) return null;
      failureStage = "synthesis";

      const updated = await ctx.runQuery(internal.pipeline.getSynthesisInput, {
        missionId: args.missionId,
      });
      if (updated.mission.status !== "synthesizing") return null;
      const citationInput = updated.claims.map(
        (claim: {
          _id: string;
          text: string;
          status: string;
          confidence: number;
        }) => ({
          id: claim._id,
          text: claim.text,
          status: claim.status,
          confidence: claim.confidence,
        }),
      );
      const synthesis = await openai.responses.parse({
        model: process.env.OPENAI_SYNTHESIS_MODEL ?? "gpt-5.6-terra",
        input: [
          {
            role: "system",
            content:
              "Write a decision-ready research brief from only the supplied claims. Cite claim IDs in square brackets. Surface disputes and unknowns. Do not add outside facts.",
          },
          {
            role: "user",
            content: `Question: ${updated.mission.question}\n\nClaims:\n${JSON.stringify(citationInput)}`,
          },
        ],
        text: { format: zodTextFormat(briefOutput, "research_brief") },
      });
      const brief = synthesis.output_parsed;
      if (!brief) throw new Error("OpenAI did not return a structured brief");
      await ctx.runMutation(internal.pipeline.storeBrief, {
        missionId: args.missionId,
        ...brief,
      });
      return null;
    } catch (error) {
      await ctx.runMutation(internal.pipeline.markFailed, {
        missionId: args.missionId,
        ...(failureStage === "crawl"
          ? { seedId: args.seedId, crawlJobId: args.crawlJobId }
          : {}),
        error:
          error instanceof Error ? error.message : "Mission processing failed",
      });
      return null;
    }
  },
});
