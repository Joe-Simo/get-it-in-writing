"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { AgentMailClient } from "agentmail";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

export const inviteMember = action({
  args: { teamId: v.id("teams"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const requesterId = await getAuthUserId(ctx);
    if (requesterId === null) throw new Error("401: sign in required");
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    const publicAppUrl = process.env.PUBLIC_APP_URL;
    if (!apiKey || !inboxId || !publicAppUrl) {
      throw new Error("AgentMail invitations are not configured for this deployment");
    }
    const invitation = await ctx.runMutation(internal.teams.createInvitation, {
      teamId: args.teamId,
      requesterId,
      email: args.email,
    });
    const invitationUrl = new URL("/app", publicAppUrl);
    invitationUrl.searchParams.set("invite", invitation.token);
    const client = new AgentMailClient({ apiKey });
    try {
      await client.inboxes.messages.send(inboxId, {
        to: invitation.email,
        subject: `Join ${invitation.teamName} on Signal Garden`,
        text: `You were invited to join ${invitation.teamName} on Signal Garden. Open this private invitation within seven days:\n\n${invitationUrl.toString()}`,
        html: `<main style="font-family:system-ui;max-width:620px;margin:auto;color:#111"><p style="font-size:12px;text-transform:uppercase;letter-spacing:.12em">Signal Garden invitation</p><h1>Join ${escapeHtml(invitation.teamName)}</h1><p>This private invitation expires in seven days.</p><p><a href="${escapeHtml(invitationUrl.toString())}">Open Signal Garden</a></p></main>`,
      });
    } catch (error) {
      await ctx.runMutation(internal.teams.revokeInvitation, { invitationId: invitation.invitationId });
      throw error;
    }
    return null;
  },
});
