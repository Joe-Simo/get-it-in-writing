import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { requireUserId } from "./model/auth";

const firecrawl = new FirecrawlClient(components.firecrawl);

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function excerpt(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function safeError(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}

export const getContext = internalQuery({
  args: { decisionId: v.id("decisions") },
  returns: v.union(
    v.null(),
    v.object({
      decision: v.object({
        _id: v.id("decisions"),
        ownerId: v.id("users"),
      }),
      monitor: v.union(v.null(), v.object({
        _id: v.id("changeMonitors"),
        intervalHours: v.number(),
      })),
      sources: v.array(
        v.object({
          url: v.string(),
          contentHash: v.string(),
          excerpt: v.string(),
          capturedAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null) return null;
    const [monitor, rows] = await Promise.all([
      ctx.db
        .query("changeMonitors")
        .withIndex("by_decisionId", (q) => q.eq("decisionId", decision._id))
        .first(),
      ctx.db
        .query("sourceDocuments")
        .withIndex("by_decisionId_and_url", (q) => q.eq("decisionId", decision._id))
        .take(100),
    ]);
    const latestByUrl = new Map<string, Doc<"sourceDocuments">>();
    for (const row of rows) {
      const current = latestByUrl.get(row.url);
      if (!current || row.capturedAt > current.capturedAt) latestByUrl.set(row.url, row);
    }
    return {
      decision: { _id: decision._id, ownerId: decision.ownerId },
      monitor: monitor ? { _id: monitor._id, intervalHours: monitor.intervalHours } : null,
      sources: [...latestByUrl.values()].map((source) => ({
        url: source.url,
        contentHash: source.contentHash,
        excerpt: source.excerpt,
        capturedAt: source.capturedAt,
      })),
    };
  },
});

export const recordCheck = internalMutation({
  args: {
    decisionId: v.id("decisions"),
    monitorId: v.id("changeMonitors"),
    checkedAt: v.number(),
    results: v.array(
      v.object({
        url: v.string(),
        priorHash: v.string(),
        priorExcerpt: v.string(),
        currentHash: v.string(),
        currentExcerpt: v.string(),
        title: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [decision, monitor] = await Promise.all([
      ctx.db.get("decisions", args.decisionId),
      ctx.db.get("changeMonitors", args.monitorId),
    ]);
    if (decision === null || monitor === null || monitor.decisionId !== decision._id) return null;
    let changed = false;
    for (const result of args.results) {
      if (result.priorHash === result.currentHash) continue;
      changed = true;
      const priorChange = await ctx.db
        .query("sourceChanges")
        .withIndex("by_decisionId_and_detectedAt", (q) => q.eq("decisionId", decision._id))
        .order("desc")
        .take(20);
      if (!priorChange.some(
        (item) => item.sourceUrl === result.url && item.currentHash === result.currentHash,
      )) {
        await ctx.db.insert("sourceChanges", {
          decisionId: decision._id,
          sourceUrl: result.url,
          previousHash: result.priorHash,
          currentHash: result.currentHash,
          previousExcerpt: result.priorExcerpt,
          currentExcerpt: result.currentExcerpt,
          status: "open",
          detectedAt: args.checkedAt,
        });
      }
      const existingSnapshot = await ctx.db
        .query("sourceDocuments")
        .withIndex("by_decisionId_and_contentHash", (q) =>
          q.eq("decisionId", decision._id).eq("contentHash", result.currentHash),
        )
        .first();
      if (existingSnapshot === null) {
        await ctx.db.insert("sourceDocuments", {
          decisionId: decision._id,
          crawlId: `monitor-${args.checkedAt}`,
          url: result.url,
          ...(result.title ? { title: result.title } : {}),
          contentHash: result.currentHash,
          excerpt: result.currentExcerpt,
          capturedAt: args.checkedAt,
        });
      }
    }
    await ctx.db.patch("changeMonitors", monitor._id, {
      lastCheckedAt: args.checkedAt,
      nextCheckAt: args.checkedAt + monitor.intervalHours * 60 * 60 * 1_000,
      lastError: undefined,
      updatedAt: args.checkedAt,
    });
    if (changed) {
      await ctx.db.patch("decisions", decision._id, {
        sourceChangedAt: args.checkedAt,
        updatedAt: args.checkedAt,
      });
      await ctx.db.insert("decisionEvents", {
        decisionId: decision._id,
        fromStatus: decision.status,
        toStatus: decision.status,
        label: "An official source changed — earlier and current evidence preserved",
        occurredAt: args.checkedAt,
      });
    }
    return null;
  },
});

export const recordFailure = internalMutation({
  args: {
    monitorId: v.id("changeMonitors"),
    checkedAt: v.number(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get("changeMonitors", args.monitorId);
    if (monitor === null) return null;
    await ctx.db.patch("changeMonitors", monitor._id, {
      lastCheckedAt: args.checkedAt,
      nextCheckAt: args.checkedAt + monitor.intervalHours * 60 * 60 * 1_000,
      lastError: args.error.slice(0, 200),
      updatedAt: args.checkedAt,
    });
    return null;
  },
});

export const checkDecision = internalAction({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.changes.getContext, args);
    if (context === null || context.monitor === null || context.sources.length === 0) return null;
    const checkedAt = Date.now();
    try {
      const results = [];
      for (const source of context.sources.slice(0, 12)) {
        const document = await firecrawl.scrape(ctx, source.url, {
          formats: ["markdown"],
          onlyMainContent: true,
          maxAge: 0,
          removeBase64Images: true,
        });
        const markdown = document.markdown?.trim();
        if (!markdown) continue;
        results.push({
          url: source.url,
          priorHash: source.contentHash,
          priorExcerpt: source.excerpt,
          currentHash: await sha256(markdown),
          currentExcerpt: excerpt(markdown),
          ...(typeof document.metadata?.title === "string"
            ? { title: document.metadata.title.slice(0, 240) }
            : {}),
        });
      }
      await ctx.runMutation(internal.changes.recordCheck, {
        decisionId: context.decision._id,
        monitorId: context.monitor._id,
        checkedAt,
        results,
      });
    } catch (error) {
      await ctx.runMutation(internal.changes.recordFailure, {
        monitorId: context.monitor._id,
        checkedAt,
        error: safeError(error),
      });
    }
    return null;
  },
});

export const scheduleDue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const due = await ctx.db
      .query("changeMonitors")
      .withIndex("by_active_and_nextCheckAt", (q) => q.eq("active", true).lte("nextCheckAt", Date.now()))
      .take(8);
    for (const monitor of due) {
      await ctx.scheduler.runAfter(0, internal.changes.checkDecision, {
        decisionId: monitor.decisionId,
      });
    }
    return null;
  },
});

export const requestCheck = mutation({
  args: { decisionId: v.id("decisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    if (decision === null || decision.ownerId !== ownerId) throw new Error("404: decision not found");
    const monitor = await ctx.db
      .query("changeMonitors")
      .withIndex("by_decisionId", (q) => q.eq("decisionId", decision._id))
      .first();
    if (monitor === null) throw new Error("Source monitoring starts after a Proof Card is created");
    if (monitor.lastCheckedAt && Date.now() - monitor.lastCheckedAt < 5 * 60 * 1_000) {
      throw new Error("The sources were checked less than five minutes ago");
    }
    await ctx.scheduler.runAfter(0, internal.changes.checkDecision, { decisionId: decision._id });
    return null;
  },
});

export const acknowledge = mutation({
  args: { sourceChangeId: v.id("sourceChanges") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const change = await ctx.db.get("sourceChanges", args.sourceChangeId);
    if (change === null) throw new Error("404: source change not found");
    const decision = await ctx.db.get("decisions", change.decisionId);
    if (decision === null || decision.ownerId !== ownerId) throw new Error("403: decision is private");
    await ctx.db.patch("sourceChanges", change._id, {
      status: "acknowledged",
      acknowledgedAt: Date.now(),
    });
    return null;
  },
});
