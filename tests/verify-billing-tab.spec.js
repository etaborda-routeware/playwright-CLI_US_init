// @ts-check
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). The UK original went straight to a hardcoded
// UK customer (/customers/customers/3382483/edit), which doesn't exist on
// this tenant. It now opens the first customer in the list instead (same
// approach as verify-location-creation-available.spec.js), so it doesn't depend
// on any fixed record.
// Still to confirm live: the "Billing Details" tab name on this tenant.
import { test, expect } from '@playwright/test';

test('Verify customer Billing tab', async ({ page }) => {
  // Each test gets its own fresh page (unlike the old scenarios/ runner,
  // where every scenario shared one already-navigated page) - the setup
  // project's storage state keeps it authenticated, but it still needs an
  // explicit starting point of its own.
  await page.goto('/dashboard/all-ops');

  // Navigate via the in-app nav link rather than page.goto() - on the UK
  // tenant a cold, direct navigation to /customers/customers crashed the app
  // (see verify-location-creation-available.spec.js).
  await page.getByRole('link', { name: 'Customers' }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 15000 });

  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  const firstCustomerName = page.locator('[id^="customer-"][id$="-name"]').first();
  await expect(firstCustomerName).toBeVisible({ timeout: 15000 });
  const customerName = (await firstCustomerName.textContent()).trim();
  await firstCustomerName.click();
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  const customerId = page.url().match(/\/customers\/customers\/(\d+)\/edit/)?.[1];

  const billingTab = page.getByRole('tab', { name: /^Billing Details$/i });
  await expect(billingTab).toBeVisible({ timeout: 15000 });
  await billingTab.click();

  // Confirm the tab is actually active (not just clicked) via its
  // aria-selected state, rather than a brittle hard-coded CSS path.
  await page.waitForFunction(
    () => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Billing Details',
    { timeout: 15000 }
  );
});
