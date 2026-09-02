import { defineConfig, devices } from "@playwright/test";

/**
 * Layout tests, which vitest cannot do.
 *
 * happy-dom has no layout engine, so every existing card test asserts what is
 * in the DOM and none of them can tell whether the thing overflows a column,
 * wraps, or centres. That gap is the same species as the M5 frontend tests
 * that all passed while the route returned 404.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:8123",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/serve.mjs",
    url: "http://localhost:8123/e2e/harness.html",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
});
