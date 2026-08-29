import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireMissionMember } from "./model/auth";

export const addClaimNote = mutation({
  args: {
    missionId: v.id("missions"),
    claimId: v.id("claims"),
    body: v.string(),
  },
  returns: v.id("claimNotes"),
  handler: async (ctx, args) => {
    const { userId } = await requireMissionMember(ctx, args.missionId);
    const claim = await ctx.db.get("claims", args.claimId);
    if (claim === null || claim.missionId !== args.missionId) {
      throw new Error("Claim does not belong to this mission");
    }
    const body = args.body.trim();
    if (body.length < 2 || body.length > 1_000) {
      throw new Error("Notes must be between 2 and 1,000 characters");
    }
    const createdAt = Date.now();
    const noteId = await ctx.db.insert("claimNotes", {
      missionId: args.missionId,
      claimId: args.claimId,
      authorId: userId,
      body,
      createdAt,
    });
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "claim",
      label: "Evidence note added",
      detail: "A collaborator annotated a claim for team review.",
      createdAt,
    });
    return noteId;
  },
});

export const markReplyReviewed = mutation({
  args: {
    missionId: v.id("missions"),
    replyId: v.id("inboundReplies"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMissionMember(ctx, args.missionId);
    const reply = await ctx.db.get("inboundReplies", args.replyId);
    if (reply === null) throw new Error("Reply not found");
    const delivery = await ctx.db.get("emailDeliveries", reply.deliveryId);
    if (delivery === null || delivery.missionId !== args.missionId) {
      throw new Error("Reply does not belong to this mission");
    }
    if (reply.status === "reviewed") return null;
    const reviewedAt = Date.now();
    await ctx.db.patch("inboundReplies", args.replyId, { status: "reviewed" });
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "email",
      label: "Email reply reviewed",
      detail: "A collaborator completed the manual review step.",
      createdAt: reviewedAt,
    });
    return null;
  },
});
