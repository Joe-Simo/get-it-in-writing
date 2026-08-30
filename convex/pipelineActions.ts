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
  links: z.array(z.string()).optional(),
  metadata: z
    .object({
      sourceURL: z.string().optional(),
      url: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      contentType: z.string().optional(),
    })
    .passthrough()
    .optional(),
});
const crawlResult = z.object({
  success: z.boolean(),
  status: z.string().optional(),
  data: z.array(crawlPage).default([]),
});

const scrapeResult = z.object({
  success: z.boolean().optional(),
  data: crawlPage,
});

function documentKind(url: string, seedUrl: string) {
  if (url === seedUrl) return "notice" as const;
  if (/amend(ment)?|sf[-_ ]?30/i.test(url)) return "amendment" as const;
  if (/\.(pdf|docx?|xlsx?|rtf|txt|csv)(?:$|[?#])/i.test(url)) {
    return "attachment" as const;
  }
  return "reference" as const;
}

function isPublicDocumentUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      /\.(pdf|docx?|xlsx?|rtf|txt|csv)(?:$|[?#])/i.test(url.href)
    );
  } catch {
    return false;
  }
}

async function scrapeDocument(apiKey: string, url: string) {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links"],
      parsers: ["pdf"],
      pdfOptions: { maxPages: 200 },
      onlyMainContent: true,
      removeBase64Images: true,
      blockAds: true,
    }),
  });
  if (!response.ok) return null;
  const parsed = scrapeResult.safeParse(await response.json());
  return parsed.success ? parsed.data.data : null;
}

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
        requirement: z
          .object({
            category: z.enum([
              "submission",
              "bonding",
              "insurance",
              "eligibility",
              "labor",
              "safety",
              "schedule",
              "technical",
              "pricing",
              "other",
            ]),
            criticality: z.enum(["disqualifier", "high", "standard"]),
            requiredWithBid: z.boolean(),
            dueDateText: z.string().nullable(),
          })
          .nullable(),
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
          formats: ["markdown", "links"],
          parsers: ["pdf"],
          pdfOptions: { maxPages: 200 },
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
    if (!parsed.success)
      throw new Error("Firecrawl rejected the crawl request");
    await ctx.runMutation(internal.pipeline.markSeedStarted, {
      seedId: args.seedId,
      crawlJobId: parsed.id,
    });
    return { kind: "accepted" as const, crawlJobId: parsed.id };
  },
});

async function extractClaims(
  openai: OpenAI,
  mission: {
    question: string;
    workflowKind?: "research" | "prebid";
    opportunityTitle?: string;
    solicitationUrl?: string;
    solicitationNumber?: string;
    agency?: string;
  },
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
          "Extract only claims explicitly supported by the supplied source. Quotes must be exact substrings. Mark uncertainty rather than inferring facts. For a pre-bid workspace, set requirement only when the source explicitly states an obligation, submission item, deadline, eligibility condition, bond, insurance, labor, safety, technical, schedule, or pricing instruction relevant to bidding. A disqualifier is something the source says can make the bid late, nonresponsive, ineligible, or rejected; do not infer that severity. requiredWithBid is true only when the item must accompany the bid. Preserve any due date as source text instead of normalizing it. Return at most 12 concise claims.",
      },
      {
        role: "user",
        content: `Workflow: ${mission.workflowKind ?? "research"}\nOpportunity: ${mission.opportunityTitle ?? "Not specified"}\nSolicitation: ${mission.solicitationNumber ?? "Not specified"}\nAgency: ${mission.agency ?? "Not specified"}\nPrimary solicitation URL: ${mission.solicitationUrl ?? "Not specified"}\nResearch question: ${mission.question}\nSource URL: ${page.metadata?.sourceURL ?? page.metadata?.url ?? "Unknown"}\n\nSOURCE:\n${content}`,
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
      const seed = await ctx.runQuery(internal.pipeline.getCrawlSeed, {
        missionId: args.missionId,
        seedId: args.seedId,
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
      const primaryPages = result.data.slice(0, seed.pageLimit);
      const documentUrls = [
        ...new Set(
          primaryPages
            .flatMap((page) => page.links ?? [])
            .filter(isPublicDocumentUrl),
        ),
      ].slice(0, Math.max(0, seed.pageLimit - primaryPages.length));
      const documents: Array<{ page: z.infer<typeof crawlPage>; parentUrl: string }> = [];
      for (const documentUrl of documentUrls) {
        const page = await scrapeDocument(firecrawlKey, documentUrl);
        if (page !== null) documents.push({ page, parentUrl: seed.url });
      }
      const pages = [
        ...primaryPages.map((page) => ({ page, parentUrl: undefined })),
        ...documents,
      ];
      for (const { page, parentUrl } of pages) {
        const content = page.markdown?.slice(0, 180_000) ?? "";
        const url = page.metadata?.sourceURL ?? page.metadata?.url;
        if (!url || content.length < 80) continue;
        const claims = await extractClaims(openai, input.mission, page);
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
          kind: documentKind(url, seed.url),
          ...(page.metadata?.contentType === undefined
            ? {}
            : { contentType: page.metadata.contentType }),
          ...(!/\.(pdf|docx?|xlsx?|rtf|txt|csv)(?:$|[?#])/i.test(url)
            ? {}
            : { fileName: decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "Attachment") }),
          ...(parentUrl === undefined ? {} : { parentUrl }),
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
              "Write a decision-ready pre-bid brief from only the supplied claims and extracted requirements. Cite claim IDs in square brackets. Lead with a bid/no-bid readiness assessment, list disqualifiers and required-with-bid items, then surface unresolved facts that prevent a defensible decision. Do not make the final human bid/no-bid decision and do not add outside facts.",
          },
          {
            role: "user",
            content: `Opportunity: ${updated.mission.opportunityTitle ?? "Not specified"}\nAgency: ${updated.mission.agency ?? "Not specified"}\nSolicitation: ${updated.mission.solicitationNumber ?? "Not specified"}\nQuestion: ${updated.mission.question}\n\nClaims:\n${JSON.stringify(citationInput)}\n\nExtracted requirements:\n${JSON.stringify(updated.requirements)}`,
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
