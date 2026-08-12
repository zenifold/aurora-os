import { test, expect } from "@playwright/test";

// Smoke tests for the 5 critical user paths.
// These hit only the public surface (marketing + login pages) so they
// run without seeded backend data. Auth-gated paths are exercised at
// the form level — full happy-path requires a seeded test workspace.

test("marketing home renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Aurora/i);
});

test("signup page reachable", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: /sign up|create.*account/i })).toBeVisible();
});

test("login page reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("input[type=email]")).toBeVisible();
  await expect(page.locator("input[type=password]")).toBeVisible();
});

test("pricing page renders", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("client portal token route handles unknown token gracefully", async ({ page }) => {
  await page.goto("/client/invalid-token-xyz");
  // Should not crash — either an error/empty state or a redirect, not a blank screen.
  await expect(page.locator("body")).not.toBeEmpty();
});
