import { defineConfig } from "@playwright/test";

/** The MCP writes generated specs into ./tests and runs them against the app,
 *  which Playwright starts automatically via webServer. */
export default defineConfig({
  testDir: "./tests",
  reporter: "list",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
