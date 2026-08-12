import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // CI-only: spin up a preview server so smoke tests have something to hit.
  // Locally, run `bun run dev` separately and tests will reuse it.
  webServer: process.env.CI
    ? {
        command: "bun run preview --port 5173 --host 127.0.0.1",
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          VITE_SUPABASE_URL: "https://example.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "dummy",
          VITE_SUPABASE_PROJECT_ID: "example",
        },
      }
    : {
        command: "bun run dev --port 5173",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
