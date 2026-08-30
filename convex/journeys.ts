import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireTeamMember } from "./model/auth";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  boundedPlainText,
  normalizePublicWebsiteUrl,
  safeSlug,
  websiteDomain,
} from "./lib/journeySafety";

const journeyKind = v.union(
  v.literal("contact"),
  v.literal("lead_form"),
  v.literal("quote_request"),
  v.literal("booking"),
  v.literal("signup"),
  v.literal("custom"),
);

const cadence = v.union(
  v.literal("manual"),
  v.literal("daily"),
  v.literal("weekly"),
);

const checkpointKind = v.union(
  v.literal("website"),
  v.literal("form"),
  v.literal("confirmation"),
  v.literal("human_reply"),
);

const checkpointStatus = v.union(
  v.literal("pending"),
  v.literal("verified"),
  v.literal("failed"),
  v.literal("waiting"),
  v.literal("skipped"),
);

const runStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("waiting"),
  v.literal("healthy"),
  v.literal("incident"),
  v.literal("error"),
  v.literal("cancelled"),
);

const journeyStatus = v.union(
  v.literal("draft"),
  v.literal("running"),
  v.literal("healthy"),
  v.literal("incident"),
  v.literal("error"),
);

const journeySummary = v.object({
  _id: v.id("customerJourneys"),
  name: v.string(),
  kind: journeyKind,
  startUrl: v.string(),
  goal: v.string(),
  cadence,
  enabled: v.boolean(),
  status: journeyStatus,
  lastRunAt: v.optional(v.number()),
  nextRunAt: v.optional(v.number()),
  updatedAt: v.number(),
  openIncidentCount: v.number(),
  latestRun: v.optional(
    v.object({
      _id: v.id("journeyRuns"),
      status: runStatus,
      summary: v.optional(v.string()),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
    }),
  ),
});

const stepView = v.object({
  _id: v.id("journeySteps"),
  order: v.number(),
  kind: checkpointKind,
  label: v.string(),
  instruction: v.string(),
});

const checkpointView = v.object({
  _id: v.id("journeyCheckpoints"),
  order: v.number(),
  kind: checkpointKind,
  label: v.string(),
  status: checkpointStatus,
  detail: v.optional(v.string()),
  evidenceExcerpt: v.optional(v.string()),
  occurredAt: v.optional(v.number()),
});

const runView = v.object({
  _id: v.id("journeyRuns"),
  trigger: v.union(v.literal("manual"), v.literal("scheduled")),
  status: runStatus,
  summary: v.optional(v.string()),
  evidenceUrl: v.optional(v.string()),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  checkpoints: v.array(checkpointView),
});

const incidentView = v.object({
  _id: v.id("journeyIncidents"),
  runId: v.id("journeyRuns"),
  checkpointKind,
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
});

function nextRunAt(cadenceValue: "manual" | "daily" | "weekly", now: number) {
  if (cadenceValue === "manual") return undefined;
  return now + (cadenceValue === "daily" ? 24 : 7 * 24) * 60 * 60 * 1_000;
}

export const getBusiness = query({
  args: { teamId: v.id("teams") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("businessProfiles"),
      websiteUrl: v.string(),
      displayName: v.string(),
      timezone: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId);
    const profile = await ctx.db
      .query("businessProfiles")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .unique();
    if (profile === null) return null;
    return {
      _id: profile._id,
      websiteUrl: profile.websiteUrl,
      displayName: profile.displayName,
      timezone: profile.timezone,
    };
  },
});

