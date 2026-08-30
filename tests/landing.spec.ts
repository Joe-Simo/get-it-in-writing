import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page tells the product story and remains accessible", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: /know what kills the bid/i }),
  ).toBeVisible();
  await expect(
    page.getByText("Pre-bid readiness for small federal contractors"),
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
    page.getByRole("checkbox", { name: "Static mode" }),
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
    page.getByRole("heading", {
      level: 2,
      name: /construction of fire protection system/i,
    }),
  ).toBeVisible();

  const staticMode = page.getByRole("checkbox", { name: "Static mode" });
  await staticMode.check();
  await expect(staticMode).toBeChecked();
});

test("the real public decision leads with a complete brief and sponsor proof", async ({
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
    page.getByText("Offer guarantee", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Complete decision brief", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Firecrawl", { exact: true })).toBeVisible();
  await expect(page.getByText("OpenAI", { exact: true })).toBeVisible();
  await expect(page.getByText("AgentMail", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/email addresses, message contents, private notes/i),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
