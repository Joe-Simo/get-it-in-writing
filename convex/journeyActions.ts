"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { AgentMailClient } from "agentmail";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizePublicWebsiteUrl, websiteDomain } from "./lib/journeySafety";

const candidateKind = z.enum([
  "contact",
  "lead_form",
  "quote_request",
]);

const discoveryOutput = z.object({
  siteName: z.string(),
  summary: z.string(),
  candidates: z
    .array(
      z.object({
        name: z.string(),
        kind: candidateKind,
        startUrl: z.string(),
        goal: z.string(),
        whyItMatters: z.string(),
        expectedSenderDomain: z.string().nullable(),
        expectsConfirmation: z.boolean(),
        expectsHumanReply: z.boolean(),
        expectedReplyMinutes: z.number().int().min(15).max(10_080),
      }),
    )
    .max(5),
});

const executionEvaluation = z.object({
  outcome: z.enum(["submitted", "blocked", "failed"]),
  failureKind: z.enum(["website", "form"]),
  summary: z.string(),
});

const scrapeEnvelope = z.object({
  success: z.boolean().optional(),
  data: z.object({
    markdown: z.string().optional(),
    html: z.string().optional(),
    links: z.array(z.string()).optional(),
    screenshot: z.string().optional(),
    metadata: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        sourceURL: z.string().optional(),
        url: z.string().optional(),
        scrapeId: z.string().optional(),
      })
      .passthrough()
      .optional(),
  }),
});