export const upsertBusiness = mutation({
  args: {
    teamId: v.id("teams"),
    websiteUrl: v.string(),
    displayName: v.string(),
    timezone: v.string(),
  },
  returns: v.id("businessProfiles"),
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId);
    const websiteUrl = normalizePublicWebsiteUrl(args.websiteUrl);
    const displayName = boundedPlainText(args.displayName, "Business name", 80);
    const timezone = boundedPlainText(args.timezone, "Timezone", 80);
    const existing = await ctx.db
      .query("businessProfiles")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .unique();
    const now = Date.now();
    if (existing !== null) {
      await ctx.db.patch("businessProfiles", existing._id, {
        websiteUrl,
        displayName,
        timezone,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("businessProfiles", {
      teamId: args.teamId,
      websiteUrl,
      displayName,
      timezone,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: { teamId: v.id("teams") },
  returns: v.array(journeySummary),
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId);
    const journeys = await ctx.db
      .query("customerJourneys")
      .withIndex("by_teamId_and_updatedAt", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .take(50);
    return await Promise.all(
      journeys.map(async (journey) => {
        const [latestRun, openIncidents] = await Promise.all([
          ctx.db
            .query("journeyRuns")
            .withIndex("by_journeyId_and_createdAt", (q) =>
              q.eq("journeyId", journey._id),
            )
            .order("desc")
            .first(),
          ctx.db
            .query("journeyIncidents")
            .withIndex("by_journeyId_and_status", (q) =>
              q.eq("journeyId", journey._id).eq("status", "open"),
            )
            .take(20),
        ]);
        return {
          _id: journey._id,
          name: journey.name,
          kind: journey.kind,
          startUrl: journey.startUrl,
          goal: journey.goal,
          cadence: journey.cadence,
          enabled: journey.enabled,
          status: journey.status,
          ...(journey.lastRunAt === undefined
            ? {}
            : { lastRunAt: journey.lastRunAt }),
          ...(journey.nextRunAt === undefined
            ? {}
            : { nextRunAt: journey.nextRunAt }),
          updatedAt: journey.updatedAt,
          openIncidentCount: openIncidents.length,
          ...(latestRun === null
            ? {}
            : {
                latestRun: {
                  _id: latestRun._id,
                  status: latestRun.status,
                  ...(latestRun.summary === undefined
                    ? {}
                    : { summary: latestRun.summary }),
                  startedAt: latestRun.startedAt,
                  ...(latestRun.completedAt === undefined
                    ? {}
                    : { completedAt: latestRun.completedAt }),
                },
              }),
        };
      }),
    );
  },
});

export const get = query({
  args: { journeyId: v.id("customerJourneys") },
  returns: v.object({
    journey: v.object({
      _id: v.id("customerJourneys"),
      teamId: v.id("teams"),
      name: v.string(),
      kind: journeyKind,
      startUrl: v.string(),
      goal: v.string(),
      expectedSenderDomain: v.optional(v.string()),
      expectedReplyMinutes: v.number(),
      cadence,
      enabled: v.boolean(),
      status: journeyStatus,
      lastRunAt: v.optional(v.number()),
      nextRunAt: v.optional(v.number()),
    }),
    steps: v.array(stepView),
    runs: v.array(runView),
    incidents: v.array(incidentView),
    publicSlug: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const journey = await ctx.db.get("customerJourneys", args.journeyId);
    if (journey === null) throw new Error("404: journey not found");
    await requireTeamMember(ctx, journey.teamId);
    const [steps, runs, incidents, publicReport] = await Promise.all([
      ctx.db
        .query("journeySteps")
        .withIndex("by_journeyId_and_order", (q) =>
          q.eq("journeyId", journey._id),
        )
        .take(10),
      ctx.db
        .query("journeyRuns")
        .withIndex("by_journeyId_and_createdAt", (q) =>
          q.eq("journeyId", journey._id),
        )
        .order("desc")
        .take(20),
      ctx.db
        .query("journeyIncidents")
        .withIndex("by_journeyId_and_status", (q) =>
          q.eq("journeyId", journey._id),
        )
        .order("desc")
        .take(50),
      ctx.db
        .query("publicJourneyReports")
        .withIndex("by_journeyId_and_revokedAt", (q) =>
          q.eq("journeyId", journey._id).eq("revokedAt", undefined),
        )
        .first(),
    ]);
    const runViews = await Promise.all(
      runs.map(async (run) => {
        const checkpoints = await ctx.db
          .query("journeyCheckpoints")
          .withIndex("by_runId_and_order", (q) => q.eq("runId", run._id))
          .take(10);
        return {
          _id: run._id,
          trigger: run.trigger,
          status: run.status,
          ...(run.summary === undefined ? {} : { summary: run.summary }),
          ...(run.evidenceUrl === undefined
            ? {}
            : { evidenceUrl: run.evidenceUrl }),
          startedAt: run.startedAt,
          ...(run.completedAt === undefined
            ? {}
            : { completedAt: run.completedAt }),
          checkpoints: checkpoints.map((checkpoint) => ({
            _id: checkpoint._id,
            order: checkpoint.order,
            kind: checkpoint.kind,
            label: checkpoint.label,
            status: checkpoint.status,
            ...(checkpoint.detail === undefined
              ? {}
              : { detail: checkpoint.detail }),
            ...(checkpoint.evidenceExcerpt === undefined
              ? {}
              : { evidenceExcerpt: checkpoint.evidenceExcerpt }),
            ...(checkpoint.occurredAt === undefined
              ? {}
              : { occurredAt: checkpoint.occurredAt }),
          })),
        };
      }),
    );
    return {
      journey: {
        _id: journey._id,
        teamId: journey.teamId,
        name: journey.name,
        kind: journey.kind,
        startUrl: journey.startUrl,
        goal: journey.goal,
        ...(journey.expectedSenderDomain === undefined
          ? {}
          : { expectedSenderDomain: journey.expectedSenderDomain }),
        expectedReplyMinutes: journey.expectedReplyMinutes,
        cadence: journey.cadence,
        enabled: journey.enabled,
        status: journey.status,
        ...(journey.lastRunAt === undefined
          ? {}
          : { lastRunAt: journey.lastRunAt }),
        ...(journey.nextRunAt === undefined
          ? {}
          : { nextRunAt: journey.nextRunAt }),
      },
      steps: steps.map((step) => ({
        _id: step._id,
        order: step.order,
        kind: step.kind,
        label: step.label,
        instruction: step.instruction,
      })),
      runs: runViews,
      incidents: incidents.map((incident) => ({
        _id: incident._id,
        runId: incident.runId,
        checkpointKind: incident.checkpointKind,
        title: incident.title,
        detail: incident.detail,
        severity: incident.severity,
        status: incident.status,
        ...(incident.ownerLabel === undefined
          ? {}
          : { ownerLabel: incident.ownerLabel }),
        ...(incident.resolutionNote === undefined
          ? {}
          : { resolutionNote: incident.resolutionNote }),
        createdAt: incident.createdAt,
        ...(incident.resolvedAt === undefined
          ? {}
          : { resolvedAt: incident.resolvedAt }),
      })),
      ...(publicReport === null ? {} : { publicSlug: publicReport.slug }),
    };
  },
});

export const create = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
    kind: journeyKind,
    startUrl: v.string(),
    goal: v.string(),
    expectedSenderDomain: v.optional(v.string()),
    expectedReplyMinutes: v.number(),
    cadence,
    expectsConfirmation: v.boolean(),
    expectsHumanReply: v.boolean(),
  },
  returns: v.id("customerJourneys"),
  handler: async (ctx, args) => {
    const { userId } = await requireTeamMember(ctx, args.teamId);
    const startUrl = normalizePublicWebsiteUrl(args.startUrl);
    const name = boundedPlainText(args.name, "Journey name", 80);
    const goal = boundedPlainText(args.goal, "Customer goal", 240);
    const replyMinutes = Math.max(
      15,
      Math.min(10_080, Math.trunc(args.expectedReplyMinutes)),
    );
    const sender = args.expectedSenderDomain
      ?.trim()
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/^www\./, "");
    if (sender && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(sender)) {
      throw new Error("Expected sender must be a domain such as example.com");
    }
    if (args.expectsHumanReply && !args.expectsConfirmation) {
      throw new Error("A human reply journey must also verify email delivery");
    }
    const now = Date.now();
    const journeyId = await ctx.db.insert("customerJourneys", {
      teamId: args.teamId,
      createdBy: userId,
      name,
      kind: args.kind,
      startUrl,
      goal,
      ...(sender ? { expectedSenderDomain: sender } : {}),
      expectedReplyMinutes: replyMinutes,
      cadence: args.cadence,
      enabled: false,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const steps: Array<{
      kind: "website" | "form" | "confirmation" | "human_reply";
      label: string;
      instruction: string;
    }> = [
      {
        kind: "website",
        label: "Website reached",
        instruction: `Open the public lead-form page at ${websiteDomain(startUrl)}.`,
      },
      {
        kind: "form",
        label: "Test lead submitted",
        instruction:
          "Complete only the approved public contact, quote, booking, or signup form using the clearly labeled QA identity.",
      },
    ];
    if (args.expectsConfirmation) {
      steps.push({
        kind: "confirmation",
        label: "Confirmation issued",
        instruction:
          "Verify that the correlated acknowledgement reaches the test-customer inbox.",
      });
    }
    if (args.expectsHumanReply) {
      steps.push({
        kind: "human_reply",
        label: "Human reply received",
        instruction: `Verify a follow-up arrives within ${replyMinutes} minutes.`,
      });
    }
    await Promise.all(
      steps.map((step, order) =>
        ctx.db.insert("journeySteps", {
          journeyId,
          order,
          ...step,
          createdAt: now,
        }),
      ),
    );
    return journeyId;
  },
});

export const activate = mutation({
  args: {
    journeyId: v.id("customerJourneys"),
    authorizedPublicFormTesting: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const journey = await ctx.db.get("customerJourneys", args.journeyId);
    if (journey === null) throw new Error("404: journey not found");
    const { userId, role } = await requireTeamMember(ctx, journey.teamId);
    if (role !== "owner") throw new Error("Only the team owner can activate testing");
    if (!args.authorizedPublicFormTesting) {
      throw new Error("Confirm that you own or are authorized to test this website");
    }
    const now = Date.now();
    await ctx.db.patch("customerJourneys", journey._id, {
      enabled: true,
      authorizedAt: now,
      authorizedBy: userId,
      nextRunAt: nextRunAt(journey.cadence, now),
      updatedAt: now,
    });
    return null;
  },
});

export const pause = mutation({
  args: { journeyId: v.id("customerJourneys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const journey = await ctx.db.get("customerJourneys", args.journeyId);
    if (journey === null) throw new Error("404: journey not found");
    await requireTeamMember(ctx, journey.teamId);
    await ctx.db.patch("customerJourneys", journey._id, {
      enabled: false,
      nextRunAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const cancelActiveRun = mutation({
  args: { journeyId: v.id("customerJourneys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const journey = await ctx.db.get("customerJourneys", args.journeyId);
    if (journey === null) throw new Error("404: journey not found");
    await requireTeamMember(ctx, journey.teamId);
    const run = await ctx.db
      .query("journeyRuns")
      .withIndex("by_journeyId_and_createdAt", (q) =>
        q.eq("journeyId", journey._id),
      )
      .order("desc")
      .first();
    if (run === null || !["queued", "running", "waiting"].includes(run.status)) {
      throw new Error("This journey has no active run to cancel");
    }
    const now = Date.now();
    const [expectations, checkpoints] = await Promise.all([
      ctx.db
        .query("journeyEmailExpectations")
        .withIndex("by_runId", (q) => q.eq("runId", run._id))
        .take(10),
      ctx.db
        .query("journeyCheckpoints")
        .withIndex("by_runId_and_order", (q) => q.eq("runId", run._id))
        .take(10),
    ]);
    await Promise.all([
      ...expectations
        .filter((expectation) => expectation.status === "waiting")
        .map((expectation) =>
          ctx.db.patch("journeyEmailExpectations", expectation._id, {
            status: "expired",
          }),
        ),
      ...checkpoints
        .filter((checkpoint) =>
          ["pending", "waiting"].includes(checkpoint.status),
        )
        .map((checkpoint) =>
          ctx.db.patch("journeyCheckpoints", checkpoint._id, {
            status: "skipped",
            detail: "The team cancelled this run before the handoff completed.",
            occurredAt: now,
          }),
        ),
    ]);
    await ctx.db.patch("journeyRuns", run._id, {
      status: "cancelled",
      summary: "The team cancelled this run.",
      completedAt: now,
    });
    await ctx.db.patch("customerJourneys", journey._id, {
      status: "draft",
      updatedAt: now,
    });
    return null;
  },
});

export const resolveIncident = mutation({
  args: {
    incidentId: v.id("journeyIncidents"),
    ownerLabel: v.string(),
    resolutionNote: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const incident = await ctx.db.get("journeyIncidents", args.incidentId);
    if (incident === null) throw new Error("404: incident not found");
    await requireTeamMember(ctx, incident.teamId);
    await ctx.db.patch("journeyIncidents", incident._id, {
      status: "resolved",
      ownerLabel: boundedPlainText(args.ownerLabel, "Owner", 80),
      resolutionNote: boundedPlainText(args.resolutionNote, "Resolution note", 500),
      resolvedAt: Date.now(),
    });
    return null;
  },
});

export const publish = mutation({
  args: { journeyId: v.id("customerJourneys") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const journey = await ctx.db.get("customerJourneys", args.journeyId);
    if (journey === null) throw new Error("404: journey not found");
    const { userId, role } = await requireTeamMember(ctx, journey.teamId);
    if (role !== "owner") throw new Error("Only the team owner can publish a report");
    const latestRun = await ctx.db
      .query("journeyRuns")
      .withIndex("by_journeyId_and_createdAt", (q) =>
        q.eq("journeyId", journey._id),
      )
      .order("desc")
      .first();
    if (latestRun === null || latestRun.status === "queued") {
      throw new Error("Run the journey before publishing its evidence");
    }
    const existing = await ctx.db
      .query("publicJourneyReports")
      .withIndex("by_journeyId_and_revokedAt", (q) =>
        q.eq("journeyId", journey._id).eq("revokedAt", undefined),
      )
      .first();
    if (existing !== null) return existing.slug;
    const base = safeSlug(journey.name);
    let slug = `${base}-${journey._id.slice(-8)}`;
    const collision = await ctx.db
      .query("publicJourneyReports")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (collision !== null) slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
    await ctx.db.insert("publicJourneyReports", {
      slug,
      teamId: journey.teamId,
      journeyId: journey._id,
      publishedBy: userId,
      publishedAt: Date.now(),
    });
    return slug;
  },
});

export const getPublic = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      goal: v.string(),
      businessName: v.string(),
      websiteDomain: v.string(),
      status: journeyStatus,
      publishedAt: v.number(),
      latestRun: v.object({
        status: runStatus,
        summary: v.optional(v.string()),
        startedAt: v.number(),
        completedAt: v.optional(v.number()),
        checkpoints: v.array(checkpointView),
      }),
      openIncident: v.optional(
        v.object({
          title: v.string(),
          detail: v.string(),
          severity: v.union(
            v.literal("broken"),
            v.literal("customer_waiting"),
            v.literal("degraded"),
          ),
          createdAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query("publicJourneyReports")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (report === null || report.revokedAt !== undefined) return null;
    const journey = await ctx.db.get("customerJourneys", report.journeyId);
    if (journey === null) return null;
    const [profile, latestRun, openIncident] = await Promise.all([
      ctx.db
        .query("businessProfiles")
        .withIndex("by_teamId", (q) => q.eq("teamId", journey.teamId))
        .unique(),
      ctx.db
        .query("journeyRuns")
        .withIndex("by_journeyId_and_createdAt", (q) =>
          q.eq("journeyId", journey._id),
        )
        .order("desc")
        .first(),
      ctx.db
        .query("journeyIncidents")
        .withIndex("by_journeyId_and_status", (q) =>
          q.eq("journeyId", journey._id).eq("status", "open"),
        )
        .order("desc")
        .first(),
    ]);
    if (profile === null || latestRun === null) return null;
    const checkpoints = await ctx.db
      .query("journeyCheckpoints")
      .withIndex("by_runId_and_order", (q) => q.eq("runId", latestRun._id))
      .take(10);
    return {
      name: journey.name,
      goal: journey.goal,
      businessName: profile.displayName,
      websiteDomain: websiteDomain(profile.websiteUrl),
      status: journey.status,
      publishedAt: report.publishedAt,
      latestRun: {
        status: latestRun.status,
        ...(latestRun.summary === undefined
          ? {}
          : { summary: latestRun.summary }),
        startedAt: latestRun.startedAt,
        ...(latestRun.completedAt === undefined
          ? {}
          : { completedAt: latestRun.completedAt }),
        checkpoints: checkpoints.map((checkpoint) => ({
          _id: checkpoint._id,
          order: checkpoint.order,
          kind: checkpoint.kind,
          label: checkpoint.label,
          status: checkpoint.status,
          ...(checkpoint.detail === undefined
            ? {}
            : { detail: checkpoint.detail }),
          ...(checkpoint.evidenceExcerpt === undefined
            ? {}
            : { evidenceExcerpt: checkpoint.evidenceExcerpt }),
          ...(checkpoint.occurredAt === undefined
            ? {}
            : { occurredAt: checkpoint.occurredAt }),
        })),
      },
      ...(openIncident === null
        ? {}
        : {
            openIncident: {
              title: openIncident.title,
              detail: openIncident.detail,
              severity: openIncident.severity,
              createdAt: openIncident.createdAt,
            },
          }),
    };
  },
});

export const getRunContext = internalQuery({
  args: {
    runId: v.id("journeyRuns"),
    requesterId: v.optional(v.id("users")),
  },
  returns: v.object({
    runId: v.id("journeyRuns"),
    journeyId: v.id("customerJourneys"),
    teamId: v.id("teams"),
    name: v.string(),
    kind: journeyKind,
    startUrl: v.string(),
    goal: v.string(),
    expectedSenderDomain: v.optional(v.string()),
    expectedReplyMinutes: v.number(),
    correlationToken: v.string(),
    steps: v.array(stepView),
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("journeyRuns", args.runId);
    if (run === null) throw new Error("Run not found");
    const journey = await ctx.db.get("customerJourneys", run.journeyId);
    if (journey === null) throw new Error("Journey not found");
    if (args.requesterId !== undefined) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_teamId", (q) =>
          q.eq("userId", args.requesterId!).eq("teamId", journey.teamId),
        )
        .unique();
      if (membership === null) throw new Error("403: team membership required");
    }
    if (!journey.enabled || journey.authorizedAt === undefined) {
      throw new Error("This journey is paused or has not been authorized");
    }
    const steps = await ctx.db
      .query("journeySteps")
      .withIndex("by_journeyId_and_order", (q) =>
        q.eq("journeyId", journey._id),
      )
      .take(10);
    return {
      runId: run._id,
      journeyId: journey._id,
      teamId: journey.teamId,
      name: journey.name,
      kind: journey.kind,
      startUrl: journey.startUrl,
      goal: journey.goal,
      ...(journey.expectedSenderDomain === undefined
        ? {}
        : { expectedSenderDomain: journey.expectedSenderDomain }),
      expectedReplyMinutes: journey.expectedReplyMinutes,
      correlationToken: run.correlationToken,
      steps: steps.map((step) => ({
        _id: step._id,
        order: step.order,
        kind: step.kind,
        label: step.label,
        instruction: step.instruction,
      })),
    };
  },
});

export const getDiscoveryContext = internalQuery({
  args: {
    teamId: v.id("teams"),
    requesterId: v.id("users"),
  },
  returns: v.object({
    teamId: v.id("teams"),
    businessName: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_teamId", (q) =>
        q.eq("userId", args.requesterId).eq("teamId", args.teamId),
      )
      .unique();
    if (membership === null) throw new Error("403: team membership required");
    const profile = await ctx.db
      .query("businessProfiles")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .unique();
    return {
      teamId: args.teamId,
      ...(profile === null
        ? {}
        : {
            businessName: profile.displayName,
            websiteUrl: profile.websiteUrl,
          }),
    };
  },
});

export const createRun = internalMutation({
  args: {
    journeyId: v.id("customerJourneys"),
    trigger: v.union(v.literal("manual"), v.literal("scheduled")),
    requesterId: v.optional(v.id("users")),
  },
  returns: v.id("journeyRuns"),
  handler: async (ctx, args) => {
    const journey = await ctx.db.get("customerJourneys", args.journeyId);
    if (journey === null) throw new Error("Journey not found");
    if (!journey.enabled || journey.authorizedAt === undefined) {
      throw new Error("Activate and authorize this journey before running it");
    }
    if (args.trigger === "manual") {
      if (args.requesterId === undefined) throw new Error("Requester is required");
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_teamId", (q) =>
          q.eq("userId", args.requesterId!).eq("teamId", journey.teamId),
        )
        .unique();
      if (membership === null) throw new Error("403: team membership required");
    }
    const recentRuns = await ctx.db
      .query("journeyRuns")
      .withIndex("by_journeyId_and_createdAt", (q) =>
        q.eq("journeyId", journey._id),
      )
      .order("desc")
      .take(5);
    if (
      recentRuns.some(
        (run) =>
          ["queued", "running", "waiting"].includes(run.status) &&
          Date.now() - run.startedAt < 8 * 24 * 60 * 60 * 1_000,
      )
    ) {
      throw new Error("This journey already has an active run");
    }
    const now = Date.now();
    const runId = await ctx.db.insert("journeyRuns", {
      teamId: journey.teamId,
      journeyId: journey._id,
      trigger: args.trigger,
      status: "queued",
      correlationToken: `SG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      startedAt: now,
      createdAt: now,
    });
    const steps = await ctx.db
      .query("journeySteps")
      .withIndex("by_journeyId_and_order", (q) =>
        q.eq("journeyId", journey._id),
      )
      .take(10);
    await Promise.all(
      steps.map((step) =>
        ctx.db.insert("journeyCheckpoints", {
          runId,
          journeyId: journey._id,
          order: step.order,
          kind: step.kind,
          label: step.label,
          status: "pending",
          createdAt: now,
        }),
      ),
    );
    await ctx.db.patch("customerJourneys", journey._id, {
      status: "running",
      lastRunAt: now,
      nextRunAt: nextRunAt(journey.cadence, now),
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.journeyActions.executeRun, {
      runId,
    });
    return runId;
  },
});

export const markRunStarted = internalMutation({
  args: { runId: v.id("journeyRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("journeyRuns", args.runId);
    if (run === null || run.status !== "queued") return null;
    await ctx.db.patch("journeyRuns", run._id, { status: "running" });
    return null;
  },
});

async function createIncident(
  ctx: MutationCtx,
  args: {
    runId: Id<"journeyRuns">;
    journeyId: Id<"customerJourneys">;
    teamId: Id<"teams">;
    checkpointKind: "website" | "form" | "confirmation" | "human_reply";
    title: string;
    detail: string;
    severity: "broken" | "customer_waiting" | "degraded";
  },
) {
  const existing = await ctx.db
    .query("journeyIncidents")
    .withIndex("by_runId", (q) => q.eq("runId", args.runId))
    .first();
  if (existing !== null) return;
  const createdAt = Date.now();
  const incidentId = await ctx.db.insert("journeyIncidents", {
    ...args,
    status: "open",
    createdAt,
  });
  const deliveryId = await ctx.db.insert("journeyAlertDeliveries", {
    teamId: args.teamId,
    incidentId,
    kind: "incident",
    token: `SG-ALERT-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
    status: "pending",
    attemptCount: 0,
    createdAt,
    updatedAt: createdAt,
  });
  await ctx.scheduler.runAfter(0, internal.alertActions.sendDelivery, {
    deliveryId,
  });
}

export const recordBrowserResult = internalMutation({
  args: {
    runId: v.id("journeyRuns"),
    success: v.boolean(),
    summary: v.string(),
    scrapeId: v.optional(v.string()),
    evidenceUrl: v.optional(v.string()),
    failureKind: v.optional(v.union(v.literal("website"), v.literal("form"))),
    inboxId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("journeyRuns", args.runId);
    if (run === null) return null;
    const journey = await ctx.db.get("customerJourneys", run.journeyId);
    if (journey === null) return null;
    const checkpoints = await ctx.db
      .query("journeyCheckpoints")
      .withIndex("by_runId_and_order", (q) => q.eq("runId", run._id))
      .take(10);
    const now = Date.now();
    if (!args.success) {
      const failedKind = args.failureKind ?? "form";
      const failed = checkpoints.find((step) => step.kind === failedKind);
      if (failed !== undefined) {
        await ctx.db.patch("journeyCheckpoints", failed._id, {
          status: "failed",
          detail: args.summary,
          occurredAt: now,
        });
      }
      await createIncident(ctx, {
        runId: run._id,
        journeyId: journey._id,
        teamId: journey.teamId,
        checkpointKind: failedKind,
        title:
          failedKind === "website"
            ? "Lead-form page did not open"
            : "Lead form did not accept the test lead",
        detail: args.summary,
        severity: "broken",
      });
      await ctx.db.patch("journeyRuns", run._id, {
        status: "incident",
        summary: args.summary,
        ...(args.scrapeId === undefined
          ? {}
          : { firecrawlScrapeId: args.scrapeId }),
        ...(args.evidenceUrl === undefined
          ? {}
          : { evidenceUrl: args.evidenceUrl }),
        completedAt: now,
      });
      await ctx.db.patch("customerJourneys", journey._id, {
        status: "incident",
        updatedAt: now,
      });
      return null;
    }
    for (const checkpoint of checkpoints) {
      if (checkpoint.kind === "website" || checkpoint.kind === "form") {
        await ctx.db.patch("journeyCheckpoints", checkpoint._id, {
          status: "verified",
          detail:
            checkpoint.kind === "website"
              ? "The public lead-form page loaded successfully."
              : "The approved form accepted the clearly labeled test lead.",
          evidenceExcerpt: args.summary.slice(0, 600),
          occurredAt: now,
        });
      }
    }
    const emailCheckpoint = checkpoints.find(
      (checkpoint) => checkpoint.kind === "confirmation",
    );
    if (emailCheckpoint !== undefined && args.inboxId !== undefined) {
      await ctx.db.patch("journeyCheckpoints", emailCheckpoint._id, {
        status: "waiting",
        detail: "Waiting for the test-customer confirmation email.",
      });
      await ctx.db.insert("journeyEmailExpectations", {
        teamId: journey.teamId,
        journeyId: journey._id,
        runId: run._id,
        inboxId: args.inboxId,
        correlationToken: run.correlationToken,
        ...(journey.expectedSenderDomain === undefined
          ? {}
          : { expectedSenderDomain: journey.expectedSenderDomain }),
        expectedKind: "confirmation",
        status: "waiting",
        deadlineAt: now + 15 * 60 * 1_000,
        createdAt: now,
      });
      await ctx.db.patch("journeyRuns", run._id, {
        status: "waiting",
        summary: "The customer request was submitted; email confirmation is pending.",
        ...(args.scrapeId === undefined
          ? {}
          : { firecrawlScrapeId: args.scrapeId }),
        ...(args.evidenceUrl === undefined
          ? {}
          : { evidenceUrl: args.evidenceUrl }),
      });
      return null;
    }
    await ctx.db.patch("journeyRuns", run._id, {
      status: "healthy",
      summary: args.summary,
      ...(args.scrapeId === undefined
        ? {}
        : { firecrawlScrapeId: args.scrapeId }),
      ...(args.evidenceUrl === undefined
        ? {}
        : { evidenceUrl: args.evidenceUrl }),
      completedAt: now,
    });
    await ctx.db.patch("customerJourneys", journey._id, {
      status: "healthy",
      updatedAt: now,
    });
    return null;
  },
});

export const findEmailExpectation = internalQuery({
  args: {
    inboxId: v.string(),
    senderDomain: v.string(),
    content: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      expectationId: v.id("journeyEmailExpectations"),
      runId: v.id("journeyRuns"),
      expectedKind: v.union(
        v.literal("confirmation"),
        v.literal("human_reply"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const waiting = await ctx.db
      .query("journeyEmailExpectations")
      .withIndex("by_inboxId_and_status", (q) =>
        q.eq("inboxId", args.inboxId).eq("status", "waiting"),
      )
      .order("desc")
      .take(20);
    const now = Date.now();
    const matched = waiting.find(
      (expectation) =>
        expectation.deadlineAt >= now &&
        (args.content
          .toLowerCase()
          .includes(expectation.correlationToken.toLowerCase()) ||
          (expectation.expectedSenderDomain !== undefined &&
            expectation.expectedSenderDomain === args.senderDomain)),
    );
    if (matched === undefined) return null;
    return {
      expectationId: matched._id,
      runId: matched.runId,
      expectedKind: matched.expectedKind,
    };
  },
});

export const recordRunError = internalMutation({
  args: {
    runId: v.id("journeyRuns"),
    summary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("journeyRuns", args.runId);
    if (
      run === null ||
      ["healthy", "incident", "cancelled"].includes(run.status)
    ) {
      return null;
    }
    const now = Date.now();
    const checkpoints = await ctx.db
      .query("journeyCheckpoints")
      .withIndex("by_runId_and_order", (q) => q.eq("runId", run._id))
      .take(10);
    await Promise.all(
      checkpoints
        .filter((checkpoint) =>
          ["pending", "waiting"].includes(checkpoint.status),
        )
        .map((checkpoint) =>
          ctx.db.patch("journeyCheckpoints", checkpoint._id, {
            status: "skipped",
            detail: "The provider-backed check did not complete.",
            occurredAt: now,
          }),
        ),
    );
    await ctx.db.patch("journeyRuns", run._id, {
      status: "error",
      summary: boundedPlainText(args.summary, "Run summary", 600),
      completedAt: now,
    });
    await ctx.db.patch("customerJourneys", run.journeyId, {
      status: "draft",
      updatedAt: now,
    });
    return null;
  },
});

export const recordEmailReceived = internalMutation({
  args: {
    expectationId: v.id("journeyEmailExpectations"),
    messageId: v.string(),
    senderDomain: v.string(),
    evidenceExcerpt: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const expectation = await ctx.db.get(
      "journeyEmailExpectations",
      args.expectationId,
    );
    if (expectation === null || expectation.status !== "waiting") return false;
    const run = await ctx.db.get("journeyRuns", expectation.runId);
    const journey = await ctx.db.get("customerJourneys", expectation.journeyId);
    if (run === null || journey === null) return false;
    const checkpoint = (
      await ctx.db
        .query("journeyCheckpoints")
        .withIndex("by_runId_and_order", (q) => q.eq("runId", run._id))
        .take(10)
    ).find((candidate) => candidate.kind === expectation.expectedKind);
    const now = Date.now();
    await ctx.db.patch("journeyEmailExpectations", expectation._id, {
      status: "received",
      receivedAt: now,
      senderDomain: args.senderDomain,
      messageId: args.messageId,
    });
    if (checkpoint !== undefined) {
      await ctx.db.patch("journeyCheckpoints", checkpoint._id, {
        status: "verified",
        detail:
          expectation.expectedKind === "confirmation"
            ? "The correlated confirmation reached the test-customer inbox."
            : "The test-customer inbox received a follow-up reply.",
        evidenceExcerpt: args.evidenceExcerpt.slice(0, 600),
        occurredAt: now,
      });
    }
    if (expectation.expectedKind === "confirmation") {
      const replyCheckpoint = (
        await ctx.db
          .query("journeyCheckpoints")
          .withIndex("by_runId_and_order", (q) => q.eq("runId", run._id))
          .take(10)
      ).find((candidate) => candidate.kind === "human_reply");
      if (replyCheckpoint !== undefined) {
        await ctx.db.patch("journeyCheckpoints", replyCheckpoint._id, {
          status: "waiting",
          detail: `Waiting up to ${journey.expectedReplyMinutes} minutes for a human reply.`,
        });
        await ctx.db.insert("journeyEmailExpectations", {
          teamId: journey.teamId,
          journeyId: journey._id,
          runId: run._id,
          inboxId: expectation.inboxId,
          correlationToken: expectation.correlationToken,
          ...(journey.expectedSenderDomain === undefined
            ? {}
            : { expectedSenderDomain: journey.expectedSenderDomain }),
          expectedKind: "human_reply",
          status: "waiting",
          deadlineAt: now + journey.expectedReplyMinutes * 60 * 1_000,
          createdAt: now,
        });
        await ctx.db.patch("journeyRuns", run._id, {
          status: "waiting",
          summary: "Confirmation arrived; the promised human reply is pending.",
        });
        return true;
      }
    }
    await ctx.db.patch("journeyRuns", run._id, {
      status: "healthy",
      summary:
        expectation.expectedKind === "confirmation"
          ? "The customer request and correlated confirmation dispatch both completed."
          : "The complete customer journey, including the human reply, completed.",
      completedAt: now,
    });
    await ctx.db.patch("customerJourneys", journey._id, {
      status: "healthy",
      updatedAt: now,
    });
    return true;
  },
});

export const expireDueEmailExpectations = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const expectations = await ctx.db
      .query("journeyEmailExpectations")
      .withIndex("by_status_and_deadlineAt", (q) =>
        q.eq("status", "waiting").lt("deadlineAt", now),
      )
      .take(100);
    for (const expectation of expectations) {
      const [run, journey] = await Promise.all([
        ctx.db.get("journeyRuns", expectation.runId),
        ctx.db.get("customerJourneys", expectation.journeyId),
      ]);
      if (run === null || journey === null) continue;
      await ctx.db.patch("journeyEmailExpectations", expectation._id, {
        status: "expired",
      });
      const checkpoint = (
        await ctx.db
          .query("journeyCheckpoints")
          .withIndex("by_runId_and_order", (q) => q.eq("runId", run._id))
          .take(10)
      ).find((candidate) => candidate.kind === expectation.expectedKind);
      const title =
        expectation.expectedKind === "confirmation"
          ? "Confirmation never appeared"
          : "Customer is still waiting for a reply";
      const detail =
        expectation.expectedKind === "confirmation"
          ? "The request was submitted, but no correlated acknowledgement appeared in the QA mailbox within 15 minutes."
          : `No follow-up reply arrived within the promised ${journey.expectedReplyMinutes} minutes.`;
      if (checkpoint !== undefined) {
        await ctx.db.patch("journeyCheckpoints", checkpoint._id, {
          status: "failed",
          detail,
          occurredAt: now,
        });
      }
      await createIncident(ctx, {
        runId: run._id,
        journeyId: journey._id,
        teamId: journey.teamId,
        checkpointKind: expectation.expectedKind,
        title,
        detail,
        severity: "customer_waiting",
      });
      await ctx.db.patch("journeyRuns", run._id, {
        status: "incident",
        summary: detail,
        completedAt: now,
      });
      await ctx.db.patch("customerJourneys", journey._id, {
        status: "incident",
        updatedAt: now,
      });
    }
    return expectations.length;
  },
});

export const listWaitingEmailExpectations = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      expectationId: v.id("journeyEmailExpectations"),
      inboxId: v.string(),
      correlationToken: v.string(),
      expectedKind: v.union(
        v.literal("confirmation"),
        v.literal("human_reply"),
      ),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const expectations = await ctx.db
      .query("journeyEmailExpectations")
      .withIndex("by_status_and_deadlineAt", (q) =>
        q.eq("status", "waiting").gte("deadlineAt", Date.now()),
      )
      .take(50);
    return expectations.map((expectation) => ({
      expectationId: expectation._id,
      inboxId: expectation.inboxId,
      correlationToken: expectation.correlationToken,
      expectedKind: expectation.expectedKind,
      createdAt: expectation.createdAt,
    }));
  },
});

export const listDue = internalQuery({
  args: {},
  returns: v.array(v.id("customerJourneys")),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("customerJourneys")
      .withIndex("by_enabled_and_nextRunAt", (q) =>
        q.eq("enabled", true).lte("nextRunAt", now),
      )
      .take(50);
    return due.map((journey) => journey._id);
  },
});
