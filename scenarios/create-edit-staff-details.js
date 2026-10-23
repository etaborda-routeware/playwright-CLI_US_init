// name: create edit staff details
// NOTE: Ported from UK-PW-automation, then live-verified and fixed up against
// hauler.qa.smartcity.routeware.com on 2026-09-07. Drift found and fixed:
// - What the UK tenant calls "Staff" (Fleet > Staff, "Create Staff"/"Edit
//   Staff" headings) is called "Resources" on this tenant (Fleet >
//   Resources, "Create Resource"/"Edit Resource") - same underlying entity,
//   just renamed. Nav clicks, headings, and the page-title check were
//   updated accordingly; the save toast ("Resource saved successfully.")
//   already used the "Resource" wording and needed no change.
// - This tenant's Create/Edit Resource form has no Roles section (no
//   Driver/Supervisor checkboxes, no isDriver field) - that step and its
//   corresponding edit-page assertion have been removed.
// The Mapbox address autocomplete flow and all other field
// names/selectors matched the UK original exactly and needed no changes.
async page => {
  async function selectRandomOption(trigger) {
    await trigger.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    const count = await options.count();
    const idx = Math.floor(Math.random() * count);
    const label = (await options.nth(idx).textContent()).trim();
    await options.nth(idx).click();
    return label;
  }

  async function fillAddress(input, value) {
    // This is a Mapbox Geocoding autocomplete field (not Google Places -
    // `.pac-item` never matches anything here, confirmed via the network
    // panel: the app calls api.mapbox.com/geocoding, and the suggestions
    // render as a plain <ul><li> sibling of the input). Typing a value alone
    // is not enough, the app only persists HomeAddress when a suggestion is
    // actually selected from the dropdown (confirmed via API: filling text
    // without selecting leaves HomeAddress null server-side).
    //
    // The selected suggestion's own text becomes the field's persisted
    // value, which is not the literal string typed in - return it so
    // callers can verify against what will actually be saved.
    await input.fill(value);
    const suggestion = input.locator('xpath=../ul/li').first();
    await suggestion.waitFor({ state: 'visible', timeout: 10000 });
    const selectedText = (await suggestion.textContent()).trim();
    await suggestion.click();
    return selectedText;
  }

  async function selectedLabel(fieldId) {
    // The react-select display label lives 3 DOM levels above the input
    // itself (input -> value-container -> control), not immediately above
    // it - verified via direct DOM walk. The label can also render a beat
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

  function assertEqual(field, actual, expected) {
    if (actual !== expected) {
      throw new Error(`${field} mismatch: expected "${expected}", got "${actual}"`);
    }
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

  // 4. Address - fixed value (the field ends up holding the *selected
  // suggestion's* text, not the literal string typed - capture it to
  // verify against later).
  const selectedAddress = await fillAddress(page.locator('input[name="homeAddress"]'), address);

  // 5. Dropdowns - random selection (capture the chosen label to verify later)
  const languageLabel = await selectRandomOption(page.locator('#languageId'));
  const serviceStatusLabel = await selectRandomOption(page.locator('#isAvailable'));
  const facilityLabel = await selectRandomOption(page.locator('#locationId'));

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

  // 9. Click Edit icon
  // The row can still be settling right after the search filter applies
  // (scroll position / layout not final yet). force:true would skip
  // Playwright's auto-scroll-into-view and can click blind off-screen, so
  // scroll explicitly, give layout a moment to settle, then use a normal
  // click (which re-verifies visibility/stability on its own).
  await editButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await editButton.click();

  // 10. Verify the Edit Resource page is displayed
  await page.waitForURL(/\/fleet\/resources\/\d+\/edit/, { timeout: 15000 });
  await page.getByRole('heading', { name: 'Edit Resource' }).waitFor({ state: 'visible', timeout: 15000 });
  const title = await page.title();
  if (!title.includes('Edit Resource')) {
    throw new Error(`Expected page title to include "Edit Resource", got "${title}"`);
  }

  // 11. Verify the entered details carried over onto the Edit page
  assertEqual('First Name', await page.locator('input[name="firstName"]').inputValue(), firstName);
  assertEqual('Last Name', await page.locator('input[name="lastName"]').inputValue(), lastName);
  assertEqual('Phone', await page.locator('input[name="phoneNumber"]').inputValue(), phone);
  assertEqual('License Number', await page.locator('input[name="driverLicenseNumber"]').inputValue(), licenseNumber);
  assertEqual('Language Preferences', await selectedLabel('#languageId'), languageLabel);
  assertEqual('Service Status', await selectedLabel('#isAvailable'), serviceStatusLabel);
  assertEqual('Operational Facility', await selectedLabel('#locationId'), facilityLabel);

  // The backend re-geocodes/normalizes this address on save (locale-
  // dependent abbreviations under this account's locale - confirmed live
  // e.g. "Parkway" -> "Pkwy", "USA" -> "EE. UU."), so the Edit page's
  // persisted value does not match the suggestion text captured at
  // selection time verbatim - a fuzzy substring check is the reliable
  // way to verify it's still the same place, not an exact-string compare.
  const persistedAddress = await page.locator('input[name="homeAddress"]').inputValue();
  for (const fragment of ['1600', 'Mountain View', '94043']) {
    if (!persistedAddress.includes(fragment)) {
      throw new Error(`Address mismatch: persisted value "${persistedAddress}" missing expected fragment "${fragment}" (selected: "${selectedAddress}")`);
    }
  }

  return {
    fullName,
    phone,
    licenseNumber,
    languageLabel,
    serviceStatusLabel,
    facilityLabel,
    selectedAddress,
    persistedAddress,
    status: 'created-and-verified-edit',
    editUrl: page.url(),
  };
}
