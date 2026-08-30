import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  assessmentStatus,
  decisionCategory,
  decisionStatus,
  operationalFailure,
  outboundStatus,
  proofVerdict,
} from "./lib/decisionState";

export default defineSchema({
  ...authTables,
  teams: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerId: v.id("users"),
    // Kept only so older team rows remain valid. Current alerts always use the
    // authenticated owner's verified email.
    reviewEmail: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_ownerId", ["ownerId"]),
  memberships: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_teamId", ["teamId"])
    .index("by_userId_and_teamId", ["userId", "teamId"]),
  invitations: defineTable({
    teamId: v.id("teams"),
    email: v.string(),
    tokenHash: v.string(),
    invitedBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
    ),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_teamId", ["teamId"])
    .index("by_teamId_and_email", ["teamId", "email"])
    .index("by_teamId_and_email_and_status", ["teamId", "email", "status"]),
  webhookReceipts: defineTable({
    // Firecrawl is accepted only for historical receipts. Current webhooks are
    // AgentMail confirmation events; Firecrawl checks complete synchronously.
    provider: v.union(v.literal("firecrawl"), v.literal("agentmail")),
    deliveryId: v.string(),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
    receivedAt: v.number(),
  }).index("by_provider_and_deliveryId", ["provider", "deliveryId"]),
  decisions: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    sourceUrl: v.string(),
    sourceHost: v.string(),
    requirementText: v.string(),
    context: v.optional(v.string()),
    category: decisionCategory,
    status: decisionStatus,
    operationalFailure: v.optional(operationalFailure),
    operationalMessage: v.optional(v.string()),
    crawlId: v.optional(v.string()),
    researchStartedAt: v.optional(v.number()),
    analyzedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_updatedAt", ["ownerId", "updatedAt"])
    .index("by_ownerId_and_status_and_updatedAt", [
      "ownerId",
      "status",
      "updatedAt",
    ])
    .index("by_crawlId", ["crawlId"]),
  decisionRequirements: defineTable({
    decisionId: v.id("decisions"),
    ownerId: v.id("users"),
    text: v.string(),
    order: v.number(),
    createdAt: v.number(),
  }).index("by_decisionId_and_order", ["decisionId", "order"]),
  sourceDocuments: defineTable({
    decisionId: v.id("decisions"),
    crawlId: v.string(),
    url: v.string(),
    title: v.optional(v.string()),
    contentHash: v.string(),
    excerpt: v.string(),
    capturedAt: v.number(),
  })
    .index("by_decisionId_and_url", ["decisionId", "url"])
    .index("by_crawlId_and_url", ["crawlId", "url"]),
  claimAssessments: defineTable({
    decisionId: v.id("decisions"),
    requirementId: v.id("decisionRequirements"),
    status: assessmentStatus,
    statement: v.string(),
    reason: v.string(),
    sourceUrl: v.optional(v.string()),
    sourceTitle: v.optional(v.string()),
    sourceExcerpt: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_decisionId_and_order", ["decisionId", "order"])
    .index("by_requirementId", ["requirementId"]),
  officialContacts: defineTable({
    decisionId: v.id("decisions"),
    email: v.string(),
    label: v.string(),
    sourceUrl: v.string(),
    sourceExcerpt: v.string(),
    createdAt: v.number(),
  }).index("by_decisionId_and_createdAt", ["decisionId", "createdAt"]),
  confirmationRequests: defineTable({
    decisionId: v.id("decisions"),
    ownerId: v.id("users"),
    requestToken: v.string(),
    recipient: v.optional(v.string()),
    recipientSource: v.union(
      v.literal("official_page"),
      v.literal("user_provided"),
      v.literal("unselected"),
    ),
    recipientSourceUrl: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
    followUpCount: v.number(),
    status: outboundStatus,
    outboundId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_decisionId_and_createdAt", ["decisionId", "createdAt"])
    .index("by_requestToken", ["requestToken"])
    .index("by_outboundId", ["outboundId"])
    .index("by_messageId", ["messageId"])
    .index("by_threadId", ["threadId"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),
  confirmationReplies: defineTable({
    decisionId: v.id("decisions"),
    requestId: v.id("confirmationRequests"),
    messageId: v.string(),
    threadId: v.string(),
    sender: v.string(),
    subject: v.string(),
    body: v.string(),
    receivedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_requestId_and_receivedAt", ["requestId", "receivedAt"])
    .index("by_messageId", ["messageId"]),
  proofCards: defineTable({
    decisionId: v.id("decisions"),
    ownerId: v.id("users"),
    basis: v.union(v.literal("official_source"), v.literal("written_reply")),
    verdict: proofVerdict,
    exactRequirement: v.string(),
    summary: v.string(),
    conditions: v.array(v.string()),
    sourceUrls: v.array(v.string()),
    sourceExcerpts: v.array(v.string()),
    writtenMessage: v.optional(v.string()),
    suggestedFollowUp: v.optional(v.string()),
    recipient: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_decisionId", ["decisionId"]),
  decisionEvents: defineTable({
    decisionId: v.id("decisions"),
    fromStatus: v.optional(decisionStatus),
    toStatus: decisionStatus,
    label: v.string(),
    occurredAt: v.number(),
  }).index("by_decisionId_and_occurredAt", ["decisionId", "occurredAt"]),
  // The tables below belong to the retired lead-form monitor. They remain in
  // the schema so its existing deployment data is preserved, but no current
  // public function or route exposes them.
  businessProfiles: defineTable({
    teamId: v.id("teams"),
    websiteUrl: v.string(),
    displayName: v.string(),
    timezone: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_teamId", ["teamId"]),
  customerJourneys: defineTable({
    teamId: v.id("teams"),
    createdBy: v.id("users"),
    name: v.string(),
    kind: v.union(
      v.literal("contact"),
      v.literal("lead_form"),
      v.literal("quote_request"),
      v.literal("booking"),
      v.literal("signup"),
      v.literal("custom"),
    ),
    startUrl: v.string(),
    goal: v.string(),
    expectedSenderDomain: v.optional(v.string()),
    expectedReplyMinutes: v.number(),
    cadence: v.union(
      v.literal("manual"),
      v.literal("daily"),
      v.literal("weekly"),
    ),
    enabled: v.boolean(),
    authorizedAt: v.optional(v.number()),
    authorizedBy: v.optional(v.id("users")),
    status: v.union(
      v.literal("draft"),
      v.literal("running"),
      v.literal("healthy"),
      v.literal("incident"),
      v.literal("needs_review"),
      v.literal("error"),
    ),
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_teamId", ["teamId"])
    .index("by_teamId_and_updatedAt", ["teamId", "updatedAt"])
    .index("by_enabled_and_nextRunAt", ["enabled", "nextRunAt"]),
  journeySteps: defineTable({
    journeyId: v.id("customerJourneys"),
    order: v.number(),
    kind: v.union(
      v.literal("website"),
      v.literal("form"),
      v.literal("confirmation"),
      v.literal("human_reply"),
    ),
    label: v.string(),
    instruction: v.string(),
    createdAt: v.number(),
  }).index("by_journeyId_and_order", ["journeyId", "order"]),
  journeyRuns: defineTable({
    teamId: v.id("teams"),
    journeyId: v.id("customerJourneys"),
    trigger: v.union(v.literal("manual"), v.literal("scheduled")),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("waiting"),
      v.literal("healthy"),
      v.literal("incident"),
      v.literal("blocked"),
      v.literal("error"),
      v.literal("cancelled"),
    ),
    correlationToken: v.string(),
    summary: v.optional(v.string()),
    firecrawlScrapeId: v.optional(v.string()),
    evidenceUrl: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_journeyId_and_createdAt", ["journeyId", "createdAt"])
    .index("by_teamId_and_createdAt", ["teamId", "createdAt"])
    .index("by_correlationToken", ["correlationToken"])
    .index("by_status_and_startedAt", ["status", "startedAt"]),
  journeyCheckpoints: defineTable({
    runId: v.id("journeyRuns"),
    journeyId: v.id("customerJourneys"),
    order: v.number(),
    kind: v.union(
      v.literal("website"),
      v.literal("form"),
      v.literal("confirmation"),
      v.literal("human_reply"),
    ),
    label: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("failed"),
      v.literal("blocked"),
      v.literal("waiting"),
      v.literal("skipped"),
    ),
    detail: v.optional(v.string()),
    evidenceExcerpt: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_runId_and_order", ["runId", "order"]),
  journeyEmailExpectations: defineTable({
    teamId: v.id("teams"),
    journeyId: v.id("customerJourneys"),
    runId: v.id("journeyRuns"),
    inboxId: v.string(),
    correlationToken: v.string(),
    expectedSenderDomain: v.optional(v.string()),
    expectedKind: v.union(
      v.literal("confirmation"),
      v.literal("human_reply"),
    ),
    status: v.union(
      v.literal("waiting"),
      v.literal("received"),
      v.literal("expired"),
    ),
    deadlineAt: v.number(),
    receivedAt: v.optional(v.number()),
    senderDomain: v.optional(v.string()),
    messageId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_inboxId_and_status", ["inboxId", "status"])
    .index("by_runId", ["runId"])
    .index("by_messageId", ["messageId"])
    .index("by_status_and_deadlineAt", ["status", "deadlineAt"]),
  journeyIncidents: defineTable({
    teamId: v.id("teams"),
    journeyId: v.id("customerJourneys"),
    runId: v.id("journeyRuns"),
    checkpointKind: v.union(
      v.literal("website"),
      v.literal("form"),
      v.literal("confirmation"),
      v.literal("human_reply"),
    ),
    title: v.string(),
    detail: v.string(),
    severity: v.union(
      v.literal("broken"),
      v.literal("customer_waiting"),
      v.literal("degraded"),
    ),
    status: v.union(v.literal("open"), v.literal("resolved")),
    ownerLabel: v.optional(v.string()),
    resolutionNote: v.optional(v.string()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_teamId_and_status", ["teamId", "status"])
    .index("by_journeyId_and_status", ["journeyId", "status"])
    .index("by_runId", ["runId"]),
  journeyAlertDeliveries: defineTable({
    teamId: v.id("teams"),
    incidentId: v.optional(v.id("journeyIncidents")),
    kind: v.union(v.literal("incident"), v.literal("test")),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    attemptCount: v.number(),
    messageId: v.optional(v.string()),
    failureCode: v.optional(
      v.union(
        v.literal("configuration"),
        v.literal("recipient"),
        v.literal("delivery"),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_incidentId", ["incidentId"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"])
    .index("by_teamId_and_createdAt", ["teamId", "createdAt"]),
  publicJourneyReports: defineTable({
    slug: v.string(),
    teamId: v.id("teams"),
    journeyId: v.id("customerJourneys"),
    publishedBy: v.id("users"),
    publishedAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_journeyId", ["journeyId"])
    .index("by_journeyId_and_revokedAt", ["journeyId", "revokedAt"]),
  websiteAuditRequests: defineTable({
    websiteUrl: v.string(),
    emailHash: v.string(),
    tokenHash: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    claimedBy: v.optional(v.id("users")),
    claimedAt: v.optional(v.number()),
    testReference: v.optional(v.string()),
    status: v.union(
      v.literal("reserved"),
      v.literal("sent"),
      v.literal("claimed"),
      v.literal("failed"),
    ),
    messageId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_emailHash_and_createdAt", ["emailHash", "createdAt"])
    .index("by_tokenHash", ["tokenHash"]),
});
