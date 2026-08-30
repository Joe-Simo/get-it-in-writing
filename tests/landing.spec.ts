import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the landing page sells a customer outcome and remains accessible", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /we test your lead form every day.*if it breaks, we email you/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/sends one clearly labeled test lead/i),
  ).toBeVisible();
  await expect(page.getByLabel("Website", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email for the private setup link")).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("the public story stays about the business instead of the implementation stack", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Your website can be online and still lose every lead.")).toBeVisible();
  await expect(page.getByText("For businesses that depend on website leads.")).toBeVisible();
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(/Firecrawl|AgentMail|OpenAI|Convex database/i);
});

test("the mobile menu and lead form remain operable", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile-only interaction");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Website", { exact: true }).fill("https://example.com");
  await page.getByLabel("Email for the private setup link").fill("owner@example.com");
  await expect(page.getByRole("button", { name: "Send me the setup link" })).toBeEnabled();
});

test("missing public proof fails closed without leaking private data", async ({ page }) => {
  await page.goto("/proof/not-a-real-report", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "This report is not available." })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
