import { defineConfig } from "vite";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    benchmark: {
      include: ["bench/**/*.bench.ts"],
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.js"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
