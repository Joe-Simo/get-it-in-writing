import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("a team can frame and safely cancel a bounded mission", async ({
  page,
}, testInfo) => {
  const runId = `${Date.now()}-${testInfo.workerIndex}`;

  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Email").fill(`signal-garden-${runId}@example.invalid`);
  await page.getByLabel("Password").fill(`Local-QA-${runId}`);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.getByLabel("Team name").fill(`Evidence Lab ${runId}`);
  await page.getByRole("button", { name: /create private team/i }).click();
  await expect(
    page.getByRole("heading", { name: "Your decisions." }),
  ).toBeVisible();
  await expect(page.getByText("Deployment readiness")).toBeVisible();
  await expect(page.getByText("OpenAI", { exact: true })).toBeVisible();
  await expect(page.getByText("Firecrawl", { exact: true })).toBeVisible();
  await expect(page.getByText("AgentMail", { exact: true })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toHaveCount(3);

  const secondTeamName = `Field Notes ${runId}`;
  await page.getByRole("button", { name: /new team/i }).click();
  await page.getByLabel("Team name").fill(secondTeamName);
  await page.getByRole("button", { name: "Create private team" }).click();
  await expect(
    page.getByRole("combobox", { name: "Active team" }),
  ).toContainText(secondTeamName);

  const dashboardResults = await new AxeBuilder({ page }).analyze();
  expect(dashboardResults.violations).toEqual([]);

  await page.getByRole("button", { name: /research a decision/i }).click();
  await page
    .getByLabel("Research question")
    .fill(
      "Which documented Convex patterns keep a realtime research workflow trustworthy?",
    );
  await page.getByLabel("Trusted seed URLs").fill("https://docs.convex.dev/");
  await page.getByRole("button", { name: /create bounded research/i }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Which documented Convex patterns",
  );
  await expect(
    page.getByText("Verified replies", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No verified replies yet.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Launch bounded crawl" }),
  ).toBeEnabled();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: "Stop research" }).click();
  await expect(
    page.getByRole("heading", { name: "Stop this research?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop workflow" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop research" }),
  ).toHaveCount(0);
});
