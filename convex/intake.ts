import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { requireUserId } from "./model/auth";
import { websiteDomain } from "./lib/journeySafety";
import type { Id } from "./_generated/dataModel";

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function businessNameFromUrl(websiteUrl: string) {
  const firstLabel = websiteDomain(websiteUrl).split(".")[0] ?? "My business";
  const words = firstLabel
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const name = words
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
  return name.slice(0, 60) || "My business";
}

function slugBase(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "signal-team"
  );
}

export const reserve = internalMutation({
  args: {
    websiteUrl: v.string(),
    emailHash: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    testReference: v.optional(v.string()),
  },
  returns: v.id("websiteAuditRequests"),
  handler: async (ctx, args) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1_000;
    const recent = await ctx.db
      .query("websiteAuditRequests")
      .withIndex("by_emailHash_and_createdAt", (q) =>
        q.eq("emailHash", args.emailHash).gte("createdAt", oneHourAgo),
      )
      .take(3);
    if (recent.length >= 3) {
      throw new Error("Too many recent requests. Try again in an hour.");
    }
    const now = Date.now();
    return await ctx.db.insert("websiteAuditRequests", {
      websiteUrl: args.websiteUrl,
      emailHash: args.emailHash,
      tokenHash: args.tokenHash,
      expiresAt: args.expiresAt,
      ...(args.testReference === undefined
        ? {}
        : { testReference: args.testReference }),
      status: "reserved",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const markSent = internalMutation({
  args: {
    requestId: v.id("websiteAuditRequests"),
    messageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get("websiteAuditRequests", args.requestId);
    if (request !== null && request.status === "reserved") {
      await ctx.db.patch("websiteAuditRequests", request._id, {
        status: "sent",
        messageId: args.messageId,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const markFailed = internalMutation({
  args: { requestId: v.id("websiteAuditRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get("websiteAuditRequests", args.requestId);
    if (request !== null && request.status === "reserved") {
      await ctx.db.patch("websiteAuditRequests", request._id, {
        status: "failed",
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const claimSetup = mutation({
  args: { token: v.string() },
  returns: v.object({
    teamId: v.id("teams"),
    websiteUrl: v.string(),
    businessName: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const token = args.token.trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new Error("This setup link is invalid or expired");
    }
    const tokenHash = await hash(token);
    const request = await ctx.db
      .query("websiteAuditRequests")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    const now = Date.now();
    if (
      request === null ||
      !["sent", "claimed"].includes(request.status) ||
      request.expiresAt === undefined ||
      request.expiresAt <= now
    ) {
      throw new Error("This setup link is invalid or expired");
    }
    const user = await ctx.db.get("users", userId);
    if (
      !user?.email ||
      (await hash(user.email.trim().toLowerCase())) !== request.emailHash
    ) {
      throw new Error("Sign in with the email address that received this setup link");
    }
    if (request.claimedBy !== undefined && request.claimedBy !== userId) {
      throw new Error("This setup link has already been used");
    }

    const ownedTeams = await ctx.db
      .query("teams")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
      .take(2);
    let teamId: Id<"teams"> | undefined = ownedTeams[0]?._id;
    const businessName = businessNameFromUrl(request.websiteUrl);
    if (teamId === undefined) {
      const base = slugBase(businessName);
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
      teamId = await ctx.db.insert("teams", {
        name: businessName,
        slug,
        ownerId: userId,
        createdAt: now,
      });
      await ctx.db.insert("memberships", {
        teamId,
        userId,
        role: "owner",
        joinedAt: now,
      });
    }

    const profile = await ctx.db
      .query("businessProfiles")
      .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
      .unique();
    if (
      profile !== null &&
      websiteDomain(profile.websiteUrl) !== websiteDomain(request.websiteUrl)
    ) {
      throw new Error("This private beta already monitors a different website");
    }
    if (profile === null) {
      await ctx.db.insert("businessProfiles", {
        teamId,
        websiteUrl: request.websiteUrl,
        displayName: businessName,
        timezone: "UTC",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (request.status !== "claimed") {
      await ctx.db.patch("websiteAuditRequests", request._id, {
        status: "claimed",
        claimedBy: userId,
        claimedAt: now,
        updatedAt: now,
      });
    }
    return {
      teamId,
      websiteUrl: request.websiteUrl,
      businessName: profile?.displayName ?? businessName,
    };
  },
});
