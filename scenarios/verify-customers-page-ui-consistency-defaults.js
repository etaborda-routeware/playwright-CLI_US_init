// name: C445024 - UI Consistency with Default Parameters
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Adapted: the UK filter list included "Build
// Status" and "Address Status", which look like UK Address Data fields
// (that flag isn't active on this tenant - see
// verify-customer-creation-and-delete-deactivated.js). A textbox lookup
// on a label that doesn't exist would just hang until timeout, so this
// checks only the candidate filters actually present and fails if none are.
// Still to confirm live: the real filter set on this tenant, and whether
// the UK's "all filters blank" inconsistency reproduces here.
async page => {
  // This one is expected to fail, and deliberately not softened to match
  // reality - see the note below.
  const dashboardUrl = 'https://hauler.qa.smartcity.routeware.com/dashboard/all-ops';

  await page.goto(dashboardUrl);
  await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Customers' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(
    () => document.querySelectorAll('[id^="customer-"]').length > 0,
    { timeout: 5000 }
  );

  // TestRail C445024 expects "All UI filter elements display the
  // predefined default values". Verified live (see
  // ../verify-customers-page-default-search-parameters.js) that a default
  // IS actually applied - the automatic search carries
  // customerStatusTypeIds=1,2 - but confirmed here that none of the 5
  // visible filter fields show any value for it or anything else; every
  // one renders blank. That's a real UI/backend inconsistency (the backend
  // silently filters by a default the user never sees reflected anywhere
  // in the visible controls), not a script bug - asserting the documented
  // expectation as written so this stays red until it's resolved one way
  // or the other.
  const filterLabels = ['Customer / Location / Address', 'Account Number', 'Build Status', 'Address Status'];
  const checkedFields = [];
  const blankFields = [];
  for (const label of filterLabels) {
    const field = page.getByRole('textbox', { name: label });
    if (await field.count() === 0) continue;
    checkedFields.push(label);
    const value = await field.first().inputValue();
    if (!value) blankFields.push(label);
  }
  const propertyTypeValue = await page
    .locator('text=Property Type')
    .locator('xpath=..')
    .locator('textbox, input')
    .first()
    .inputValue()
    .catch(() => '');
  if (await page.locator('text=Property Type').count() > 0) {
    checkedFields.push('Property Type');
    if (!propertyTypeValue) blankFields.push('Property Type');
  }

  if (checkedFields.length === 0) {
    throw new Error(`None of the expected Customers-page filters were found (looked for: ${[...filterLabels, 'Property Type'].join(', ')})`);
  }

  if (blankFields.length > 0) {
    throw new Error(
      `Expected UI filter elements to display predefined default values (a default of customerStatusTypeIds=1,2 IS applied server-side - see verify-customers-page-default-search-parameters.js), but these fields show no default value in the UI: ${blankFields.join(', ')}`
    );
  }

  return { checkedFields, status: 'all-filters-show-defaults' };
}
