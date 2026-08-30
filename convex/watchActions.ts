"use node";

import { createHash } from "node:crypto";
import { getAuthUserId } from "@convex-dev/auth/server";
import { AgentMailClient } from "agentmail";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const scrapeResult = z.object({
  success: z.boolean().optional(),
  data: z
    .object({
      markdown: z.string().optional(),
      links: z.array(z.string()).optional(),
    })
    .passthrough(),
});

const impactOutput = z.object({
  impacts: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        area: z.enum([
          "deadline",
          "scope",
          "pricing",
          "trade",
          "forms",
          "bonding",
          "schedule",
          "site_access",
          "other",
        ]),
        severity: z.enum(["blocking", "high", "standard"]),
        blocksRelease: z.boolean(),
        sourceQuote: z.string(),
      }),
    )
    .max(12),
});

type Impact = z.infer<typeof impactOutput>["impacts"][number];

function changedLines(previous: string, current: string) {
  const previousLines = previous
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 3);
  const currentLines = current
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 3);
  const previousCounts = new Map<string, number>();
  const currentCounts = new Map<string, number>();
  for (const line of previousLines) {
    previousCounts.set(line, (previousCounts.get(line) ?? 0) + 1);
  }
  for (const line of currentLines) {
    currentCounts.set(line, (currentCounts.get(line) ?? 0) + 1);
  }
  const added = currentLines.filter(
    (line, index) =>
      index < 500 &&
      (currentCounts.get(line) ?? 0) > (previousCounts.get(line) ?? 0),
  );
  const removed = previousLines.filter(
    (line, index) =>
      index < 500 &&
      (previousCounts.get(line) ?? 0) > (currentCounts.get(line) ?? 0),
  );
  return {
    addedText: [...new Set(added)].join("\n").slice(0, 20_000),
    removedText: [...new Set(removed)].join("\n").slice(0, 20_000),
  };
}

async function extractImpacts({
  title,
  addedText,
  removedText,
}: {
  title: string;
  addedText: string;
  removedText: string;
}): Promise<Impact[]> {
  const changedSource = `ADDED:\n${addedText || "(none)"}\n\nREMOVED:\n${removedText || "(none)"}`;
  const fallback: Impact = {
    title: "Review the changed bid package",
    detail:
      "The public package changed. Confirm the effect on scope, pricing, schedule, forms, and trade coverage before release.",
    area: "other",
    severity: "blocking",
    blocksRelease: true,
    sourceQuote: (
      addedText ||
      removedText ||
      "Package link inventory changed"
    ).slice(0, 2_000),
  };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [fallback];
  const client = new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-5.6-luna",
    input: [
      {
        role: "system",
        content:
          "You are a construction bid amendment controller. Convert only the supplied changed text into concrete operational impacts. Do not summarize unchanged material or invent obligations. sourceQuote must be an exact, contiguous substring of the supplied ADDED or REMOVED text. blocksRelease is true when a reasonable estimator should not release the bid before a human resolves the impact. Return at most 12 non-duplicate impacts.",
      },
      {
        role: "user",
        content: `Opportunity: ${title}\n\n${changedSource}`,
      },
    ],
    text: { format: zodTextFormat(impactOutput, "amendment_impacts") },
  });
  const impacts = (response.output_parsed?.impacts ?? []).filter(
    (impact) =>
      impact.sourceQuote.length >= 3 &&
      changedSource.includes(impact.sourceQuote),
  );
  return impacts.length > 0 ? impacts : [fallback];
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

