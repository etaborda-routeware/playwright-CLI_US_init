// @ts-check
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Only the host changed (dev.smartcity...uk ->
// qa.smartcity...com).
// Still to confirm live: this tenant shows the same four top-level menus
// (Fleet and Customers are already confirmed by the 2026-09-07 ports;
// Dispatch and Insights are not).
import { test, expect } from '@playwright/test';

test('Verify main page displays the required menus', async ({ page }) => {
  const dashboardUrl = '/dashboard/all-ops';

  // The setup project authenticates before tests and every project reuses
  // its saved storage state, so this test can go straight to the page it's
  // testing.
  await page.goto(dashboardUrl);
  await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });

  const menus = ['Dispatch', 'Customers', 'Fleet', 'Insights'];
  for (const menu of menus) {
    const menuLink = page.getByRole('link', { name: menu, exact: true });
    await expect(menuLink).toBeVisible({ timeout: 15000 });
  }
});
