import { v } from "convex/values";
import { vResultValidator, vWorkflowId } from "@convex-dev/workflow";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { firecrawlRetryDelayMs } from "./lib/firecrawlRetry";
import { requireMissionMember } from "./model/auth";
import { missionWorkflowManager } from "./workflowManager";

const missionStatus = v.union(
  v.literal("draft"),
  v.literal("crawling"),
  v.literal("extracting"),
  v.literal("synthesizing"),
  v.literal("ready"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const missionWorkflow = missionWorkflowManager
  .define({
    args: { missionId: v.id("missions") },
    returns: v.null(),
  })
  .handler(async (step, args): Promise<null> => {
    const seeds = await step.runQuery(internal.pipeline.getMissionSeeds, args);
    for (const seed of seeds) {
      let accepted = false;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const result = await step.runAction(
          internal.pipelineActions.submitCrawl,
          {
            missionId: args.missionId,
            seedId: seed._id,
            url: seed.url,
            pageLimit: seed.pageLimit,
            depth: seed.depth,
          },
          { retry: false },
        );
        if (result.kind === "halted") return null;
        if (result.kind === "accepted") {
          accepted = true;
          break;
        }
        if (attempt === 7) break;
        const exponentialDelay = firecrawlRetryDelayMs(429, null, attempt);
        await step.sleep(Math.max(result.retryAfterMs, exponentialDelay ?? 0));
      }
      if (!accepted) {
        throw new Error(
          "Firecrawl remained rate-limited after bounded retries",
        );
      }
    }
    return null;
  });

export const start = mutation({
  args: { missionId: v.id("missions") },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const { mission } = await requireMissionMember(ctx, args.missionId);
    if (mission.status !== "draft" && mission.status !== "failed") {
      throw new Error("Only draft or failed missions can be started");
    }
    if (!process.env.OPENAI_API_KEY || !process.env.FIRECRAWL_API_KEY) {
      throw new Error(
        "Research providers are not configured. Connect OpenAI and Firecrawl before launch.",
      );
    }
    const seeds = await ctx.db
      .query("missionSeeds")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .take(8);
    await Promise.all(
      seeds.map((seed) =>
        ctx.db.patch("missionSeeds", seed._id, {
          status: "queued",
          submissionKey: undefined,
          crawlJobId: undefined,
          error: undefined,
        }),
      ),
    );
    const workflowId: string = await missionWorkflowManager.start(
      ctx,
      internal.pipeline.missionWorkflow,
      args,
      {
        startAsync: true,
        onComplete: internal.pipeline.handleWorkflowComplete,
        context: { missionId: args.missionId },
      },
    );
    const now = Date.now();
    await ctx.db.patch("missions", args.missionId, {
      status: "crawling",
      workflowId: String(workflowId),
      error: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "crawl",
      label: "Bounded crawl launched",
      detail: `${mission.pageBudget} page budget · depth ${mission.depth}`,
      createdAt: now,
    });
    return String(workflowId);
  },
});

export const getMissionSeeds = internalQuery({
  args: { missionId: v.id("missions") },
  returns: v.array(
    v.object({
      _id: v.id("missionSeeds"),
      url: v.string(),
      pageLimit: v.number(),
      depth: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (mission === null) throw new Error("Mission not found");
    const seeds = await ctx.db
      .query("missionSeeds")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .take(8);
    return seeds.map((seed) => ({
      _id: seed._id,
      url: seed.url,
      pageLimit: seed.pageLimit,
      depth: mission.depth,
    }));
  },
});

export const getCrawlSeed = internalQuery({
  args: { missionId: v.id("missions"), seedId: v.id("missionSeeds") },
  returns: v.object({ url: v.string(), pageLimit: v.number() }),
  handler: async (ctx, args) => {
    const seed = await ctx.db.get("missionSeeds", args.seedId);
    if (seed === null || seed.missionId !== args.missionId) {
      throw new Error("Crawl seed not found");
    }
    return { url: seed.url, pageLimit: seed.pageLimit };
  },
});

export const handleWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ missionId: v.id("missions") }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind !== "failed") return null;
    const mission = await ctx.db.get("missions", args.context.missionId);
    if (
      mission === null ||
      mission.workflowId !== String(args.workflowId) ||
      ["ready", "failed", "cancelled"].includes(mission.status)
    ) {
      return null;
    }
    const seeds = await ctx.db
      .query("missionSeeds")
      .withIndex("by_missionId", (q) =>
        q.eq("missionId", args.context.missionId),
      )
      .take(8);
    await Promise.all(
      seeds
        .filter((seed) => seed.status === "queued")
        .map((seed) =>
          ctx.db.patch("missionSeeds", seed._id, {
            status: "failed",
            error: "The research provider did not accept this crawl in time.",
          }),
        ),
    );
    const now = Date.now();
    await ctx.db.patch("missions", args.context.missionId, {
      status: "failed",
      error:
        "The research provider could not start every bounded crawl after retrying.",
      updatedAt: now,
    });
    await ctx.db.insert("missionEvents", {
      missionId: args.context.missionId,
      type: "crawl",
      label: "Crawl launch stopped safely",
      detail: "The provider limit persisted after bounded backoff retries.",
      createdAt: now,
    });
    return null;
  },
});

