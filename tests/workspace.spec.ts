import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the private wallet starts empty and exposes the real decision intake", async ({ page }, testInfo) => {
  const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.project.name}`;

  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Email").fill(`giw-qa-${runId}@example.invalid`);
  await page.getByLabel("Password").fill(`Local-QA-${runId}-Pass!`);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByRole("heading", { name: /your decisions.*with the uncertainty removed/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing here yet." })).toBeVisible();
  await expect(page.getByText("Only you can see this wallet.")).toBeVisible();

  await page.getByRole("link", { name: "Protect a decision" }).click();
  await expect(
    page.getByRole("heading", { name: /what are you about.*to rely on/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Official page")).toBeVisible();
  await expect(page.getByLabel("What must be true?")).toBeVisible();
  await expect(page.getByText(/this starts private research.*does not contact anyone/i)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("the unauthenticated wallet gate is keyboard accessible", async ({ page }) => {
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Open your decisions." })).toBeVisible();
  await page.getByLabel("Email").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
