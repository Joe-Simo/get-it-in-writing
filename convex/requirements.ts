import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireMissionMember } from "./model/auth";

const requirementStatus = v.union(
  v.literal("open"),
  v.literal("satisfied"),
  v.literal("missing"),
  v.literal("not_applicable"),
);

const decision = v.union(
  v.literal("undecided"),
  v.literal("bid"),
  v.literal("no_bid"),
);

function optionalText(
  value: string | undefined,
  field: string,
  maximumLength: number,
) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length > maximumLength) {
    throw new Error(`${field} must be ${maximumLength} characters or fewer`);
  }
  return trimmed || undefined;
}

export const update = mutation({
  args: {
    requirementId: v.id("requirements"),
    status: v.optional(requirementStatus),
    ownerLabel: v.optional(v.string()),
    dueDateText: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get("requirements", args.requirementId);
    if (requirement === null) throw new Error("Requirement not found");
    await requireMissionMember(ctx, requirement.missionId);

    const ownerLabel = optionalText(args.ownerLabel, "Owner", 80);
    const dueDateText = optionalText(args.dueDateText, "Due date", 120);
    const note = optionalText(args.note, "Note", 1_000);
    if (
      args.status === undefined &&
      args.ownerLabel === undefined &&
      args.dueDateText === undefined &&
      args.note === undefined
    ) {
      throw new Error("Choose at least one requirement change");
    }

    const now = Date.now();
    await ctx.db.patch("requirements", args.requirementId, {
      ...(args.status === undefined ? {} : { status: args.status }),
      ...(args.ownerLabel === undefined ? {} : { ownerLabel }),
      ...(args.dueDateText === undefined ? {} : { dueDateText }),
      ...(args.note === undefined ? {} : { note }),
      updatedAt: now,
    });
    await ctx.db.patch("missions", requirement.missionId, { updatedAt: now });
    return null;
  },
});

export const setDecision = mutation({
  args: {
    missionId: v.id("missions"),
    decision,
    rationale: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { mission } = await requireMissionMember(ctx, args.missionId);
    const rationale = optionalText(args.rationale, "Decision rationale", 2_000);
    if (
      mission.decision === args.decision &&
      mission.decisionRationale === rationale
    ) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch("missions", args.missionId, {
      decision: args.decision,
      decisionRationale: rationale,
      updatedAt: now,
    });
    await ctx.db.insert("missionEvents", {
      missionId: args.missionId,
      type: "mission",
      label:
        args.decision === "bid"
          ? "Bid decision recorded"
          : args.decision === "no_bid"
            ? "No-bid decision recorded"
            : "Bid decision reopened",
      ...(rationale === undefined ? {} : { detail: rationale.slice(0, 500) }),
      createdAt: now,
    });
    return null;
  },
});