export const markSeedStarted = internalMutation({
  args: { seedId: v.id("missionSeeds"), crawlJobId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seed = await ctx.db.get("missionSeeds", args.seedId);
    if (seed === null) throw new Error("Seed not found");
    const mission = await ctx.db.get("missions", seed.missionId);
    if (
      mission === null ||
      !["crawling", "extracting"].includes(mission.status)
    )
      return null;
    await ctx.db.patch("missionSeeds", args.seedId, {
      status: "crawling",
      crawlJobId: args.crawlJobId,
    });
    await ctx.db.insert("missionEvents", {
      missionId: seed.missionId,
      type: "crawl",
      label: "Crawler accepted seed",
      detail: new URL(seed.url).hostname,
      createdAt: Date.now(),
    });
    return null;
  },
});

const extractedClaim = v.object({
  text: v.string(),
  summary: v.string(),
  topic: v.string(),
  status: v.union(
    v.literal("supported"),
    v.literal("disputed"),
    v.literal("unresolved"),
  ),
  confidence: v.number(),
  quote: v.string(),
  support: v.union(
    v.literal("supports"),
    v.literal("challenges"),
    v.literal("context"),
  ),
  requirement: v.union(
    v.null(),
    v.object({
      category: v.union(
        v.literal("submission"),
        v.literal("bonding"),
        v.literal("insurance"),
        v.literal("eligibility"),
        v.literal("labor"),
        v.literal("safety"),
        v.literal("schedule"),
        v.literal("technical"),
        v.literal("pricing"),
        v.literal("other"),
      ),
      criticality: v.union(
        v.literal("disqualifier"),
        v.literal("high"),
        v.literal("standard"),
      ),
      requiredWithBid: v.boolean(),
      dueDateText: v.union(v.null(), v.string()),
    }),
  ),
});

