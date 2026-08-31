import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the private wallet starts empty and exposes the real decision intake", async ({
  page,
}, testInfo) => {
  test.skip(
    !["desktop", "mobile-390"].includes(testInfo.project.name),
    "The authenticated journey runs once per desktop and phone layout",
  );
  // Sign-ups are closed; the authenticated journey rides the demo wallet.
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill("judge@getitinwriting.demo");
  await page.getByLabel("Password").fill("dont-rely-on-probably");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("heading", {
      name: /your decisions.*with the uncertainty removed/i,
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "New decision" }).first().click();
  await expect(
    page.getByRole("heading", { name: /what are you about.*to rely on/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Official page")).toBeVisible();
  await expect(page.getByLabel("What must be true?")).toBeVisible();
  await expect(
    page.getByText(/this starts private research.*does not contact anyone/i),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("the unauthenticated wallet gate is keyboard accessible", async ({
  page,
}, testInfo) => {
  test.skip(
    !["desktop", "mobile-390"].includes(testInfo.project.name),
    "The keyboard gate runs once per desktop and phone layout",
  );
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Open your decisions." }),
  ).toBeVisible();
  await page.getByLabel("Email").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
