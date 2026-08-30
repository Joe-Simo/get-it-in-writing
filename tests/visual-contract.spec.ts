/// <reference lib="dom" />

import { expect, test } from "@playwright/test";

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One production Chromium pass is sufficient");
});

test("the promise seal has a readable no-WebGPU fallback", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const seal = page.locator(".promise-seal").first();
  await expect(seal).toHaveAttribute("data-webgpu", /ready|fallback/);
  const mode = await seal.getAttribute("data-webgpu");
  if (mode === "fallback") {
    await expect(seal.locator(".promise-seal-fallback")).toBeVisible();
  } else {
    await expect(seal.locator("canvas")).toBeVisible();
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
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    sealDisplay: getComputedStyle(document.querySelector(".promise-seal")!).display,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.sealDisplay).toBe("none");
  await expect(page.getByLabel("Official page")).toBeVisible();
  await expect(page.getByLabel("What must be true?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check before I rely on it" })).toBeEnabled();
  await page.screenshot({ path: "artifacts/qa/landing-forced-colors-zoom.png" });
});
