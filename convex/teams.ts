import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireTeamMember, requireUserId } from "./model/auth";
import type { Id } from "./_generated/dataModel";

const teamSummary = v.object({
  _id: v.id("teams"),
  name: v.string(),
  slug: v.string(),
  role: v.union(v.literal("owner"), v.literal("member")),
});

export const listMine = query({
  args: {},
  returns: v.array(teamSummary),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(20);
    const teams = await Promise.all(
      memberships.map(async (membership) => ({
        membership,
        team: await ctx.db.get("teams", membership.teamId),
      })),
    );
    return teams.flatMap(({ team, membership }) =>
      team === null
        ? []
        : [
            {
              _id: team._id,
              name: team.name,
              slug: team.slug,
              role: membership.role,
            },
          ],
    );
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existingOwnedTeam = await ctx.db
      .query("teams")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
      .first();
    if (existingOwnedTeam !== null) {
      throw new Error("The private beta supports one website workspace per owner");
    }
    const name = args.name.trim();
    if (name.length < 2 || name.length > 60) {
      throw new Error("Team name must be between 2 and 60 characters");
    }
    const base =
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 36) || "signal-team";
    let slug = base;
    let suffix = 1;
    while (
      (await ctx.db
        .query("teams")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()) !== null
    ) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    const createdAt = Date.now();
    const teamId = await ctx.db.insert("teams", {
      name,
      slug,
      ownerId: userId,
      createdAt,
    });
    await ctx.db.insert("memberships", {
      teamId,
      userId,
      role: "owner",
      joinedAt: createdAt,
    });
    return teamId;
  },
});

const memberSummary = v.object({
  userId: v.id("users"),
  email: v.string(),
  role: v.union(v.literal("owner"), v.literal("member")),
});

export const listMembers = query({
  args: { teamId: v.id("teams") },
  returns: v.array(memberSummary),
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .take(50);
    const members = await Promise.all(
      memberships.map(async (membership) => ({
        membership,
        user: await ctx.db.get("users", membership.userId),
      })),
    );
    return members.flatMap(({ membership, user }) =>
      user?.email
        ? [
            {
              userId: membership.userId,
              email: user.email,
              role: membership.role,
            },
          ]
        : [],
    );
  },
});

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export const createInvitation = internalMutation({
  args: {
    teamId: v.id("teams"),
    requesterId: v.id("users"),
    email: v.string(),
  },
  returns: v.object({
    invitationId: v.id("invitations"),
    token: v.string(),
    teamName: v.string(),
    email: v.string(),
  }),
  handler: async (ctx, args) => {
    const team = await ctx.db.get("teams", args.teamId);
    if (team === null) throw new Error("Team not found");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_teamId", (q) =>
        q.eq("userId", args.requesterId).eq("teamId", args.teamId),
      )
      .unique();
    if (membership?.role !== "owner")
      throw new Error("Only team owners can invite members");
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Enter a valid email address");
    const pending = await ctx.db
      .query("invitations")
      .withIndex("by_teamId_and_email_and_status", (q) =>
        q.eq("teamId", args.teamId).eq("email", email).eq("status", "pending"),
      )
      .take(20);
    await Promise.all(
      pending.map((invite) =>
        ctx.db.patch("invitations", invite._id, { status: "revoked" as const }),
      ),
    );
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(
      /-/g,
      "",
    );
    const invitationId = await ctx.db.insert("invitations", {
      teamId: args.teamId,
      email,
      tokenHash: await hashToken(token),
      invitedBy: args.requesterId,
      status: "pending",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1_000,
      createdAt: Date.now(),
    });
    return { invitationId, token, teamName: team.name, email };
  },
});

export const revokeInvitation = internalMutation({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get("invitations", args.invitationId);
    if (invitation !== null && invitation.status === "pending") {
      await ctx.db.patch("invitations", args.invitationId, {
        status: "revoked",
      });
    }
    return null;
  },
});

export const acceptInvitation = mutation({
  args: { token: v.string() },
  returns: v.id("teams"),
  handler: async (ctx, args): Promise<Id<"teams">> => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get("users", userId);
    if (!user?.email)
      throw new Error("Your account needs a verified email address");
    const tokenHash = await hashToken(args.token);
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (
      invitation === null ||
      invitation.status !== "pending" ||
      invitation.expiresAt <= Date.now()
    ) {
      throw new Error("This invitation is invalid or expired");
    }
    if (invitation.email !== user.email.toLowerCase()) {
      throw new Error(
        "Sign in with the email address that received this invitation",
      );
    }
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_teamId", (q) =>
        q.eq("userId", userId).eq("teamId", invitation.teamId),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("memberships", {
        teamId: invitation.teamId,
        userId,
        role: "member",
        joinedAt: Date.now(),
      });
    }
    await ctx.db.patch("invitations", invitation._id, { status: "accepted" });
    return invitation.teamId;
  },
});
