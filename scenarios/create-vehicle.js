// name: Create and Delete Vehicle
// NOTE: Ported from UK-PW-automation, then live-verified and fixed up against
// hauler.qa.smartcity.routeware.com on 2026-09-07. Drift found and fixed:
// - Vehicle Type has no "Commercial" option here (actual: Cart, Delivery /
//   Utility, Front Load, Residential, Roll Off, Snow Plow, Street Sweeper),
//   and Vehicle Subtype has no "Multi Stream" option (options depend on the
//   selected type, e.g. Residential -> Side Load, Slinger, Batch Side Load,
//   Tipper, Loader, Picker, Grappler) - both now select randomly, same as
//   the other dropdowns below.
// - The "Container Color" (binColors) field doesn't exist on this tenant's
//   Create Vehicle form at all - that step has been removed.
// All field names/selectors, the save/search/delete flow, and the success
// toasts ("Vehicle was saved successfully.", row Options buttons) matched
// the UK original exactly and needed no changes.
async page => {
  async function selectRandomOption(trigger) {
    await trigger.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    const count = await options.count();
    await options.nth(Math.floor(Math.random() * count)).click();
  }

  const vehicleName = `Vehicle-Test-${Date.now()}`;
  const suffix = () => Math.floor(Math.random() * 1e9);
  const weight = 500 + Math.floor(Math.random() * 4500);

  // 1. Fleet -> Vehicles
  await page.getByRole('link', { name: 'Fleet' }).click();
  await page.waitForURL('**/fleet/vehicles');
  await page.getByRole('heading', { name: 'Vehicles' }).waitFor({ state: 'visible', timeout: 15000 });

  // 2. Create Vehicle
  await page.getByRole('link', { name: 'Create Vehicle' }).click();
  await page.waitForURL('**/fleet/vehicles/create');
  await page.getByRole('heading', { name: 'Create Vehicle' }).waitFor({ state: 'visible', timeout: 15000 });

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
  await page.getByText('Vehicle was saved successfully.').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForURL('**/fleet/vehicles');

  // 10. Search for the created vehicle
  // (checking the unfiltered list here is unreliable once there are enough
  // leftover test vehicles that the new one isn't in the initially-rendered
  // set - the search below is the real, reliable verification.)
  const searchBox = page.getByRole('textbox', { name: 'Search' });
  await searchBox.fill(vehicleName);
  const nameCell = page.getByText(vehicleName, { exact: true });
  await nameCell.waitFor({ state: 'visible', timeout: 10000 });

  // Scope to this vehicle's own row (not just any row on the page) - the
  // list can still be showing leftover rows from earlier runs while the
  // search filter is debouncing, so a page-wide button locator is unsafe.
  const row = nameCell.locator('xpath=..');

  // 11. Verify Vehicle Details and Delete icons are displayed under Options
  const detailsButton = row.locator('button').filter({ hasText: 'Vehicle Details' });
  const deleteButton = row.locator('button').filter({ hasText: /^Delete$/ });
  await detailsButton.waitFor({ state: 'visible', timeout: 10000 });
  await deleteButton.waitFor({ state: 'visible', timeout: 10000 });

  // 12. Click Delete icon
  await deleteButton.click();

  // 13. Confirm popup - click Yes
  // force:true - this dialog re-renders/repositions while open, which makes
  // Playwright's normal stability check hang for a long time (observed
  // multi-minute stalls) before eventually timing out. Even with force:true
  // the click can still occasionally land mid-re-render and report "Element
  // is not visible" - confirmed live that a moment later the exact same
  // button is visible/enabled again, so retry a couple of times rather than
  // failing the whole scenario on that one-off race.
  await page.getByText('Are you sure you want to delete this vehicle?').waitFor({ state: 'visible', timeout: 10000 });
  const yesButton = page.getByRole('button', { name: 'Yes' });
  for (let attempt = 1; ; attempt++) {
    try {
      await yesButton.click({ force: true });
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
      await page.waitForTimeout(300);
    }
  }
  await page.getByText('Vehicle deleted.').waitFor({ state: 'visible', timeout: 10000 });

  // 14. Search again to confirm the deleted vehicle no longer appears
  await searchBox.fill(vehicleName);
  await page.getByText('No Vehicles Found.').waitFor({ state: 'visible', timeout: 10000 });
  if (await page.getByText(vehicleName, { exact: true }).count() > 0) {
    throw new Error(`Vehicle ${vehicleName} still appears in list after deletion`);
  }

  return { vehicleName, weight, status: 'created-verified-deleted' };
}
