// @ts-check
// NOTE: New on 2026-09-25 - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (at port time the QA frontend was
// serving a broken build: its main JS bundle URL returned index.html, so
// the app never rendered). This is the US-side counterpart to the UK repo's
// UK-only scenarios, which were deliberately NOT ported:
// verify-uk-address-data-activated.js (C65966),
// verify-uk-address-import-menu-option.js (C65968), and the twelve
// verify-uk-street-data-*.js (SCP-5016 - Ordnance Survey <-> OpenStreetMap
// street-network provider). Those all assert UK features are ON; for a US
// vendor the meaningful regression is the opposite - that they're not
// active here. A UK flag bleeding onto this tenant is what flipped the
// Create Customer / Delete behavior (see
// verify-customer-creation-and-delete-deactivated.spec.js).
//
// "Inactive" means absent OR present-but-unchecked, since the Routeware
// Admin Features grid may well render every flag for every tenant. Nothing
// here is clicked - these are shared vendor settings.
import { test, expect } from '@playwright/test';

test('Verify UK-only features are inactive', async ({ page }) => {
  const settingsUrl = '/account-settings';
  const ukFlags = [
    { name: 'UKAddressData', label: 'UK Address Data' },
    { name: 'UKStreetData', label: 'UK Street Data' },
  ];

  await page.goto(settingsUrl);
  await page.waitForURL('**/account-settings', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 15000 });
  // Wait for the flag grid itself to hydrate before counting controls -
  // otherwise "absent" could just mean "not rendered yet".
  await expect(page.locator('input[type="checkbox"]').first()).toBeAttached({ timeout: 15000 });

  const flagStates = {};
  for (const { name, label } of ukFlags) {
    const control = page.locator(`input[name="${name}"]`);
    if (await control.count() === 0) {
      flagStates[label] = 'absent';
      continue;
    }
    const isChecked = await control.isChecked();
    flagStates[label] = isChecked ? 'checked' : 'unchecked';
    expect(isChecked, `UK-only flag "${label}" is checked on this US tenant, expected absent or unchecked`).toBe(false);
  }

  // "UK Address Import" is the Customers > More menu entry that UK Address
  // Data adds (C65968) - it should not be offered here.
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 15000 });

  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  let ukAddressImport = 'no-more-menu';
  const moreButton = page.getByRole('button', { name: 'More', exact: true });
  if (await moreButton.count() > 0) {
    await moreButton.click();
    // Anchor on a menu item that exists regardless of region (UK original
    // listed Customer Import first) so "absent" isn't just "not open yet".
    await expect(page.getByRole('button', { name: 'Customer Import', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'UK Address Import', exact: true }), '"UK Address Import" is offered in the Customers > More menu on this US tenant, expected absent').toHaveCount(0);
    ukAddressImport = 'absent';
  }

  test.info().annotations.push({ type: 'uk-only-features', description: JSON.stringify({ flagStates, ukAddressImport }) });
});
