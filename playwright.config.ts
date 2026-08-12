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
  // CI-only: serve the built worker so smoke tests have something to hit.
  // Locally, run `bun run dev` separately and tests will reuse it.
  //
  // `vite preview` cannot serve this build: the Cloudflare plugin emits
  // dist/server/index.js plus a generated wrangler.json, while TanStack's
  // preview plugin looks for dist/server/server.js and dies with
  // ERR_MODULE_NOT_FOUND. wrangler dev runs the same artifact we deploy.
  //
  // No env block here — VITE_* vars are inlined at build time (see the `define`
  // block in vite.config.ts), so they must be set on the build step in CI, not
  // on the server that serves the finished bundle.
  webServer: process.env.CI
    ? {
        command: "bunx wrangler dev -c dist/server/wrangler.json --port 5173 --ip 127.0.0.1",
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        command: "bun run dev --port 5173",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
