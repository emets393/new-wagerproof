import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // agents-v3 is a nested package with no vitest of its own — one `npm test`
    // at the root stays the single gate for web + the V3 worker.
    include: ["src/**/*.test.ts", "agents-v3/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
