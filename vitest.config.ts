import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/generated/**",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/data/repo.ts",
        "src/data/repoContract.ts",
        "**/*.test.{ts,tsx}",
      ],
      thresholds: {
        lines: 70,
        "src/data/**": { lines: 90 },
        "src/features/**": { lines: 90 },
      },
    },
  },
});
