import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Load .env (Node 24 built-in) so opt-in integration/smoke tests can reach Supabase.
// Guarded: CI without a .env relies on its injected environment. Unit tests ignore these.
try {
  process.loadEnvFile();
} catch {
  // no .env file present — use the already-injected environment
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
