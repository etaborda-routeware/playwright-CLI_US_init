// name: Create delete staff
// NOTE: Ported from UK-PW-automation, then live-verified and fixed up against
// hauler.qa.smartcity.routeware.com on 2026-09-07. Drift found and fixed:
// - What the UK tenant calls "Staff" (Fleet > Staff, "Create Staff", heading
//   "Staff") is called "Resources" on this tenant (Fleet > Resources,
//   "Create Resource", heading "Resources") - same underlying entity (name,
//   phone, license number, address, language, service status, facility),
//   just renamed. Nav clicks, headings, and the empty-search text below were
//   updated accordingly ("No Staff Found." -> "No Resources Found."); the
//   save/delete toasts ("Resource saved successfully.", "Resource deleted.")
//   already used the "Resource" wording and needed no change.
// - This tenant's Create Resource form has no Roles section (no
//   Driver/Supervisor checkboxes) - that step has been removed.
// The Mapbox address autocomplete flow and all other field
// names/selectors matched the UK original exactly and needed no changes.
async page => {
  async function selectRandomOption(trigger) {
    await trigger.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    const count = await options.count();
    await options.nth(Math.floor(Math.random() * count)).click();
  }

  async function fillAddress(input, value) {
    // This is a Mapbox Geocoding autocomplete field (not Google Places -
    // `.pac-item` never matches anything here, confirmed via the network
    // panel: the app calls api.mapbox.com/geocoding, and the suggestions
    // render as a plain <ul><li> sibling of the input). Typing a value alone
    // is not enough, the app only persists HomeAddress when a suggestion is
    // actually selected from the dropdown (confirmed via API: filling text
    // without selecting leaves HomeAddress null server-side).
    await input.fill(value);
    const suggestion = input.locator('xpath=../ul/li').first();
    await suggestion.waitFor({ state: 'visible', timeout: 10000 });
    await suggestion.click();
  }

  const suffix = () => Math.floor(Math.random() * 1e9);
  const firstName = `StaffFirst-${Date.now()}`;
  const lastName = `StaffLast-${suffix()}`;
  const fullName = `${firstName} ${lastName}`;
  const phone = `9${100000000 + Math.floor(Math.random() * 900000000)}`.slice(0, 10);
  const licenseNumber = `LIC-${suffix()}`;
  const address = '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA';

  // 1. Fleet -> Resources (called "Staff" on the UK tenant this was ported
  // from; see NOTE at top of file)
  await page.getByRole('link', { name: 'Fleet' }).click();
  await page.waitForURL('**/fleet/vehicles');
  await page.getByRole('link', { name: 'Resources' }).click();
  await page.waitForURL('**/fleet/resources');
  await page.getByRole('heading', { name: 'Resources' }).waitFor({ state: 'visible', timeout: 15000 });

  // 2. Create Resource
  await page.getByRole('link', { name: 'Create Resource' }).click();
  await page.waitForURL('**/fleet/resources/create');
  await page.getByRole('heading', { name: 'Create Resource' }).waitFor({ state: 'visible', timeout: 15000 });

  // 3. Text fields - dynamic values
  await page.locator('input[name="firstName"]').fill(firstName);
  await page.locator('input[name="lastName"]').fill(lastName);
  await page.locator('input[name="phoneNumber"]').fill(phone);
  await page.locator('input[name="driverLicenseNumber"]').fill(licenseNumber);

  // 4. Address - fixed value
  await fillAddress(page.locator('input[name="homeAddress"]'), address);

  // 5. Dropdowns - random selection
  await selectRandomOption(page.locator('#languageId'));
  await selectRandomOption(page.locator('#isAvailable'));
  await selectRandomOption(page.locator('#locationId'));

  // 6. Save
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Resource saved successfully.').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForURL('**/fleet/resources');

  // 7. Search for the created staff
  const searchBox = page.getByRole('textbox', { name: 'Search' });
  await searchBox.fill(firstName);
  // Wait for the debounced filter to actually settle (reflected in the URL)
  // before interacting with row buttons - acting too early risks clicking
  // a row that's still being replaced by the filtered re-render. This is an
  // in-page history.pushState update, not a real navigation, so
  // waitForURL (which waits for a "load") won't resolve here - poll
  // location directly instead.
  await page.waitForFunction(
    (name) => location.search.includes(`searchTerm=${encodeURIComponent(name)}`),
    firstName,
    { timeout: 10000 }
  );
  const nameCell = page.getByText(fullName, { exact: true });
  await nameCell.waitFor({ state: 'visible', timeout: 10000 });

  // Scope to this staff member's own row (not just any row on the page) -
  // the list can still be showing leftover rows from earlier runs while
  // the search filter is debouncing, so a page-wide button locator is unsafe.
  const row = nameCell.locator('xpath=..');

  // 8. Verify Edit and Delete icons are displayed under Options
  const editButton = row.locator('button').filter({ hasText: /^Edit$/ });
  const deleteButton = row.locator('button').filter({ hasText: /^Delete$/ });
  await editButton.waitFor({ state: 'visible', timeout: 10000 });
  await deleteButton.waitFor({ state: 'visible', timeout: 10000 });

  // 9. Click Delete icon
  // The row can still be settling right after the search filter applies
  // (scroll position / layout not final yet), so scroll explicitly and
  // give layout a moment to settle before a normal click.
  await deleteButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await deleteButton.click();

  // 10. Confirm popup - click Yes
  // force:true - this dialog re-renders/repositions while open, which can
  // make Playwright's normal stability check hang for a long time before
  // eventually timing out (same issue observed on the vehicle delete flow).
  // Even with force:true the click can still occasionally land mid-re-render
  // and report "Element is not visible" - confirmed live that a moment
  // later the exact same button is visible/enabled again, so retry a couple
  // of times rather than failing the whole scenario on that one-off race.
  await page.getByText('Are you sure you want to delete this resource?').waitFor({ state: 'visible', timeout: 10000 });
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
  await page.getByText('Resource deleted.').waitFor({ state: 'visible', timeout: 10000 });

  // 11. Search again to confirm the deleted staff no longer appears
  await searchBox.fill(firstName);
  await page.getByText('No Resources Found.').waitFor({ state: 'visible', timeout: 10000 });
  if (await page.getByText(fullName, { exact: true }).count() > 0) {
    throw new Error(`Staff ${fullName} still appears in list after deletion`);
  }

  return { fullName, phone, licenseNumber, status: 'created-verified-deleted' };
}
