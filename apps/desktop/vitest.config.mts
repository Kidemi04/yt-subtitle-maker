import { defineConfig } from "vitest/config";

/**
 * Unit tests for the non-React logic under `src/state/` — selection merging
 * and the generate store.
 *
 * Deliberately node-environment with no React renderer: these modules are
 * plain TS (the api-client resolves to TS source, and its constructor has no
 * side effects), so they need no jsdom, no RN preset, and no Tamagui setup.
 * Component-level rendering is out of scope here.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
