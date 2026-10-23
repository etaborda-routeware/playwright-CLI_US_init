// name: Create delete facility
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Adapted using the drift already confirmed
// live by the 2026-09-07 ports:
// - Address swapped to a US one (the Mapbox autocomplete flow itself was
//   confirmed identical on this tenant by create-delete-staff.js).
// - Facility Type / Sub-Type now select randomly instead of the UK's fixed
//   "Operational Facility" / "Depot" - this tenant's vehicle dropdowns
//   turned out to have different option lists than the UK's, so fixed
//   option labels are the most likely drift point here too.
// Still to confirm live: Fleet > Facilities exists under that name (Staff
// was renamed to Resources here), the promo dialog, the "08:00 AM"/"05:00
// PM" hour labels, and the save/delete/empty-search copy.
async page => {
  async function fillAddress(input, value) {
    // Same Mapbox Geocoding autocomplete pattern as the Resource Home Address
    // field (see create-delete-staff.js) - the suggestions render as a
    // plain <ul><li> sibling of the input, and the field only persists the
    // *selected* suggestion's text, not whatever was literally typed.
    await input.fill(value);
    const suggestion = input.locator('xpath=../ul/li').first();
    await suggestion.waitFor({ state: 'visible', timeout: 10000 });
    const selectedText = (await suggestion.textContent()).trim();
    await suggestion.click();
    return selectedText;
  }

  async function selectRandomOption(trigger) {
    await trigger.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    const count = await options.count();
    const idx = Math.floor(Math.random() * count);
    const label = (await options.nth(idx).textContent()).trim();
    await options.nth(idx).click();
    return label;
  }

  async function selectTimeOption(trigger, label) {
    // The Weekday/Weekend Hours fields are react-select comboboxes, but
    // this instance's option elements don't carry the `id="react-select-
    // N-option-M"` pattern the other react-selects in this app use
    // (confirmed live on the UK tenant via direct DOM inspection) - filter
    // on the generic react-select "-option" CSS class instead.
    await trigger.click({ force: true });
    await page.locator('[class*="-option"]').filter({ hasText: label }).click();
  }

  const facilityName = `Facility-Test-${Date.now()}`;
  const owner = `Owner-${Math.floor(Math.random() * 1e6)}`;
  const address = '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA';

  // 1. Fleet -> Facilities
  await page.getByRole('link', { name: 'Fleet' }).click();
  await page.waitForURL('**/fleet/vehicles');
  await page.getByRole('link', { name: 'Facilities' }).click();
  await page.waitForURL('**/fleet/facilities');
  await page.getByRole('heading', { name: 'Facilities' }).waitFor({ state: 'visible', timeout: 15000 });

  // A promo dialog ("Register now for SmartCity Office Hours!") can appear
  // on load and sits on top of the page - close it if present so it
  // doesn't intercept later clicks.
  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  // 2. Create Facility - opens an in-page "Add Facility" side panel
  // (no URL/route change, unlike Create Vehicle/Resource).
  await page.getByRole('button', { name: 'Create Facility' }).click();
  await page.getByRole('heading', { name: 'Add Facility' }).waitFor({ state: 'visible', timeout: 10000 });

  // 3. Facility Type / Sub-Type - random selection (Sub-Type is disabled
  // until a Type is chosen, and its options depend on that Type - give the
  // form a moment to repopulate it before opening).
  const facilityType = await selectRandomOption(page.locator('#facilityType'));
  await page.waitForTimeout(500);
  const facilitySubType = await selectRandomOption(page.locator('#facilitySubType'));

  // 4. Name / Address / Owner
  await page.locator('input[name="name"]').fill(facilityName);
  const selectedAddress = await fillAddress(page.locator('input[name="address"]'), address);
  await page.locator('input[name="owner"]').fill(owner);

  // 5. Days of Operation - checking a day unlocks that day-group's Hours
  // fields (Weekday Hours From/To start disabled and "You can not leave
  // this empty" until a weekday is checked).
  await page.locator('label').filter({ hasText: /^Monday$/ }).check();
  await selectTimeOption(page.locator('#facilityDaysOfOperation\\.weekHoursBegin'), '08:00 AM');
  await selectTimeOption(page.locator('#facilityDaysOfOperation\\.weekHoursEnd'), '05:00 PM');

  // Active defaults to checked - leave it as-is for this scenario.

  // 6. Save
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('The Facility was successfully saved!').waitFor({ state: 'visible', timeout: 10000 });

  // 7. Search for the created facility
  const searchBox = page.getByRole('textbox', { name: 'Search' });
  await searchBox.fill(facilityName);
  const nameCell = page.getByText(facilityName, { exact: true });
  await nameCell.waitFor({ state: 'visible', timeout: 10000 });

  // Scope to this facility's own row (not just any row on the page). The
  // name/address cell is itself nested one level below the row, so go up
  // two levels to reach the row that also holds the Options buttons
  // (unlike the Vehicles/Resources lists, where the name cell's immediate
  // parent already is the row).
  const row = nameCell.locator('xpath=../..');

  // 8. Verify Edit and Delete icons are displayed under Options
  const editButton = row.locator('button').filter({ hasText: 'Edit Facility' });
  const deleteButton = row.locator('button').filter({ hasText: 'Delete Facility' });
  await editButton.waitFor({ state: 'visible', timeout: 10000 });
  await deleteButton.waitFor({ state: 'visible', timeout: 10000 });

  // 9. Click Delete icon
  await deleteButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await deleteButton.click();

  // 10. Confirm popup - click Yes
  // force:true + retry - the same delete-confirmation dialog instability
  // observed on the Vehicle/Resource delete flows (see create-vehicle.js):
  // the dialog can re-render mid-click, occasionally reporting "Element is
  // not visible" even with force:true, though the same button is
  // visible/enabled again moments later.
  await page.getByText('Are you sure you want to delete this facility?').waitFor({ state: 'visible', timeout: 10000 });
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

  // 11. Search again to confirm the deleted facility no longer appears.
  // The list doesn't refresh itself in place after a delete - clearing and
  // refilling the search box (not just re-filling the same value) is what
  // actually re-triggers the query.
  await searchBox.fill('');
  await page.waitForTimeout(300);
  await searchBox.fill(facilityName);
  await page.getByText('No facilities found.', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  if (await page.getByText(facilityName, { exact: true }).count() > 0) {
    throw new Error(`Facility ${facilityName} still appears in list after deletion`);
  }

  return { facilityName, owner, facilityType, facilitySubType, selectedAddress, status: 'created-verified-deleted' };
}
