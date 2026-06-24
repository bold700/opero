import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Auth tests share one Postgres DB; run files sequentially to avoid races.
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
    testTimeout: 20000,
    env: {
      NODE_ENV: "test",
    },
  },
});
