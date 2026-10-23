// name: Verify Create Location is available
// NOTE: Ported from UK-PW-automation (verify-location-creation-deactivated.js)
// on 2026-09-25 - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (at port time the QA frontend was
// serving a broken build: its main JS bundle URL returned index.html, so
// the app never rendered). The UK original asserted there is NO Add/Create
// Location action, and said that was caused by the UK-only "UK Address
// Data" flag - the same cause behind the hidden Create Customer button.
// verify-customer-creation-and-delete-deactivated.js already confirmed
// live (2026-09-07) that this tenant does NOT have that flag (Create
// Customer and row Delete are both present), so the assertion is inverted
// here the same way that file was: an Add/Create Location action should be
// present. Renamed from "-deactivated" since that's no longer what it checks.
// Still to confirm live: the action's exact label (matched loosely below as
// "Add Location" / "Create Location" / "Add New Location") and role.
async page => {
  // Navigate via the in-app nav link rather than page.goto() straight to the
  // URL - on the UK tenant a cold, direct navigation to /customers/customers
  // reliably crashed the app with a Redux error ("Cannot read properties of
  // undefined (reading 'find')"), whereas clicking through loads fine.
  await page.getByRole('link', { name: 'Customers' }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Customers' }).waitFor({ state: 'visible', timeout: 15000 });

  // A promo dialog can appear on load and sits on top of the page - close
  // it if present so it doesn't intercept later clicks (same pattern as
  // create-delete-facility.js and create-location-alert.js).
  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  // 1. Open the first customer's own detail page (clicking the customer's
  // name in the list navigates to /customers/customers/{id}/edit, which is
  // where a customer's Locations live).
  const firstCustomerName = page.locator('[id^="customer-"][id$="-name"]').first();
  await firstCustomerName.waitFor({ state: 'visible', timeout: 15000 });
  const customerName = (await firstCustomerName.textContent()).trim();
  await firstCustomerName.click();
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Customer locations' }).waitFor({ state: 'visible', timeout: 15000 });

  // 2. An Add/Create Location action is present. Checked as both button and
  // link since the label/role isn't confirmed on this tenant yet.
  const addLocationPattern = /^(Add|Create|Add New) Location$/;
  const addLocationCount =
    (await page.getByRole('button', { name: addLocationPattern }).count()) +
    (await page.getByRole('link', { name: addLocationPattern }).count());
  if (addLocationCount === 0) {
    throw new Error('No Add/Create Location action found on the customer page, expected one (this tenant does not have UK Address Data active, so location creation should be enabled)');
  }

  // 3. Location management otherwise works too - Edit Location and Delete
  // Location are present against the existing location(s).
  const editLocationButton = page.getByRole('button', { name: 'Edit Location', exact: true });
  const deleteLocationButton = page.getByRole('button', { name: 'Delete Location', exact: true });
  await editLocationButton.first().waitFor({ state: 'visible', timeout: 10000 });
  await deleteLocationButton.first().waitFor({ state: 'visible', timeout: 10000 });

  return { customerName, addLocationAction: 'present', editLocationAction: 'present', deleteLocationAction: 'present', url: page.url() };
}
