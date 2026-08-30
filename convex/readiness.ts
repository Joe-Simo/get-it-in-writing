"use node";

import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import OpenAI from "openai";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { normalizeOfficialUrl } from "./lib/validation";

declare const process: { env: Record<string, string | undefined> };

const firecrawl = new FirecrawlClient(components.firecrawl);

function errorMeta(error: unknown) {
  if (typeof error !== "object" || error === null) return "UnknownError";
  const record = error as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : "Error";
  const status = typeof record.status === "number" ? `:${record.status}` : "";
  const code = typeof record.code === "string" ? `:${record.code}` : "";
  return `${name}${status}${code}`.slice(0, 120);
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export const providers = internalAction({
  args: { publicUrl: v.string(), expectedAgentMailWebhookUrl: v.optional(v.string()) },
  returns: v.object({
    firecrawl: v.boolean(),
    openai: v.boolean(),
    agentmail: v.boolean(),
    agentmailError: v.optional(v.string()),
    openaiError: v.optional(v.string()),
    webhookConfigured: v.boolean(),
    inboxConfigured: v.boolean(),
    agentmailWebhookActive: v.boolean(),
    matchingAgentMailWebhooks: v.number(),
    agentmailReplyIngestion: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const publicUrl = normalizeOfficialUrl(args.publicUrl);
    let firecrawlReady = false;
    let openaiReady = false;
    let agentmailReady = false;
    let agentmailWebhookActive = false;
    let matchingAgentMailWebhooks = 0;
    let agentmailReplyIngestion = false;
    let openaiError: string | undefined;
    let agentmailError: string | undefined;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    const openaiKey = process.env.OPENAI_API_KEY;
    try {
      const page = await firecrawl.scrape(ctx, publicUrl, {
        formats: ["markdown"],
        onlyMainContent: true,
        maxAge: 0,
        removeBase64Images: true,
      });
      firecrawlReady = (page.markdown?.trim().length ?? 0) > 40;
    } catch {
      firecrawlReady = false;
    }
    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey });
        const response = await openai.responses.create({
          model: process.env.OPENAI_DECISION_MODEL ?? "gpt-5.6-luna",
          input: "Return only the uppercase word READY.",
          max_output_tokens: 32,
        });
        openaiReady = /\bREADY\b/i.test(response.output_text);
      } catch (error) {
        openaiReady = false;
        openaiError = errorMeta(error);
      }
    }
    if (inboxId) {
      try {
        const baseUrl = (process.env.AGENTMAIL_BASE_URL ?? "https://api.agentmail.to/v0").replace(/\/$/, "");
        const response = await fetch(`${baseUrl}/inboxes/${encodeURIComponent(inboxId)}`, {
          headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY ?? ""}` },
        });
        agentmailReady = response.ok;
        if (!response.ok) agentmailError = `AgentMailApiError:${response.status}`;
        if (response.ok) {
          const messagesResponse = await fetch(
            `${baseUrl}/inboxes/${encodeURIComponent(inboxId)}/messages?limit=1`,
            { headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY ?? ""}` } },
          );
          agentmailReplyIngestion = messagesResponse.ok;
        }
        if (response.ok && args.expectedAgentMailWebhookUrl) {
          const expectedUrl = normalizeOfficialUrl(args.expectedAgentMailWebhookUrl);
          const webhooksResponse = await fetch(
            `${baseUrl}/inboxes/${encodeURIComponent(inboxId)}/webhooks?limit=100`,
            { headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY ?? ""}` } },
          );
          if (webhooksResponse.ok) {
            const payload = record(await webhooksResponse.json());
            const webhooks = Array.isArray(payload.webhooks) ? payload.webhooks : [];
            const requiredEvents = [
              "message.received",
              "message.sent",
              "message.delivered",
              "message.bounced",
              "message.complained",
              "message.rejected",
            ];
            const matching = webhooks.map(record).filter((webhook) => webhook.url === expectedUrl);
            matchingAgentMailWebhooks = matching.length;
            agentmailWebhookActive = matching.some((webhook) => {
              const events = Array.isArray(webhook.event_types) ? webhook.event_types : [];
              return webhook.enabled === true &&
                requiredEvents.every((event) => events.includes(event));
            });
          }
        }
      } catch (error) {
        agentmailReady = false;
        agentmailError = errorMeta(error);
      }
    }
    return {
      firecrawl: firecrawlReady,
      openai: openaiReady,
      agentmail: agentmailReady,
      ...(agentmailError ? { agentmailError } : {}),
      ...(openaiError ? { openaiError } : {}),
      webhookConfigured: Boolean(process.env.AGENTMAIL_WEBHOOK_SECRET),
      inboxConfigured: Boolean(inboxId),
      agentmailWebhookActive,
      matchingAgentMailWebhooks,
      agentmailReplyIngestion,
    };
  },
});

export const ensureAgentMailWebhook = internalAction({
  args: { expectedUrl: v.string() },
  returns: v.object({
    created: v.boolean(),
    active: v.boolean(),
    authenticated: v.boolean(),
    failureStage: v.optional(v.string()),
    failureStatus: v.optional(v.number()),
  }),
  handler: async (_ctx, args) => {
    const expectedUrl = normalizeOfficialUrl(args.expectedUrl);
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    const webhookSecret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!apiKey || !inboxId || !webhookSecret) {
      return {
        created: false,
        active: false,
        authenticated: false,
        failureStage: "configuration",
      };
    }
    const baseUrl = (process.env.AGENTMAIL_BASE_URL ?? "https://api.agentmail.to/v0").replace(/\/$/, "");
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    const listResponse = await fetch(
      `${baseUrl}/inboxes/${encodeURIComponent(inboxId)}/webhooks?limit=100`,
      { headers },
    );
    if (!listResponse.ok) {
      return {
        created: false,
        active: false,
        authenticated: false,
        failureStage: "list",
        failureStatus: listResponse.status,
      };
    }
    const payload = record(await listResponse.json());
    const webhooks = Array.isArray(payload.webhooks) ? payload.webhooks.map(record) : [];
    const requiredEvents = [
      "message.received",
      "message.sent",
      "message.delivered",
      "message.bounced",
      "message.complained",
      "message.rejected",
    ];
    const existing = webhooks.find((webhook) => webhook.url === expectedUrl);
    let webhook = existing;
    let created = false;
    if (!webhook) {
      const createResponse = await fetch(
        `${baseUrl}/inboxes/${encodeURIComponent(inboxId)}/webhooks`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            url: expectedUrl,
            event_types: requiredEvents,
            client_id: "get-it-in-writing-production",
            headers: { Authorization: `Bearer ${webhookSecret}` },
          }),
        },
      );
      if (!createResponse.ok) {
        return {
          created: false,
          active: false,
          authenticated: false,
          failureStage: "create",
          failureStatus: createResponse.status,
        };
      }
      webhook = record(await createResponse.json());
      created = true;
    } else {
      const webhookId = typeof webhook.webhook_id === "string" ? webhook.webhook_id : "";
      if (!webhookId) {
        return {
          created: false,
          active: false,
          authenticated: false,
          failureStage: "identify",
        };
      }
      const updateResponse = await fetch(
        `${baseUrl}/inboxes/${encodeURIComponent(inboxId)}/webhooks/${encodeURIComponent(webhookId)}`,
        { method: "PATCH", headers, body: JSON.stringify({ event_types: requiredEvents }) },
      );
      if (!updateResponse.ok) {
        return {
          created: false,
          active: false,
          authenticated: false,
          failureStage: "update",
          failureStatus: updateResponse.status,
        };
      }
      webhook = record(await updateResponse.json());
      const authResponse = await fetch(
        `${baseUrl}/inboxes/${encodeURIComponent(inboxId)}/webhooks/${encodeURIComponent(webhookId)}/headers`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ headers: { Authorization: `Bearer ${webhookSecret}` } }),
        },
      );
      if (!authResponse.ok) {
        return {
          created: false,
          active: false,
          authenticated: false,
          failureStage: "headers",
          failureStatus: authResponse.status,
        };
      }
    }
    const events = Array.isArray(webhook.event_types) ? webhook.event_types : [];
    return {
      created,
      active: webhook.enabled === true && requiredEvents.every((event) => events.includes(event)),
      authenticated: true,
    };
  },
});
