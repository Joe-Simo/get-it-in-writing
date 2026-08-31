import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    testTimeout: 20_000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "convex/**/*.test.ts"],
    server: {
      deps: {
        // Ships raw TypeScript (test helper + component modules) that vitest
        // must transform rather than externalize.
        inline: ["@convex-dev/rate-limiter"],
      },
    },
  },
});
