import { defineConfig, devices } from "@playwright/test";

const docsPort = 43240;

export default defineConfig({
  testDir: "./tests/docs",
  testMatch: ["**/*.spec.ts"],
  use: { baseURL: `http://127.0.0.1:${docsPort}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "pnpm --filter ./modules/docs build && pnpm --filter ./modules/docs preview",
    port: docsPort,
    reuseExistingServer: false,
  },
});
