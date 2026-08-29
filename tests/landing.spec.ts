import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page tells the product story and remains accessible", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: /signal garden/i })).toBeVisible();
  await expect(page.getByText("Research, made inspectable")).toBeVisible();
  await expect(page.getByRole("button", { name: /claim: bound every research mission/i })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("evidence selection and static mode are operable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/^(WebGPU live field|Accessible static field)$/)).toBeVisible({ timeout: 30_000 });
  const source = page.getByRole("button", { name: /source: openai responses api/i });
  await source.click();
  await expect(source).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 2, name: "OpenAI Responses API" })).toBeVisible();

  const staticMode = page.getByRole("checkbox", { name: "Static mode" });
  await staticMode.check();
  await expect(staticMode).toBeChecked();
});
