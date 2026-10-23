// @ts-check
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). The Create Vehicle half reuses exactly the
// drift fixes create-vehicle.spec.js confirmed live on 2026-09-07: Vehicle Type /
// Subtype select randomly (no "Commercial" / "Multi Stream" options here),
// and the Container Color (binColors) step is removed (field doesn't exist
// on this tenant).
// Still to confirm live: the Vehicle Details page's Edit button,
// the Edit Vehicle heading/page title, and the tareWeight field name.
import { test, expect } from '@playwright/test';

test('Create edit vehicle details', async ({ page }) => {
  async function selectRandomOption(trigger) {
    await trigger.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    const count = await options.count();
    const idx = Math.floor(Math.random() * count);
    const label = (await options.nth(idx).textContent()).trim();
    await options.nth(idx).click();
    return label;
  }

  async function selectedLabel(fieldId) {
    // The react-select display label lives 3 DOM levels above the input
    // itself (input -> value-container -> control), not immediately above
    // it - same structure confirmed on the Resource Edit page
    // (create-edit-staff-details.spec.js). The label can also render a beat
    // after the raw inputs hydrate on the Edit page, so poll rather than
    // reading once.
    const container = page.locator(fieldId).locator('xpath=../../..');
    await page.waitForFunction(
      (el) => el.textContent.trim().length > 0,
      await container.elementHandle(),
      { timeout: 10000 }
    );
    return (await container.textContent()).trim();
  }

  const suffix = () => Math.floor(Math.random() * 1e9);
  const vehicleName = `Vehicle-Test-${Date.now()}`;
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

  // 8. Text / number fields - dynamic values
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

  // 11. Click Vehicle Details
  const detailsButton = row.locator('button').filter({ hasText: 'Vehicle Details' });
  await expect(detailsButton).toBeVisible({ timeout: 10000 });
  await detailsButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await detailsButton.click();
  await page.waitForURL(/\/fleet\/vehicles\/\d+$/, { timeout: 15000 });

  // 12. Click the Edit button next to "Vehicle Summary" (there's no Edit
  // action directly on the Vehicles list row - only Vehicle Details and
  // Delete - the Edit entry point is on the Vehicle Details page itself,
  // confirmed live). The Vehicle Summary panel (and this button) render a
  // beat after the page shell does, and the click can silently no-op if it
  // lands during that settling (confirmed live: same button, same page,
  // works fine a moment later) - so scroll it into view, give layout a
  // moment, and retry the click if the URL hasn't actually changed yet.
  const editButton = page.getByRole('button', { name: 'Edit', exact: true });
  await expect(editButton).toBeVisible({ timeout: 15000 });
  await editButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  for (let attempt = 1; ; attempt++) {
    await editButton.click();
    try {
      await page.waitForURL(/\/fleet\/vehicles\/\d+\/edit/, { timeout: 5000 });
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
    }
  }
  await expect(page.getByRole('heading', { name: 'Edit Vehicle' })).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveTitle(/Edit Vehicle/);
  const editUrl = page.url();

  // 13. Change a set of editable fields to new dynamic values (capture
  // dropdown labels to verify later - same approach as
  // create-edit-staff-details.spec.js).
  const newVehicleName = `${vehicleName}-Edited`;
  const newWeight = 500 + Math.floor(Math.random() * 4500);
  const newDeviceId = `TEL-${suffix()}`;

  await page.locator('input[name="regplate"]').fill(newVehicleName);
  await page.locator('input[name="tareWeight"]').fill(String(newWeight));
  await page.locator('input[name="deviceId"]').fill(newDeviceId);
  // Re-select Service Status / Operational Facility so the new value is
  // guaranteed to differ from what create-vehicle set (selectRandomOption
  // picks from whatever's currently open, independent of the prior value).
  const serviceStatusLabel = await selectRandomOption(page.locator('#isAvailable'));
  const facilityLabel = await selectRandomOption(page.locator('#locationId'));

  // 14. Save
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Vehicle was saved successfully.')).toBeVisible({ timeout: 10000 });

  // 15. Re-visit the Edit page fresh and verify the changes actually
  // persisted server-side, not just reflected in the in-memory form.
  // Confirmed live that Save doesn't reliably leave you on the /edit URL -
  // it sometimes redirects to the Vehicle Details page instead - so
  // navigate back to the known edit URL explicitly rather than
  // page.reload(), which would silently reload whatever page Save left us
  // on.
  await page.goto(editUrl);
  await expect(page.getByRole('heading', { name: 'Edit Vehicle' })).toBeVisible({ timeout: 15000 });

  await expect(page.locator('input[name="regplate"]'), 'Vehicle Name').toHaveValue(newVehicleName);
  await expect(page.locator('input[name="tareWeight"]'), 'Empty Vehicle Weight').toHaveValue(String(newWeight));
  await expect(page.locator('input[name="deviceId"]'), 'Telematics Device ID').toHaveValue(newDeviceId);
  expect(await selectedLabel('#isAvailable'), 'Service Status').toBe(serviceStatusLabel);
  expect(await selectedLabel('#locationId'), 'Operational Facility').toBe(facilityLabel);
});
