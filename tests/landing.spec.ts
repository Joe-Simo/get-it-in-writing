import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page tells the product story and remains accessible", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: /signal garden/i })).toBeVisible();
  await expect(page.getByText("Decision research, with proof")).toBeVisible();
  await expect(page.getByRole("button", { name: /claim: verify financial capacity or access to financing/i })).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("reduced motion opens the real evidence field in static mode", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("checkbox", { name: "Static mode" })).toBeChecked();
});

test("evidence selection and static mode are operable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/^(WebGPU live field|Accessible static field)$/)).toBeVisible({ timeout: 30_000 });
  const source = page.getByRole("button", { name: /source: construction industry/i });
  await source.click();
  await expect(source).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 2, name: /construction industry/i })).toBeVisible();

  const staticMode = page.getByRole("checkbox", { name: "Static mode" });
  await staticMode.check();
  await expect(staticMode).toBeChecked();
});

test("the real public decision leads with a complete brief and sponsor proof", async ({ page }) => {
  await page.goto("/garden/what-must-a-small-construction-firm--52a65131", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: /small construction firm/i })).toBeVisible();
  await expect(
    page.locator("#decision-brief").getByRole("heading", {
      name: /pre-bid verification checklist/i,
    }),
  ).toBeVisible();
  await expect(page.getByText("Complete decision brief", { exact: true })).toBeVisible();
  await expect(page.getByText("Firecrawl", { exact: true })).toBeVisible();
  await expect(page.getByText("OpenAI", { exact: true })).toBeVisible();
  await expect(page.getByText("AgentMail", { exact: true })).toBeVisible();
  await expect(page.getByText("1 brief delivery", { exact: true })).toBeVisible();
  await expect(page.getByText(/email addresses, message contents, private notes/i)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
