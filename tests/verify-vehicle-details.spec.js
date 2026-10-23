// @ts-check
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). The Create Vehicle half reuses exactly the
// drift fixes create-vehicle.spec.js confirmed live on 2026-09-07: Vehicle Type /
// Subtype select randomly (no "Commercial" / "Multi Stream" options here),
// and the Container Color (binColors) step is removed (field doesn't exist
// on this tenant).
// Still to confirm live: the Vehicle Details heading/page title and
// the five log/section names asserted in step 15.
import { test, expect } from '@playwright/test';

test('Verify Vehicle details', async ({ page }) => {
  async function selectRandomOption(trigger) {
    await trigger.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    const count = await options.count();
    await options.nth(Math.floor(Math.random() * count)).click();
  }

  const vehicleName = `Vehicle-Test-${Date.now()}`;
  const suffix = () => Math.floor(Math.random() * 1e9);
  const weight = 500 + Math.floor(Math.random() * 4500);

  // Each test gets its own fresh page (unlike the old scenarios/ runner,
  // where every scenario shared one already-navigated page) - the setup
  // project's storage state keeps it authenticated, but it still needs an
  // explicit starting point of its own.
  await page.goto('/dashboard/all-ops');

  // 1. Fleet -> Vehicles
  await page.getByRole('link', { name: 'Fleet' }).click();
  await page.waitForURL('**/fleet/vehicles');
  await expect(page.getByRole('heading', { name: 'Vehicles' })).toBeVisible({ timeout: 15000 });

  // 2. Create Vehicle
  await page.getByRole('link', { name: 'Create Vehicle' }).click();
  await page.waitForURL('**/fleet/vehicles/create');
  await expect(page.getByRole('heading', { name: 'Create Vehicle' })).toBeVisible({ timeout: 15000 });

  // 3. Vehicle name (dynamic)
  await page.locator('input[name="regplate"]').fill(vehicleName);

  // 4. Device Type - check all
  await page.locator('label').filter({ hasText: 'SmartCity App' }).check();
  await page.locator('label').filter({ hasText: /^Telematics Device$/ }).check();
  await page.locator('label').filter({ hasText: /^Vision AI$/ }).check();

  // 5. Vehicle Type - random selection (this tenant has no "Commercial"
  // option; see NOTE at top of file).
  await selectRandomOption(page.locator('#vehicleTypeId'));

  // 6. Vehicle Subtype - random selection (options depend on the Vehicle
  // Type just chosen, and this tenant has no "Multi Stream" option; give
  // the form a moment to repopulate the subtype list before opening it).
  await page.waitForTimeout(500);
  await selectRandomOption(page.locator('#vehicleSubTypeId'));

  // 7. Remaining dropdowns - random selection
  await selectRandomOption(page.locator('#isAvailable'));
  await selectRandomOption(page.locator('#locationId'));
  await selectRandomOption(page.locator('#tareUnitOfMeasureTypeId'));
  await selectRandomOption(page.locator('#deviceManufacturerId'));

  // 8. Text / number fields - random dynamic values
  await page.getByRole('spinbutton').fill(String(weight));
  await page.locator('input[name="deviceId"]').fill(`TEL-${suffix()}`);
  await page.locator('input[name="surfSightDeviceNumber"]').fill(`SURF-${suffix()}`);
  await page.locator('input[name="rubiconZDeviceId"]').fill(`VISION-${suffix()}`);

  // 9. Save
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Vehicle was saved successfully.')).toBeVisible({ timeout: 10000 });
  await page.waitForURL('**/fleet/vehicles');

  // 10. Search for the created vehicle
  // (checking the unfiltered list here is unreliable once there are enough
  // leftover test vehicles that the new one isn't in the initially-rendered
  // set - the search below is the real, reliable verification.)
  const searchBox = page.getByRole('textbox', { name: 'Search' });
  await searchBox.fill(vehicleName);
  // Wait for the debounced filter to actually settle (reflected in the URL)
  // before interacting with row buttons - acting too early risks clicking
  // a row that's still being replaced by the filtered re-render. This is an
  // in-page history.pushState update, not a real navigation, so
  // waitForURL (which waits for a "load") won't resolve here - poll
  // location directly instead.
  await page.waitForFunction(
    (name) => location.search.includes(`searchTerm=${encodeURIComponent(name)}`),
    vehicleName,
    { timeout: 10000 }
  );
  const nameCell = page.getByText(vehicleName, { exact: true });
  await expect(nameCell).toBeVisible({ timeout: 10000 });

  // Scope to this vehicle's own row (not just any row on the page) - the
  // list can still be showing leftover rows from earlier runs while the
  // search filter is debouncing, so a page-wide button locator is unsafe.
  const row = nameCell.locator('xpath=..');

  // 11. Verify Vehicle Details and Delete icons are displayed under Options
  const detailsButton = row.locator('button').filter({ hasText: 'Vehicle Details' });
  const deleteButton = row.locator('button').filter({ hasText: /^Delete$/ });
  await expect(detailsButton).toBeVisible({ timeout: 10000 });
  await expect(deleteButton).toBeVisible({ timeout: 10000 });

  // 12. Click Vehicle Details
  // The row can still be settling right after the search filter applies
  // (scroll position / layout not final yet). force:true would skip
  // Playwright's auto-scroll-into-view and can click blind off-screen, so
  // scroll explicitly, give layout a moment to settle, then use a normal
  // click (which re-verifies visibility/stability on its own).
  await detailsButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await detailsButton.click();

  // 13. Verify we're on the Vehicle Details page
  await page.waitForURL(/\/fleet\/vehicles\/\d+/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: `Vehicle ${vehicleName}` })).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveTitle(/Vehicle Details/);

  // 14. Verify Vehicle Details page sections
  await expect(page.getByText('Preventative Maintenance Log', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Vehicle Fuel Log', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Vehicle Issues', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Vehicle Inspection Log', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Vehicle Fault Codes', { exact: true })).toBeVisible({ timeout: 10000 });
});
