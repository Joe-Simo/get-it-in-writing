import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("a new owner reaches lead-form onboarding without submitting an external form", async ({ page }, testInfo) => {
  const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.project.name}`;

  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Email").fill(`journey-owner-${runId}@example.invalid`);
  await page.getByLabel("Password").fill(`Local-QA-${runId}`);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.getByLabel("Business or team name").fill(`Customer Ops ${runId}`);
  await page.getByRole("button", { name: /create private workspace/i }).click();

  await expect(
    page.getByRole("heading", { name: /which lead form should we protect/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Business name")).toBeVisible();
  await expect(page.getByLabel("Public website")).toBeVisible();
  await expect(page.getByText(/this step only reads public pages/i)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
