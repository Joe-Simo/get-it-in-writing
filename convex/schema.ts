import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const missionStatus = v.union(
  v.literal("draft"),
  v.literal("crawling"),
  v.literal("extracting"),
  v.literal("synthesizing"),
  v.literal("ready"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const seedStatus = v.union(
  v.literal("queued"),
  v.literal("crawling"),
  v.literal("processing"),
  v.literal("complete"),
  v.literal("failed"),
);

export default defineSchema({
  ...authTables,
  teams: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerId: v.id("users"),
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
  missions: defineTable({
    teamId: v.id("teams"),
    createdBy: v.id("users"),
    question: v.string(),
    workflowKind: v.optional(
      v.union(v.literal("research"), v.literal("prebid")),
    ),
    opportunityTitle: v.optional(v.string()),
    solicitationUrl: v.optional(v.string()),
    solicitationNumber: v.optional(v.string()),
    agency: v.optional(v.string()),
    bidDueAt: v.optional(v.number()),
    decision: v.optional(
      v.union(v.literal("undecided"), v.literal("bid"), v.literal("no_bid")),
    ),
    decisionRationale: v.optional(v.string()),
    reviewState: v.optional(
      v.union(v.literal("current"), v.literal("change_detected")),
    ),
    lastPackageCheckedAt: v.optional(v.number()),
    releaseState: v.optional(
      v.union(v.literal("blocked"), v.literal("ready"), v.literal("approved")),
    ),
    releaseApprovedAt: v.optional(v.number()),
    releaseApprovedBy: v.optional(v.id("users")),
    status: missionStatus,
    pageBudget: v.number(),
    depth: v.number(),
    pagesProcessed: v.number(),
    sourceCount: v.number(),
    claimCount: v.number(),
    workflowId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_teamId", ["teamId"])
    .index("by_teamId_and_updatedAt", ["teamId", "updatedAt"]),
  missionSeeds: defineTable({
    missionId: v.id("missions"),
    url: v.string(),
    pageLimit: v.number(),
    status: seedStatus,
    submissionKey: v.optional(v.string()),
    crawlJobId: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_missionId", ["missionId"])
    .index("by_crawlJobId", ["crawlJobId"]),
  sources: defineTable({
    missionId: v.id("missions"),
    url: v.string(),
    title: v.string(),
    excerpt: v.string(),
    content: v.string(),
    sourceHash: v.string(),
    kind: v.optional(
      v.union(
        v.literal("notice"),
        v.literal("attachment"),
        v.literal("amendment"),
        v.literal("reference"),
      ),
    ),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    parentUrl: v.optional(v.string()),
    retrievedAt: v.number(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_missionId_and_sourceHash", ["missionId", "sourceHash"]),
  claims: defineTable({
    missionId: v.id("missions"),
    text: v.string(),
    summary: v.string(),
    topic: v.string(),
    status: v.union(
      v.literal("supported"),
      v.literal("disputed"),
      v.literal("unresolved"),
    ),
    confidence: v.number(),
    corroborationCount: v.number(),
    positionX: v.number(),
    positionY: v.number(),
    createdAt: v.number(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_missionId_and_status", ["missionId", "status"]),
  claimSources: defineTable({
    missionId: v.id("missions"),
    claimId: v.id("claims"),
    sourceId: v.id("sources"),
    quote: v.string(),
    support: v.union(
      v.literal("supports"),
      v.literal("challenges"),
      v.literal("context"),
    ),
  })
    .index("by_claimId", ["claimId"])
    .index("by_sourceId", ["sourceId"])
    .index("by_missionId", ["missionId"]),
  claimNotes: defineTable({
    missionId: v.id("missions"),
    claimId: v.id("claims"),
    authorId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_claimId", ["claimId"])
    .index("by_missionId", ["missionId"]),
  requirements: defineTable({
    missionId: v.id("missions"),
    sourceId: v.id("sources"),
    claimId: v.id("claims"),
    text: v.string(),
    category: v.union(
      v.literal("submission"),
      v.literal("bonding"),
      v.literal("insurance"),
      v.literal("eligibility"),
      v.literal("labor"),
      v.literal("safety"),
      v.literal("schedule"),
      v.literal("technical"),
      v.literal("pricing"),
      v.literal("other"),
    ),
    criticality: v.union(
      v.literal("disqualifier"),
      v.literal("high"),
      v.literal("standard"),
    ),
    status: v.union(
      v.literal("open"),
      v.literal("satisfied"),
      v.literal("missing"),
      v.literal("not_applicable"),
    ),
    requiredWithBid: v.boolean(),
    sourceQuote: v.string(),
    dueDateText: v.optional(v.string()),
    ownerLabel: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_missionId_and_status", ["missionId", "status"])
    .index("by_claimId", ["claimId"]),
  constructionOverrides: defineTable({
    missionId: v.id("missions"),
    ruleKey: v.string(),
    status: v.union(v.literal("resolved"), v.literal("not_applicable")),
    ownerLabel: v.optional(v.string()),
    note: v.optional(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_missionId_and_ruleKey", ["missionId", "ruleKey"]),
  missionWatches: defineTable({
    missionId: v.id("missions"),
    teamId: v.id("teams"),
    recipientEmail: v.string(),
    enabled: v.boolean(),
    frequency: v.literal("daily"),
    lastSourceHash: v.optional(v.string()),
    lastCheckedAt: v.optional(v.number()),
    nextCheckAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_enabled_and_nextCheckAt", ["enabled", "nextCheckAt"]),
  changeEvents: defineTable({
    missionId: v.id("missions"),
    watchId: v.id("missionWatches"),
    previousHash: v.optional(v.string()),
    currentHash: v.string(),
    summary: v.string(),
    previousSnapshotId: v.optional(v.id("packageSnapshots")),
    currentSnapshotId: v.optional(v.id("packageSnapshots")),
    addedText: v.optional(v.string()),
    removedText: v.optional(v.string()),
    status: v.union(v.literal("detected"), v.literal("reviewed")),
    detectedAt: v.number(),
    notifiedAt: v.optional(v.number()),
  })
    .index("by_missionId", ["missionId"])
    .index("by_watchId", ["watchId"])
    .index("by_watchId_and_status", ["watchId", "status"]),
  packageSnapshots: defineTable({
    missionId: v.id("missions"),
    watchId: v.id("missionWatches"),
    version: v.number(),
    sourceHash: v.string(),
    markdown: v.string(),
    linkInventory: v.array(v.string()),
    trigger: v.union(
      v.literal("baseline"),
      v.literal("scheduled"),
      v.literal("manual"),
    ),
    capturedAt: v.number(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_watchId", ["watchId"])
    .index("by_missionId_and_version", ["missionId", "version"]),
  changeImpacts: defineTable({
    missionId: v.id("missions"),
    changeEventId: v.id("changeEvents"),
    title: v.string(),
    detail: v.string(),
    area: v.union(
      v.literal("deadline"),
      v.literal("scope"),
      v.literal("pricing"),
      v.literal("trade"),
      v.literal("forms"),
      v.literal("bonding"),
      v.literal("schedule"),
      v.literal("site_access"),
      v.literal("other"),
    ),
    severity: v.union(
      v.literal("blocking"),
      v.literal("high"),
      v.literal("standard"),
    ),
    status: v.union(
      v.literal("open"),
      v.literal("waiting"),
      v.literal("cleared"),
      v.literal("not_applicable"),
    ),
    blocksRelease: v.boolean(),
    sourceQuote: v.string(),
    ownerLabel: v.optional(v.string()),
    resolutionNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_changeEventId", ["changeEventId"])
    .index("by_missionId_and_status", ["missionId", "status"]),
  bidContacts: defineTable({
    teamId: v.id("teams"),
    name: v.string(),
    email: v.string(),
    trade: v.string(),
    company: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_teamId", ["teamId"])
    .index("by_teamId_and_email", ["teamId", "email"]),
  outreachThreads: defineTable({
    missionId: v.id("missions"),
    impactId: v.id("changeImpacts"),
    contactId: v.id("bidContacts"),
    subject: v.string(),
    question: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("replied"),
      v.literal("closed"),
    ),
    deliveryId: v.optional(v.id("emailDeliveries")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_impactId", ["impactId"])
    .index("by_contactId", ["contactId"]),
  briefs: defineTable({
    missionId: v.id("missions"),
    teamId: v.id("teams"),
    createdBy: v.id("users"),
    title: v.string(),
    summary: v.string(),
    body: v.string(),
    status: v.union(v.literal("draft"), v.literal("ready")),
    createdAt: v.number(),
  })
    .index("by_missionId", ["missionId"])
    .index("by_teamId", ["teamId"]),
  publicGardens: defineTable({
    slug: v.string(),
    missionId: v.id("missions"),
    teamId: v.id("teams"),
    publishedBy: v.id("users"),
    publishedAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_missionId", ["missionId"]),
  missionEvents: defineTable({
    missionId: v.id("missions"),
    type: v.union(
      v.literal("mission"),
      v.literal("crawl"),
      v.literal("source"),
      v.literal("claim"),
      v.literal("brief"),
      v.literal("email"),
      v.literal("watch"),
      v.literal("release"),
      v.literal("impact"),
    ),
    label: v.string(),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_missionId", ["missionId"]),
  emailDeliveries: defineTable({
    teamId: v.id("teams"),
    missionId: v.id("missions"),
    briefId: v.optional(v.id("briefs")),
    purpose: v.optional(
      v.union(v.literal("brief"), v.literal("impact_followup")),
    ),
    impactId: v.optional(v.id("changeImpacts")),
    contactId: v.optional(v.id("bidContacts")),
    recipientEmail: v.string(),
    inboxId: v.string(),
    messageId: v.string(),
    threadId: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
    ),
    createdAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_missionId", ["missionId"]),
  inboundReplies: defineTable({
    deliveryId: v.id("emailDeliveries"),
    missionId: v.optional(v.id("missions")),
    messageId: v.string(),
    senderEmail: v.string(),
    intent: v.union(
      v.literal("comment"),
      v.literal("question"),
      v.literal("refresh_request"),
      v.literal("unrecognized"),
    ),
    body: v.string(),
    status: v.union(v.literal("pending"), v.literal("reviewed")),
    receivedAt: v.number(),
  })
    .index("by_messageId", ["messageId"])
    .index("by_deliveryId", ["deliveryId"])
    .index("by_missionId", ["missionId"]),
  webhookReceipts: defineTable({
    provider: v.union(v.literal("firecrawl"), v.literal("agentmail")),
    deliveryId: v.string(),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
    receivedAt: v.number(),
  }).index("by_provider_and_deliveryId", ["provider", "deliveryId"]),
});
