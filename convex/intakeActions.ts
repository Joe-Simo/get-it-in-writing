"use node";

import { createHash } from "node:crypto";
import { AgentMailClient } from "agentmail";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { normalizePublicWebsiteUrl, websiteDomain } from "./lib/journeySafety";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const requestAudit = action({
  args: {
    websiteUrl: v.string(),
    email: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.object({ accepted: v.literal(true) }),
  handler: async (ctx, args) => {
    const websiteUrl = normalizePublicWebsiteUrl(args.websiteUrl);
    const email = args.email.trim().toLowerCase();
    if (!emailPattern.test(email) || email.length > 254) {
      throw new Error("Enter a valid work email");
    }
    const reference = (args.context ?? args.websiteUrl)
      .match(/\bSG-[A-F0-9]{8}\b/i)?.[0]
      .toUpperCase();
    const emailHash = createHash("sha256").update(email).digest("hex");
    const requestId = await ctx.runMutation(internal.intake.reserve, {
      websiteUrl,
      emailHash,
      ...(reference === undefined ? {} : { testReference: reference }),
    });
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    const appUrl = process.env.PUBLIC_APP_URL;
    if (!apiKey || !inboxId || !appUrl) {
      await ctx.runMutation(internal.intake.markFailed, { requestId });
      throw new Error("Email confirmation is temporarily unavailable");
    }
    const domain = websiteDomain(websiteUrl);
    const referenceLine = reference
      ? `\n\nJourney reference: ${reference}`
      : "";
    const client = new AgentMailClient({ apiKey });
    try {
      const message = await client.inboxes.messages.send(inboxId, {
        to: email,
        subject: `Set up daily lead-form monitoring for ${domain}`,
        text: `Signal Garden checks your public lead form every day and emails you if the page, form, or confirmation stops working.\n\nSet up your check: ${new URL("/app", appUrl).toString()}\n\nFree private beta. No card required. No test will run until you sign in, review the exact form, and confirm that you are authorized to test it.${referenceLine}`,
        html: `<main style="font-family:system-ui;max-width:620px;margin:auto;color:#111"><p style="font-size:12px;text-transform:uppercase;letter-spacing:.12em">Signal Garden</p><h1>Know when the lead form on ${escapeHtml(domain)} stops working.</h1><p>Signal Garden checks the public form every day and emails you if the page, submission, or confirmation fails.</p><p><a href="${escapeHtml(new URL("/app", appUrl).toString())}">Review and activate the check</a></p><p><strong>Free private beta. No card required.</strong></p><p style="color:#555">No test will run until you sign in, review the exact form, and confirm that you are authorized to test it.</p>${reference ? `<p>Check reference: ${escapeHtml(reference)}</p>` : ""}</main>`,
      });
      await ctx.runMutation(internal.intake.markSent, {
        requestId,
        messageId: message.messageId,
      });
      return { accepted: true as const };
    } catch (error) {
      await ctx.runMutation(internal.intake.markFailed, { requestId });
      throw error;
    }
  },
});
