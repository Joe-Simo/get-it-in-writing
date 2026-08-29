/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.unstubAllEnvs();
});

async function createReadinessFixture() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "readiness-owner@example.invalid",
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Provider readiness",
      slug: "provider-readiness",
      ownerId,
      createdAt: 1,
    });
    await ctx.db.insert("memberships", {
      teamId,
      userId: ownerId,
      role: "owner",
      joinedAt: 1,
    });
    return { ownerId, teamId };
  });
  return { t, ...fixture };
}

test("provider API keys alone cannot unlock webhook-dependent workflows", async () => {
  vi.stubEnv("OPENAI_API_KEY", "configured");
  vi.stubEnv("FIRECRAWL_API_KEY", "configured");
  vi.stubEnv("AGENTMAIL_API_KEY", "configured");
  vi.stubEnv("AGENTMAIL_INBOX_ID", "configured");
  vi.stubEnv("PUBLIC_APP_URL", "https://signal-garden.example.invalid");
  const { t, ownerId, teamId } = await createReadinessFixture();

  const readiness = await t
    .withIdentity({ subject: ownerId })
    .query(api.readiness.forTeam, { teamId });

  expect(readiness).toMatchObject({
    openai: true,
    firecrawl: false,
    agentMail: false,
    invitationLinks: false,
    researchReady: false,
    collaborationReady: false,
  });
});

test("verified webhook secrets unlock research and collaboration", async () => {
  vi.stubEnv("OPENAI_API_KEY", "configured");
  vi.stubEnv("FIRECRAWL_API_KEY", "configured");
  vi.stubEnv("FIRECRAWL_WEBHOOK_SECRET", "configured");
  vi.stubEnv("AGENTMAIL_API_KEY", "configured");
  vi.stubEnv("AGENTMAIL_INBOX_ID", "configured");
  vi.stubEnv("AGENTMAIL_WEBHOOK_SECRET", "configured");
  vi.stubEnv("PUBLIC_APP_URL", "https://signal-garden.example.invalid");
  const { t, ownerId, teamId } = await createReadinessFixture();

  const readiness = await t
    .withIdentity({ subject: ownerId })
    .query(api.readiness.forTeam, { teamId });

  expect(readiness).toMatchObject({
    openai: true,
    firecrawl: true,
    agentMail: true,
    invitationLinks: true,
    researchReady: true,
    collaborationReady: true,
  });
});
