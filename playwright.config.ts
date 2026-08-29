import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: {
      args: [
        "--enable-unsafe-webgpu",
        "--use-angle=metal",
        "--enable-dawn-features=allow_unsafe_apis",
        "--disable-gpu-sandbox",
      ],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "CONVEX_AGENT_MODE=anonymous bun node_modules/convex/dist/cli.bundle.cjs dev --tail-logs disable --typecheck disable",
      url: "http://127.0.0.1:3210/version",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "bun run preview --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
