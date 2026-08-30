import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page tells the product story and remains accessible", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /never price a stale package/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("For construction estimating teams"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /source: sam\.gov/i,
    }),
  ).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("reduced motion opens the real evidence field in static mode", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("checkbox", { name: "Static graph" }),
  ).toBeChecked();
});

test("evidence selection and static mode are operable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText(/^(WebGPU live field|Accessible static field)$/),
  ).toBeVisible({ timeout: 30_000 });
  const source = page.getByRole("button", {
    name: /source: sam\.gov/i,
  });
  await source.click();
  await expect(source).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { level: 3, name: /sam\.gov/i }),
  ).toBeVisible();

  const staticMode = page.getByRole("checkbox", { name: "Static graph" });
  await staticMode.check();
  await expect(staticMode).toBeChecked();
});

test("the real public bid leads with a release gate and source trace", async ({
  page,
}) => {
  await page.goto("/garden/should-we-bid-on-the-construction-of-86cb535e", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /construction of fire protection system at building c2/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /requirements that decide whether pricing starts/i,
    }),
  ).toBeVisible();
  await expect(page.getByText("11", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Offer guarantee", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Complete decision brief", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /current, source-backed blockers/i }),
  ).toBeVisible();
  await expect(page.getByText("Versioned operating record")).toBeVisible();
  await expect(
    page.getByText("Package capture", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Requirement trace", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Review loop", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/email addresses, message contents, private notes/i),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
