import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), powerApps()],
  server: {
    // Coverage and Playwright reports change during test runs; they are not app sources.
    watch: { ignored: ["**/coverage/**", "**/playwright-report/**", "**/test-results/**"] },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
