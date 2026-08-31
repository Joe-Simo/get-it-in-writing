import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the landing page makes the decision-protection outcome immediately clear", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: /don’t rely on.*probably/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Join the waitlist" }),
  ).toBeVisible();
  await expect(
    page.getByText(/nothing is sent without your approval/i),
  ).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("the public story describes the customer boundary rather than the stack", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Not a summary. A boundary.")).toBeVisible();
  await expect(page.getByText(/private by default/i).first()).toBeVisible();
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(
    /Firecrawl|AgentMail|OpenAI|Convex database|WebGPU/i,
  );
  expect(visibleText).not.toMatch(
    /AI-powered|revolutionary|seamless|supercharge/i,
  );
});

test("joining the waitlist confirms without leaving the page", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One live join per run keeps the list clean");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .getByLabel("Email")
    .fill(`giw-waitlist-qa-${Date.now()}@example.invalid`);
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.getByText("You’re on the list.")).toBeVisible();
  await expect(page.getByText(/when your first case is ready/i)).toBeVisible();
});

test("the waitlist card remains usable at every required viewport", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeInViewport();
  await page.getByLabel("Email").fill("viewport-check@example.invalid");
  await expect(
    page.getByRole("button", { name: "Join the waitlist" }),
  ).toBeEnabled();
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
});