async function checkWatch(
  ctx: ActionCtx,
  watchId: Id<"missionWatches">,
  trigger: "scheduled" | "manual",
) {
  const context = await ctx.runQuery(internal.watches.getCheckContext, {
    watchId,
  });
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) throw new Error("Firecrawl is not configured");
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: context.solicitationUrl,
      formats: ["markdown", "links"],
      onlyMainContent: true,
      removeBase64Images: true,
      blockAds: true,
      maxAge: 0,
    }),
  });
  if (!response.ok) {
    throw new Error(`Firecrawl amendment check failed (${response.status})`);
  }
  const parsed = scrapeResult.parse(await response.json());
  const markdown = parsed.data.markdown ?? "";
  const linkInventory = [...new Set(parsed.data.links ?? [])]
    .sort()
    .slice(0, 100);
  const links = linkInventory.join("\n");
  if (markdown.length < 80) {
    throw new Error("Firecrawl returned no usable notice content");
  }
  const sourceHash = createHash("sha256")
    .update(context.solicitationUrl)
    .update("\0")
    .update(markdown)
    .update("\0")
    .update(links)
    .digest("hex");
  const diff = changedLines(context.previousMarkdown ?? "", markdown);
  const linkDiff = changedLines(
    (context.previousLinks ?? []).join("\n"),
    links,
  );
  const addedText = [diff.addedText, linkDiff.addedText]
    .filter(Boolean)
    .join("\n")
    .slice(0, 20_000);
  const removedText = [diff.removedText, linkDiff.removedText]
    .filter(Boolean)
    .join("\n")
    .slice(0, 20_000);
  const changed =
    context.lastSourceHash !== undefined &&
    context.lastSourceHash !== sourceHash;
  const impacts = changed
    ? await extractImpacts({ title: context.title, addedText, removedText })
    : [];
  const summary = changed
    ? `${impacts.length} source-linked bid impact${impacts.length === 1 ? "" : "s"} require review before release.`
    : context.previousVersion === 0
      ? "Version 1 captured as the package baseline."
      : "No public package change detected.";
  const changeEventId = await ctx.runMutation(internal.watches.recordCheck, {
    watchId,
    sourceHash,
    summary,
    markdown,
    linkInventory,
    trigger,
    ...(addedText ? { addedText } : {}),
    ...(removedText ? { removedText } : {}),
    impacts,
  });
  if (changeEventId === null) return { changed: false };

  const apiKey = process.env.AGENTMAIL_API_KEY;
  const inboxId = process.env.AGENTMAIL_INBOX_ID;
  const appUrl = process.env.PUBLIC_APP_URL;
  if (!apiKey || !inboxId || !appUrl) {
    throw new Error("AgentMail amendment alerts are not configured");
  }
  const reviewUrl = `${appUrl.replace(/\/$/, "")}/app/missions/${context.missionId}`;
  const client = new AgentMailClient({ apiKey });
  await client.inboxes.messages.send(inboxId, {
    to: context.recipientEmail,
    subject: `[Signal Garden] Review solicitation change: ${context.title}`,
    text: `${summary}\n\n${impacts.map((impact) => `- ${impact.title}: ${impact.detail}`).join("\n")}\n\nBid release is locked until material impacts are cleared by your team. Review: ${reviewUrl}`,
    html: `<main style="font-family:system-ui;max-width:680px;margin:auto;color:#111"><p style="font-size:12px;text-transform:uppercase;letter-spacing:.12em">Signal Garden package control</p><h1>${escapeHtml(context.title)}</h1><p>${escapeHtml(summary)}</p><ul>${impacts.map((impact) => `<li><strong>${escapeHtml(impact.title)}</strong>: ${escapeHtml(impact.detail)}</li>`).join("")}</ul><p><strong>Bid release is locked until material impacts are cleared by your team.</strong></p><p><a href="${escapeHtml(reviewUrl)}">Open the control room</a></p></main>`,
  });
  await ctx.runMutation(internal.watches.markNotified, { changeEventId });
  return { changed: true };
}

export const checkDue = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const due = await ctx.runQuery(internal.watches.listDue, {
      now: Date.now(),
      limit: 10,
    });
    for (const watch of due) {
      await checkWatch(ctx, watch._id, "scheduled");
    }
    return null;
  },
});

export const initializePublishedBid = internalAction({
  args: { slug: v.string() },
  returns: v.object({ changed: v.boolean() }),
  handler: async (ctx, args): Promise<{ changed: boolean }> => {
    const watchId: Id<"missionWatches"> = await ctx.runMutation(
      internal.watches.ensureForPublishedMission,
      { slug: args.slug },
    );
    return await checkWatch(ctx, watchId, "manual");
  },
});

export const checkNow = action({
  args: { missionId: v.id("missions") },
  returns: v.object({ changed: v.boolean() }),
  handler: async (ctx, args): Promise<{ changed: boolean }> => {
    const requesterId = await getAuthUserId(ctx);
    if (requesterId === null) throw new Error("401: sign in required");
    const context: {
      watchId: Id<"missionWatches">;
    } = await ctx.runQuery(internal.watches.getCheckContext, {
      missionId: args.missionId,
      requesterId,
    });
    return await checkWatch(ctx, context.watchId, "manual");
  },
});
