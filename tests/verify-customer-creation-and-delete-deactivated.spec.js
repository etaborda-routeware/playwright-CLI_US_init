// @ts-check
// NOTE: Ported from UK-PW-automation, then checked live against
// hauler.qa.smartcity.routeware.com on 2026-09-07 - confirmed WRONG as
// originally written, exactly as the UK version's own comment predicted.
// That comment said this behavior (Create Customer hidden, no row-level
// Delete) is caused specifically by "UK Address Data" being active for the
// UK vendor - a UK-only feature flag. Live-checked: this US/QA tenant
// ("Eliana -QAUSA") does NOT have that flag - a "Create Customer" button
// IS present, and row-level Delete IS present (row buttons: Send Email,
// Add Job, Delete). Also fixed a wrong domain (hauler.dev.smartcity... -
// this tenant only exists on hauler.qa.smartcity...; every other scenario/
// the runner itself already use the qa host).
//
// Assertions below are inverted from the UK original to match: this now
// verifies the create/delete affordances are present, rather than exercising
// full create+delete (unlike create-vehicle.spec.js / create-delete-staff.spec.js) -
// customer records here carry multiple locations/addresses per customer, so
// a full create-and-delete flow needs more form exploration than a presence
// check; revisit if deeper customer CRUD coverage is wanted later.
import { test, expect } from '@playwright/test';

test('Customer creation and delete deactivated', async ({ page }) => {
  const customersUrl = '/customers/customers';

  // The setup project authenticates before tests and every project reuses
  // its saved storage state, so this test can go straight to the page it's
  // testing.
  await page.goto(customersUrl);
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 15000 });

  // 1. Create Customer button is present.
  const createCustomerCount = await page.getByRole('button', { name: 'Create Customer' }).count();
  expect(createCustomerCount, 'Create Customer button is missing, expected present').toBeGreaterThan(0);

  // 2. The user is able to remove/delete a customer - verified via the row
  // action buttons themselves (confirmed live against this list's actual
  // row markup) rather than a page-wide text search, since "Delete" also
  // legitimately appears elsewhere (e.g. Delete Location inside a
  // customer's own edit page).
  const firstRow = page.locator('[id^="customer-"][id$="-send-mail"]').first().locator('xpath=../..');
  await expect(firstRow).toBeVisible({ timeout: 15000 });
  const deleteButtonInRow = firstRow.locator('button').filter({ hasText: /Delete/i });
  await expect(deleteButtonInRow, 'No Delete action found on the customer row, expected one to be present').not.toHaveCount(0);
});
