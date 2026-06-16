/**
 * SignalVault — E2E happy-path: register and land on vault
 *
 * NOTE: This spec requires:
 *   1. The backend running at http://localhost:8080
 *   2. Playwright browsers installed: pnpm dlx playwright install chromium
 *
 * Run with: pnpm e2e
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-${Date.now()}@signalvault.test`;
const TEST_PASSWORD = "Signal!Vault2026";

test("visit /login, register a new account, arrive at /vault", async ({
  page,
}) => {
  // 1. Navigate to the app root — should redirect to /vault then to /login
  await page.goto("/");
  await page.waitForURL("**/login**", { timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);

  // 2. Go to register page
  await page.click("text=Create one");
  await page.waitForURL("**/register**");

  // 3. Fill in registration form
  await page.fill('input[type="email"]', TEST_EMAIL);

  const pwFields = page.locator('input[type="password"]');
  await pwFields.nth(0).fill(TEST_PASSWORD);
  await pwFields.nth(1).fill(TEST_PASSWORD);

  // 4. Submit
  await page.click('button[type="submit"]');

  // 5. Should land on /vault (backend must be running)
  await page.waitForURL("**/vault**", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/vault/);

  // 6. Vault unlock screen should be visible (vault is locked by default)
  await expect(page.getByText(/unlock your vault/i)).toBeVisible();
});

test("navigates to /login when not authenticated", async ({ page }) => {
  // Clear any existing session cookies
  await page.context().clearCookies();
  await page.goto("/vault");
  await page.waitForURL("**/login**", { timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/welcome back/i)).toBeVisible();
});