export const storeProcessedSources = internalMutation({
  args: {
    missionId: v.id("missions"),
    seedId: v.id("missionSeeds"),
    crawlJobId: v.string(),
    sources: v.array(
      v.object({
        url: v.string(),
        title: v.string(),
        excerpt: v.string(),
        content: v.string(),
        sourceHash: v.string(),
        kind: v.optional(
          v.union(
            v.literal("notice"),
            v.literal("attachment"),
            v.literal("amendment"),
            v.literal("reference"),
          ),
        ),
        fileName: v.optional(v.string()),
        contentType: v.optional(v.string()),
        parentUrl: v.optional(v.string()),
        claims: v.array(extractedClaim),
      }),
    ),
  },
  returns: v.object({
    accepted: v.boolean(),
    sourceCount: v.number(),
    claimCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const activeSeed = await ctx.db.get("missionSeeds", args.seedId);
    const activeMission = await ctx.db.get("missions", args.missionId);
    if (activeMission === null) throw new Error("Mission not found");
    if (
      activeSeed === null ||
      activeSeed.missionId !== args.missionId ||
      activeSeed.crawlJobId !== args.crawlJobId ||
      activeSeed.status !== "processing" ||
      !["crawling", "extracting", "failed"].includes(activeMission.status)
    ) {
      return { accepted: false, sourceCount: 0, claimCount: 0 };
    }
    let sourceCount = 0;
    let claimCount = 0;
    let requirementCount = 0;
    for (const source of args.sources.slice(0, 50)) {
      const existing = await ctx.db
        .query("sources")
        .withIndex("by_missionId_and_sourceHash", (q) =>
          q.eq("missionId", args.missionId).eq("sourceHash", source.sourceHash),
        )
        .unique();
      if (existing !== null) continue;
      const sourceId = await ctx.db.insert("sources", {
        missionId: args.missionId,
        url: source.url,
        title: source.title,
        excerpt: source.excerpt,
        content: source.content.slice(0, 180_000),
        sourceHash: source.sourceHash,
        kind: source.kind ?? "reference",
        ...(source.fileName === undefined
          ? {}
          : { fileName: source.fileName.slice(0, 240) }),
        ...(source.contentType === undefined
          ? {}
          : { contentType: source.contentType.slice(0, 120) }),
        ...(source.parentUrl === undefined
          ? {}
          : { parentUrl: source.parentUrl.slice(0, 2_000) }),
        retrievedAt: Date.now(),
      });
      sourceCount += 1;
      for (const [index, claim] of source.claims.slice(0, 12).entries()) {
        if (!Number.isFinite(claim.confidence)) continue;
        const angle = (claimCount + index + 1) * 2.399963;
        const radius = 0.2 + ((claimCount + index) % 7) * 0.075;
        const claimId = await ctx.db.insert("claims", {
          missionId: args.missionId,
          text: claim.text.slice(0, 2_000),
          summary: claim.summary.slice(0, 280),
          topic: claim.topic.slice(0, 80),
          status: claim.status,
          confidence: Math.max(0, Math.min(1, claim.confidence)),
          corroborationCount: 1,
          positionX: Math.cos(angle) * radius,
          positionY: Math.sin(angle) * radius,
          createdAt: Date.now(),
        });
        await ctx.db.insert("claimSources", {
          missionId: args.missionId,
          claimId,
          sourceId,
          quote: claim.quote.slice(0, 1_000),
          support: claim.support,
        });
        if (claim.requirement !== null) {
          await ctx.db.insert("requirements", {
            missionId: args.missionId,
            sourceId,
            claimId,
            text: claim.summary.slice(0, 500),
            category: claim.requirement.category,
            criticality: claim.requirement.criticality,
            status: "open",
            requiredWithBid: claim.requirement.requiredWithBid,
            sourceQuote: claim.quote.slice(0, 1_000),
            ...(claim.requirement.dueDateText === null ||
            claim.requirement.dueDateText.trim() === ""
              ? {}
              : {
                  dueDateText: claim.requirement.dueDateText
                    .trim()
                    .slice(0, 120),
                }),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          requirementCount += 1;
        }
        claimCount += 1;
      }
    }
    const mission = await ctx.db.get("missions", args.missionId);
    if (mission === null) throw new Error("Mission not found");
    if (["cancelled", "ready", "synthesizing"].includes(mission.status)) {
      return { accepted: false, sourceCount: 0, claimCount: 0 };
    }
    await ctx.db.patch("missionSeeds", args.seedId, {
      status: "complete",
      error: undefined,
    });
    await ctx.db.patch("missions", args.missionId, {
      status: mission.status === "failed" ? "failed" : "extracting",
      pagesProcessed: mission.pagesProcessed + sourceCount,
      sourceCount: mission.sourceCount + sourceCount,
      claimCount: mission.claimCount + claimCount,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "claim",
      label: "Evidence extracted",
      detail: `${claimCount} claims and ${requirementCount} bid requirements from ${sourceCount} sources`,
      createdAt: Date.now(),
    });
    return { accepted: true, sourceCount, claimCount };
  },
});

export const claimSynthesis = internalMutation({
  args: { missionId: v.id("missions") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (mission === null || mission.status !== "extracting") return false;
    const seeds = await ctx.db
      .query("missionSeeds")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .take(8);
    if (
      seeds.length === 0 ||
      !seeds.every((seed) => seed.status === "complete")
    ) {
      return false;
    }
    const now = Date.now();
    await ctx.db.patch("missions", args.missionId, {
      status: "synthesizing",
      error: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "brief",
      label: "Brief synthesis started",
      detail:
        "All bounded crawl seeds completed; one synthesis owner was claimed.",
      createdAt: now,
    });
    return true;
  },
});

export const getSynthesisInput = internalQuery({
  args: { missionId: v.id("missions") },
  returns: v.object({
    mission: v.object({
      question: v.string(),
      status: missionStatus,
      workflowKind: v.optional(
        v.union(v.literal("research"), v.literal("prebid")),
      ),
      opportunityTitle: v.optional(v.string()),
      solicitationUrl: v.optional(v.string()),
      solicitationNumber: v.optional(v.string()),
      agency: v.optional(v.string()),
      bidDueAt: v.optional(v.number()),
    }),
    seeds: v.array(
      v.object({
        status: v.union(
          v.literal("queued"),
          v.literal("crawling"),
          v.literal("processing"),
          v.literal("complete"),
          v.literal("failed"),
        ),
      }),
    ),
    claims: v.array(
      v.object({
        _id: v.id("claims"),
        text: v.string(),
        status: v.union(
          v.literal("supported"),
          v.literal("disputed"),
          v.literal("unresolved"),
        ),
        confidence: v.number(),
      }),
    ),
    requirements: v.array(
      v.object({
        text: v.string(),
        category: v.union(
          v.literal("submission"),
          v.literal("bonding"),
          v.literal("insurance"),
          v.literal("eligibility"),
          v.literal("labor"),
          v.literal("safety"),
          v.literal("schedule"),
          v.literal("technical"),
          v.literal("pricing"),
          v.literal("other"),
        ),
        criticality: v.union(
          v.literal("disqualifier"),
          v.literal("high"),
          v.literal("standard"),
        ),
        requiredWithBid: v.boolean(),
        dueDateText: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (mission === null) throw new Error("Mission not found");
    const [seeds, claims, requirements] = await Promise.all([
      ctx.db
        .query("missionSeeds")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(8),
      ctx.db
        .query("claims")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(250),
      ctx.db
        .query("requirements")
        .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
        .take(300),
    ]);
    return {
      mission: {
        question: mission.question,
        status: mission.status,
        ...(mission.workflowKind === undefined
          ? {}
          : { workflowKind: mission.workflowKind }),
        ...(mission.opportunityTitle === undefined
          ? {}
          : { opportunityTitle: mission.opportunityTitle }),
        ...(mission.solicitationUrl === undefined
          ? {}
          : { solicitationUrl: mission.solicitationUrl }),
        ...(mission.solicitationNumber === undefined
          ? {}
          : { solicitationNumber: mission.solicitationNumber }),
        ...(mission.agency === undefined ? {} : { agency: mission.agency }),
        ...(mission.bidDueAt === undefined
          ? {}
          : { bidDueAt: mission.bidDueAt }),
      },
      seeds: seeds.map((seed) => ({ status: seed.status })),
      claims: claims.map((claim) => ({
        _id: claim._id,
        text: claim.text,
        status: claim.status,
        confidence: claim.confidence,
      })),
      requirements: requirements.map((requirement) => ({
        text: requirement.text,
        category: requirement.category,
        criticality: requirement.criticality,
        requiredWithBid: requirement.requiredWithBid,
        ...(requirement.dueDateText === undefined
          ? {}
          : { dueDateText: requirement.dueDateText }),
      })),
    };
  },
});

export const storeBrief = internalMutation({
  args: {
    missionId: v.id("missions"),
    title: v.string(),
    summary: v.string(),
    body: v.string(),
  },
  returns: v.id("briefs"),
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (mission === null) throw new Error("Mission not found");
    if (mission.status !== "synthesizing") {
      throw new Error("Mission is not ready to store a brief");
    }
    const briefId = await ctx.db.insert("briefs", {
      missionId: args.missionId,
      teamId: mission.teamId,
      createdBy: mission.createdBy,
      title: args.title.slice(0, 180),
      summary: args.summary.slice(0, 1_200),
      body: args.body.slice(0, 30_000),
      status: "ready",
      createdAt: Date.now(),
    });
    await ctx.db.patch("missions", args.missionId, {
      status: "ready",
      updatedAt: Date.now(),
    });
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "brief",
      label: "Sourced brief ready",
      detail: "Every cited claim resolves to an ingested source.",
      createdAt: Date.now(),
    });
    return briefId;
  },
});

export const markFailed = internalMutation({
  args: {
    missionId: v.id("missions"),
    seedId: v.optional(v.id("missionSeeds")),
    crawlJobId: v.optional(v.string()),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (
      mission === null ||
      mission.status === "cancelled" ||
      mission.status === "ready"
    )
      return null;
    if (args.seedId !== undefined) {
      const seed = await ctx.db.get("missionSeeds", args.seedId);
      if (
        seed === null ||
        seed.missionId !== args.missionId ||
        seed.status === "complete" ||
        (args.crawlJobId !== undefined && seed.crawlJobId !== args.crawlJobId)
      ) {
        return null;
      }
      await ctx.db.patch("missionSeeds", args.seedId, {
        status: "failed",
        error: args.error.slice(0, 500),
      });
    }
    await ctx.db.patch("missions", args.missionId, {
      status: "failed",
      error: args.error.slice(0, 500),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export type StoredSource = {
  url: string;
  title: string;
  excerpt: string;
  content: string;
  sourceHash: string;
  kind: "notice" | "attachment" | "amendment" | "reference";
  fileName?: string;
  contentType?: string;
  parentUrl?: string;
  claims: Array<{
    text: string;
    summary: string;
    topic: string;
    status: "supported" | "disputed" | "unresolved";
    confidence: number;
    quote: string;
    support: "supports" | "challenges" | "context";
    requirement: null | {
      category:
        | "submission"
        | "bonding"
        | "insurance"
        | "eligibility"
        | "labor"
        | "safety"
        | "schedule"
        | "technical"
        | "pricing"
        | "other";
      criticality: "disqualifier" | "high" | "standard";
      requiredWithBid: boolean;
      dueDateText: string | null;
    };
  }>;
};
