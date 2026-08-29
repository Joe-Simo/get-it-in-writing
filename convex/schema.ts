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
    ),
    label: v.string(),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_missionId", ["missionId"]),
  emailDeliveries: defineTable({
    teamId: v.id("teams"),
    missionId: v.id("missions"),
    briefId: v.id("briefs"),
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
