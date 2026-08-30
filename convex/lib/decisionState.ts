import { v } from "convex/values";

export const decisionStatus = v.union(
  v.literal("draft"),
  v.literal("scoping"),
  v.literal("researching"),
  v.literal("analyzing"),
  v.literal("fully_established"),
  v.literal("confirmation_available"),
  v.literal("drafting_confirmation"),
  v.literal("awaiting_approval"),
  v.literal("sending"),
  v.literal("waiting"),
  v.literal("reply_received"),
  v.literal("interpreting_reply"),
  v.literal("confirmed"),
  v.literal("confirmed_with_conditions"),
  v.literal("partially_confirmed"),
  v.literal("not_confirmed"),
  v.literal("needs_followup"),
  v.literal("declined"),
);

export const decisionCategory = v.union(
  v.literal("hotel"),
  v.literal("apartment"),
  v.literal("venue"),
  v.literal("product"),
  v.literal("contractor"),
  v.literal("storage"),
  v.literal("rental"),
  v.literal("other"),
);

export const assessmentStatus = v.union(
  v.literal("established"),
  v.literal("conditional"),
  v.literal("conflicting"),
  v.literal("scope_mismatch"),
  // Kept for rows produced by the first Get It in Writing deployment.
  v.literal("vague_or_conditional"),
  v.literal("not_established"),
);

export const requirementImportance = v.union(
  v.literal("critical"),
  v.literal("important"),
  v.literal("preference"),
);

export const ambiguityKind = v.union(
  v.literal("missing"),
  v.literal("conditional"),
  v.literal("conflicting"),
  v.literal("scope_mismatch"),
  v.literal("non_guarantee"),
);

export const evidenceStrength = v.union(
  v.literal("direct"),
  v.literal("qualified"),
  v.literal("conflicting"),
  v.literal("insufficient"),
);

export const proofVerdict = v.union(
  v.literal("confirmed"),
  v.literal("confirmed_with_conditions"),
  v.literal("partially_confirmed"),
  v.literal("not_confirmed"),
  v.literal("needs_followup"),
  v.literal("declined"),
);

export const operationalFailure = v.union(
  v.literal("unsupported_decision"),
  v.literal("research_failed"),
  v.literal("analysis_failed"),
  v.literal("delivery_failed"),
  v.literal("reply_processing_failed"),
);

export const outboundStatus = v.union(
  v.literal("draft"),
  v.literal("pending"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("bounced"),
  v.literal("complained"),
  v.literal("rejected"),
  v.literal("failed"),
);
