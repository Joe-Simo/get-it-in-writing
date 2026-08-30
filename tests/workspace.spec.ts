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
    page.getByRole("heading", { name: "Control every package." }),
  ).toBeVisible();
  await expect(page.getByText("Control room readiness")).toBeVisible();
  await expect(page.getByText("Source capture", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Impact extraction", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Reply routing", { exact: true })).toBeVisible();
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

  await page.getByRole("button", { name: /track a bid/i }).click();
  await page
    .getByLabel("Opportunity")
    .fill("Public building fire protection upgrade");
  await page
    .getByLabel("Public solicitation URL")
    .fill("https://sam.gov/opp/test-opportunity/view");
  await page.getByRole("button", { name: /create bid control room/i }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Public building fire protection upgrade",
  );
  await expect(
    page.getByText("Compliance matrix", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Verified replies", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No verified replies yet.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Capture bid package" }),
  ).toBeEnabled();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: "Stop package capture" }).click();
  await expect(
    page.getByRole("heading", { name: "Stop this package capture?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop workflow" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop package capture" }),
  ).toHaveCount(0);
});
