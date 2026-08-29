import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMissionMember, requireTeamMember } from "./model/auth";

const readinessResult = v.object({
  openai: v.boolean(),
  firecrawl: v.boolean(),
  agentMail: v.boolean(),
  invitationLinks: v.boolean(),
  researchReady: v.boolean(),
  collaborationReady: v.boolean(),
});

function currentReadiness() {
  const openai = Boolean(process.env.OPENAI_API_KEY);
  const firecrawl = Boolean(
    process.env.FIRECRAWL_API_KEY &&
      process.env.FIRECRAWL_WEBHOOK_SECRET,
  );
  const agentMail = Boolean(
    process.env.AGENTMAIL_API_KEY &&
      process.env.AGENTMAIL_INBOX_ID &&
      process.env.AGENTMAIL_WEBHOOK_SECRET,
  );
  const invitationLinks = agentMail && Boolean(process.env.PUBLIC_APP_URL);
  return {
    openai,
    firecrawl,
    agentMail,
    invitationLinks,
    researchReady: openai && firecrawl,
    collaborationReady: agentMail && invitationLinks,
  };
}

export const forTeam = query({
  args: { teamId: v.id("teams") },
  returns: readinessResult,
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId);
    return currentReadiness();
  },
});

export const forMission = query({
  args: { missionId: v.id("missions") },
  returns: readinessResult,
  handler: async (ctx, args) => {
    await requireMissionMember(ctx, args.missionId);
    return currentReadiness();
  },
});