const discoveryCandidate = v.object({
  name: v.string(),
  kind: v.union(
    v.literal("contact"),
    v.literal("lead_form"),
    v.literal("quote_request"),
  ),
  startUrl: v.string(),
  goal: v.string(),
  whyItMatters: v.string(),
  expectedSenderDomain: v.optional(v.string()),
  expectsConfirmation: v.boolean(),
  expectsHumanReply: v.boolean(),
  expectedReplyMinutes: v.number(),
});

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured for this deployment`);
  return value;
}

async function firecrawlScrape(apiKey: string, url: string) {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "html", "links"],
      onlyMainContent: false,
      removeBase64Images: true,
      blockAds: true,
      timeout: 120_000,
    }),
  });
  if (!response.ok) {
    throw new Error(`The public website could not be opened (${response.status})`);
  }
  return scrapeEnvelope.parse(await response.json()).data;
}

export const discover = action({
  args: { teamId: v.id("teams"), websiteUrl: v.string() },
  returns: v.object({
    siteName: v.string(),
    websiteUrl: v.string(),
    summary: v.string(),
    candidates: v.array(discoveryCandidate),
  }),
  handler: async (ctx, args) => {
    const requesterId = await getAuthUserId(ctx);
    if (requesterId === null) throw new Error("401: sign in required");
    await ctx.runQuery(internal.journeys.getDiscoveryContext, {
      teamId: args.teamId,
      requesterId,
    });
    const websiteUrl = normalizePublicWebsiteUrl(args.websiteUrl);
    const page = await firecrawlScrape(requiredEnv("FIRECRAWL_API_KEY"), websiteUrl);
    const content = `${page.markdown ?? ""}\n\nVISIBLE HTML\n${page.html ?? ""}\n\nLINKS\n${(page.links ?? []).join("\n")}`.slice(
      0,
      100_000,
    );
    if (content.trim().length < 80) {
      throw new Error("The website did not expose enough public content to find a lead form");
    }
    const openai = new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
    const result = await openai.responses.parse({
      model: process.env.OPENAI_JOURNEY_MODEL ?? "gpt-5.6-luna",
      input: [
        {
          role: "system",
          content:
            "You identify real public lead forms for a business owner. Return only contact, lead, demo-request, and quote-request forms visibly supported by the supplied page and links. Never suggest payments, purchases, logins, account creation, medical or financial forms, job applications, legal filings, captcha bypass, or anything requiring sensitive personal data. Prefer the one form closest to new revenue. Use exact public URLs from the evidence. Do not claim a confirmation email unless the page promises or strongly signals it; when uncertain, set the boolean false. Set expectsHumanReply to false. Use expectedReplyMinutes for the confirmation-email wait window, normally 30 to 120 minutes based on the site's visible promise. expectedSenderDomain should be a plausible visible email domain only when supported; otherwise null. Describe the form and value in plain business language. Never use the terms customer journey, handoff, observability, agent, workflow, or incident.",
        },
        {
          role: "user",
          content: `Website: ${websiteUrl}\nPage title: ${page.metadata?.title ?? "Unknown"}\nDescription: ${page.metadata?.description ?? "None"}\n\nPUBLIC WEBSITE EVIDENCE\n${content}`,
        },
      ],
      text: { format: zodTextFormat(discoveryOutput, "lead_form_discovery") },
    });
    const parsed = result.output_parsed;
    if (!parsed || parsed.candidates.length === 0) {
      throw new Error("No safe public lead or contact form was found on this website");
    }
    return {
      siteName: parsed.siteName.slice(0, 80),
      websiteUrl,
      summary: parsed.summary.slice(0, 400),
      candidates: parsed.candidates.flatMap((candidate) => {
        let startUrl: string;
        try {
          startUrl = normalizePublicWebsiteUrl(candidate.startUrl);
        } catch {
          return [];
        }
        if (websiteDomain(startUrl) !== websiteDomain(websiteUrl)) return [];
        const sender = candidate.expectedSenderDomain
          ?.trim()
          .toLowerCase()
          .replace(/^@/, "")
          .replace(/^www\./, "");
        return [
          {
            name: candidate.name.slice(0, 80),
            kind: candidate.kind,
            startUrl,
            goal: candidate.goal.slice(0, 240),
            whyItMatters: candidate.whyItMatters.slice(0, 320),
            ...(sender && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(sender)
              ? { expectedSenderDomain: sender }
              : {}),
            expectsConfirmation: candidate.expectsConfirmation,
            expectsHumanReply:
              candidate.expectsConfirmation && candidate.expectsHumanReply,
            expectedReplyMinutes: candidate.expectedReplyMinutes,
          },
        ];
      }),
    };
  },
});

export const runNow = action({
  args: { journeyId: v.id("customerJourneys") },
  returns: v.id("journeyRuns"),
  handler: async (ctx, args): Promise<Id<"journeyRuns">> => {
    const requesterId = await getAuthUserId(ctx);
    if (requesterId === null) throw new Error("401: sign in required");
    return await ctx.runMutation(internal.journeys.createRun, {
      journeyId: args.journeyId,
      trigger: "manual",
      requesterId,
    });
  },
});

function interactionEvidence(payload: unknown) {
  if (typeof payload === "string") return payload.slice(0, 12_000);
  if (typeof payload === "object" && payload !== null) {
    const object = payload as Record<string, unknown>;
    const safe = {
      success: object.success,
      output: object.output,
      result: object.result,
      stderr: object.stderr,
      exitCode: object.exitCode,
      killed: object.killed,
    };
    return JSON.stringify(safe).slice(0, 12_000);
  }
  try {
    return JSON.stringify(payload).slice(0, 12_000);
  } catch {
    return "The browser interaction returned no readable report.";
  }
}

function senderDomain(sender: string) {
  const match = sender.toLowerCase().match(/@([^>\s]+)>?$/);
  return match?.[1]?.replace(/[^a-z0-9.-]/g, "").slice(0, 253) ?? "agentmail.to";
}

function matchesExpectedSender(actual: string, expected: string) {
  return actual === expected || actual.endsWith(`.${expected}`);
}

export const reconcileAgentMail = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!apiKey) return 0;
    const expectations = await ctx.runQuery(
      internal.journeys.listWaitingEmailExpectations,
      { now: Date.now() },
    );
    const client = new AgentMailClient({ apiKey });
    let recorded = 0;
    for (const expectation of expectations) {
      try {
        const tokenResult = await client.inboxes.messages.search(expectation.inboxId, {
          q: expectation.correlationToken,
          limit: 10,
          after: new Date(expectation.createdAt - 60_000),
        });
        const domainResult = expectation.expectedSenderDomain
          ? await client.inboxes.messages.list(expectation.inboxId, {
              from: [expectation.expectedSenderDomain],
              limit: 20,
              after: new Date(expectation.createdAt - 60_000),
              before: new Date(expectation.deadlineAt + 60_000),
            })
          : { messages: [] };
        const tokenMatches = new Set(
          tokenResult.messages.map((message) => message.messageId),
        );
        const candidates = [
          ...tokenResult.messages,
          ...domainResult.messages.filter(
            (message) => !tokenMatches.has(message.messageId),
          ),
        ];
        const observed = candidates.find((message) => {
          if (!message.labels.includes("received")) return false;
          if (tokenMatches.has(message.messageId)) return true;
          return (
            expectation.expectedSenderDomain !== undefined &&
            matchesExpectedSender(
              senderDomain(message.from),
              expectation.expectedSenderDomain,
            )
          );
        });
        if (observed === undefined) continue;
        const accepted = await ctx.runMutation(
          internal.journeys.recordEmailReceived,
          {
            expectationId: expectation.expectationId,
            messageId: observed.messageId,
            senderDomain: senderDomain(observed.from),
            evidenceExcerpt:
              expectation.expectedKind === "confirmation"
                ? "The expected confirmation email arrived in the private test inbox."
                : "The expected follow-up email arrived in the private test inbox.",
          },
        );
        if (accepted) recorded += 1;
      } catch (error) {
        console.error(
          "AgentMail reconciliation failed for one waiting expectation",
          error instanceof Error ? error.name : "UnknownError",
        );
      }
    }
    return recorded;
  },
});

export const executeRun = internalAction({
  args: { runId: v.id("journeyRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.journeys.markRunStarted, {
      runId: args.runId,
    });
    let scrapeId: string | undefined;
    let firecrawlKey: string | undefined;
    try {
      const journey = await ctx.runQuery(internal.journeys.getRunContext, {
        runId: args.runId,
      });
      firecrawlKey = requiredEnv("FIRECRAWL_API_KEY");
      const inboxId = requiredEnv("AGENTMAIL_INBOX_ID");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inboxId)) {
        throw new Error("The test-customer inbox is not a usable email address");
      }
      if (![
        "contact",
        "lead_form",
        "quote_request",
      ].includes(journey.kind)) {
        throw new Error("This form type cannot be submitted automatically");
      }
      const before = await firecrawlScrape(firecrawlKey, journey.startUrl);
      scrapeId = before.metadata?.scrapeId;
      if (!scrapeId) {
          await ctx.runMutation(internal.journeys.recordBrowserResult, {
            runId: args.runId,
            outcome: "failed",
          summary: "The public page could not be opened in an interactive browser session.",
          failureKind: "website",
        });
        return null;
      }
      const prompt = [
        "You are Signal Garden QA, a clearly identified test customer acting with the website owner's authorization.",
        `Customer goal: ${journey.goal}`,
        `Check reference: ${journey.correlationToken}`,
        `Use the full name 'Signal Garden QA ${journey.correlationToken}'.`,
        `Use the email address '${inboxId}'.`,
        `For a website or company URL field, use '${new URL(`/`, journey.startUrl).toString()}?signal_garden_test=${journey.correlationToken}'.`,
        `For a message or notes field, write: 'Authorized lead-form test. No service is requested. Please keep this reference in confirmation messages: ${journey.correlationToken}.'`,
        "Use 202-555-0147 only if a phone number is mandatory. This is a reserved fictional number.",
        "Find and complete only the public contact, lead, or quote-request form that directly supports the stated goal.",
        "Submit exactly once, then report what the page visibly showed after submission.",
        "Never enter payment, login, account, government ID, address, health, financial, employment, or other sensitive data. Never accept a contract, book scarce time, create an account, make a purchase, bypass a captcha, or upload a file.",
        "If any forbidden field/action, captcha, ambiguous final action, validation block, or missing required safe field prevents submission, stop without submitting and begin the report with BLOCKED.",
        "If the form was submitted and the page visibly acknowledged it, begin the report with SUBMITTED. Otherwise begin with FAILED.",
      ].join("\n");
      const interactionResponse = await fetch(
        `https://api.firecrawl.dev/v2/scrape/${encodeURIComponent(scrapeId)}/interact`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            timeout: 180,
            origin: "signal-garden-lead-form-check",
          }),
        },
      );
      const interactionPayload = (await interactionResponse.json()) as unknown;
      if (!interactionResponse.ok) {
        const responseObject =
          typeof interactionPayload === "object" && interactionPayload !== null
            ? (interactionPayload as Record<string, unknown>)
            : {};
        const reason = [responseObject.error, responseObject.message].find(
          (value): value is string => typeof value === "string",
        );
        throw new Error(
          `The interactive form check could not run (${interactionResponse.status})${reason ? `: ${reason.replace(/[^\x20-\x7E]/g, " ").slice(0, 240)}` : ""}`,
        );
      }
      const rawEvidence = interactionEvidence(interactionPayload);
      const openai = new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
      const evaluationResponse = await openai.responses.parse({
        model: process.env.OPENAI_JOURNEY_MODEL ?? "gpt-5.6-luna",
        input: [
          {
            role: "system",
            content:
              "Evaluate browser-run evidence conservatively. Mark submitted only when the evidence explicitly says the approved public form was submitted and shows a visible acknowledgement or success outcome. Mark blocked for captcha, forbidden/sensitive fields, ambiguous side effects, or a deliberate safety stop. Mark failed for navigation, validation, or form errors. Never include an email address, phone number, correlation token, provider name, internal identifier, or secret in the summary. Explain the customer-facing outcome in one concise sentence.",
          },
          {
            role: "user",
            content: `Lead-form goal: ${journey.goal}\nForm kind: ${journey.kind}\n\nBROWSER EVIDENCE\n${rawEvidence}`,
          },
        ],
        text: {
          format: zodTextFormat(executionEvaluation, "journey_execution"),
        },
      });
      const evaluation = evaluationResponse.output_parsed;
      if (!evaluation) throw new Error("The lead-form evidence could not be evaluated");
      await ctx.runMutation(internal.journeys.recordBrowserResult, {
        runId: args.runId,
        outcome: evaluation.outcome,
        summary: evaluation.summary.slice(0, 600),
        scrapeId,
        ...(evaluation.outcome === "submitted" ? { inboxId } : {}),
        ...(evaluation.outcome === "submitted"
          ? {}
          : { failureKind: evaluation.failureKind }),
      });
    } catch (error) {
      console.error(
        "Lead-form check execution failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      await ctx.runMutation(internal.journeys.recordRunError, {
        runId: args.runId,
        summary:
          "Signal Garden could not complete this check. No form result was recorded; run it again.",
      });
    } finally {
      if (scrapeId !== undefined && firecrawlKey !== undefined) {
        await fetch(
          `https://api.firecrawl.dev/v2/scrape/${encodeURIComponent(scrapeId)}/interact`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${firecrawlKey}` },
          },
        ).catch(() => undefined);
      }
    }
    return null;
  },
});

export const runDue = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const journeyIds = await ctx.runQuery(internal.journeys.listDue, {
      now: Date.now(),
    });
    let started = 0;
    for (const journeyId of journeyIds) {
      try {
        await ctx.runMutation(internal.journeys.createRun, {
          journeyId,
          trigger: "scheduled",
        });
        started += 1;
      } catch {
        // An active run is already protecting this journey from overlap.
      }
    }
    return started;
  },
});
