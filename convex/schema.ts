import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
