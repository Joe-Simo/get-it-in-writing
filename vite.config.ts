import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/convex") || id.includes("node_modules/@convex-dev/auth")) return "convex";
          if (id.includes("node_modules/vgpu")) return "gpu";
          if (id.includes("node_modules/radix-ui") || id.includes("node_modules/lucide-react")) return "ui";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
