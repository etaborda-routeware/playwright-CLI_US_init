// @ts-check
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). No tenant-specific values in this flow, so
// the body is unchanged from the UK original.
// Still to confirm live: all five headings exist on this tenant -
// "Routeware Admin Features" in particular depends on this account's role.
import { test, expect } from '@playwright/test';

test('Verify Application Settings page', async ({ page }) => {
  // Each test gets its own fresh page (unlike the old scenarios/ runner,
  // where every scenario shared one already-navigated page) - the setup
  // project's storage state keeps it authenticated, but it still needs an
  // explicit starting point of its own.
  await page.goto('/dashboard/all-ops');

  await page.locator('#menu-settings-button > svg').click();

  const appSettingsLink = page.getByText('Application Settings', { exact: true });
  await expect(appSettingsLink).toBeVisible({ timeout: 15000 });
  await appSettingsLink.click();
  await page.waitForURL('**/account-settings', { timeout: 15000 });

  const headings = [
    'Application Settings',
    'User Profile',
    'Company Configuration',
    'Features',
    'Routeware Admin Features',
  ];

  for (const heading of headings) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 15000 });
  }
});
