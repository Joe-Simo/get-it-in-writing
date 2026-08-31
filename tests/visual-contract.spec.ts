/// <reference lib="dom" />

import { expect, test } from "@playwright/test";

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One production Chromium pass is sufficient");
});

test("the ink stage has a readable no-WebGPU fallback", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const stage = page.locator(".ink-stage").first();
  await expect(stage).toHaveAttribute("data-webgpu", /ready|fallback|static/);
  const mode = await stage.getAttribute("data-webgpu");
  if (mode === "ready") {
    await expect(stage.locator("canvas")).toBeVisible();
  } else {
    // Fallback and reduced-motion render the static promise seal, which has
    // its own no-WebGPU chain ending in a visible glyph.
    const seal = stage.locator(".promise-seal");
    await expect(seal).toHaveAttribute("data-webgpu", /ready|fallback/);
    const sealMode = await seal.getAttribute("data-webgpu");
    if (sealMode === "fallback") {
      await expect(seal.locator(".promise-seal-fallback")).toBeVisible();
    } else {
      await expect(seal.locator("canvas")).toBeVisible();
    }
  }
});

test("reduced motion removes repeating interface animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(
    await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
  ).toBe(true);
  const repeatingAnimations = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations === Infinity)
      .length,
  );
  expect(repeatingAnimations).toBe(0);
  await page.screenshot({
    path: "artifacts/qa/landing-reduced-motion.png",
    animations: "disabled",
  });
});

test("forced colors and a 200-percent-equivalent viewport keep the task usable", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 });
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const stage = page.locator(".ink-stage").first();
  await expect(stage).toBeAttached();
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  await expect(stage).toHaveCSS("display", "none");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join the waitlist" })).toBeEnabled();
  await page.screenshot({ path: "artifacts/qa/landing-forced-colors-zoom.png" });
});
