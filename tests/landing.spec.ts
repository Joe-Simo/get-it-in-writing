import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the landing page makes the decision-protection outcome immediately clear", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: /don’t rely on.*probably/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Official page")).toBeVisible();
  await expect(page.getByLabel("What must be true?")).toBeVisible();
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

test("the primary action preserves the draft and reaches private sign in", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Official page").fill("https://example.com/rooms");
  await page
    .getByLabel("What must be true?")
    .fill("We need connecting rooms, not merely adjacent rooms.");
  await page.getByRole("button", { name: "Check before I rely on it" }).click();

  await expect(page).toHaveURL(/\/app\/new$/);
  await expect(
    page.getByRole("heading", { name: "Open your decisions." }),
  ).toBeVisible();
});

test("the decision intake remains usable at every required viewport", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Official page")).toBeInViewport();
  await page.getByLabel("Official page").fill("https://example.com/product");
  await page
    .getByLabel("What must be true?")
    .fill("The product must include a two-year written warranty.");
  await expect(
    page.getByRole("button", { name: "Check before I rely on it" }),
  ).toBeEnabled();
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
});
