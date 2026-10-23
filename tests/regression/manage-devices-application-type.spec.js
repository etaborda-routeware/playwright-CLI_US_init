// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check.
// RVP-4211 Add ApplicationType to Device Registration. Every case in that
// section (C45176-C45204) starts by registering the Hauler app on a phone,
// which can't be done from here. This covers only the portal check they all
// share ("Go to VP -> Settings -> Application Settings -> Manage Devices,
// validate information"): the page has the Device Name, Application Type
// and Device Owner columns, and Device Owner is only ever BYOD or RUBICON.
import { test, expect } from '@playwright/test';

test('RVP-4211 (C45176-C45204, portal part) - Manage Devices shows Application Type and Device Owner', async ({ page }) => {
  await page.goto('/account-settings');
  await page.waitForURL('**/account-settings', { timeout: 15000 });
  await page.getByRole('button', { name: 'Manage Devices' }).or(page.getByRole('link', { name: 'Manage Devices' })).click();

  for (const column of ['Device Name', 'Application Type', 'Device Owner']) {
    await expect(page.getByText(column, { exact: true }).first(), `Manage Devices is missing the ${column} column`).toBeVisible({ timeout: 15000 });
  }

  // Read Device Owner from every rendered row by its column position.
  const headers = (await page.getByRole('columnheader').allTextContents()).map((h) => h.trim().toUpperCase());
  const ownerIndex = headers.findIndex((h) => h === 'DEVICE OWNER');
  test.skip(ownerIndex === -1, 'Manage Devices is not a role="table" - read Device Owner some other way');

  const owners = [];
  for (const row of await page.getByRole('row').all()) {
    const cells = row.getByRole('cell');
    if (await cells.count() > ownerIndex) {
      owners.push((await cells.nth(ownerIndex).textContent()).trim());
    }
  }
  test.skip(owners.length === 0, 'No registered devices for this vendor');
  for (const owner of owners) {
    expect(['BYOD', 'RUBICON'], `Unexpected Device Owner "${owner}"`).toContain(owner.toUpperCase());
  }
});
