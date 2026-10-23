// name: Verify UK-only features are inactive
// NOTE: New on 2026-09-25 - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (at port time the QA frontend was
// serving a broken build: its main JS bundle URL returned index.html, so
// the app never rendered). This is the US-side counterpart to the UK repo's
// UK-only scenarios, which were deliberately NOT ported:
// verify-uk-address-data-activated.js (C65966),
// verify-uk-address-import-menu-option.js (C65968), and the twelve
// verify-uk-street-data-*.js (SCP-5016 - Ordnance Survey <-> OpenStreetMap
// street-network provider). Those all assert UK features are ON; for a US
// vendor the meaningful regression is the opposite - that they're not
// active here. A UK flag bleeding onto this tenant is what flipped the
// Create Customer / Delete behavior (see
// verify-customer-creation-and-delete-deactivated.js).
//
// "Inactive" means absent OR present-but-unchecked, since the Routeware
// Admin Features grid may well render every flag for every tenant. Nothing
// here is clicked - these are shared vendor settings.
async page => {
  const settingsUrl = 'https://hauler.qa.smartcity.routeware.com/account-settings';
  const ukFlags = [
    { name: 'UKAddressData', label: 'UK Address Data' },
    { name: 'UKStreetData', label: 'UK Street Data' },
  ];

  await page.goto(settingsUrl);
  await page.waitForURL('**/account-settings', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Application Settings' }).waitFor({ state: 'visible', timeout: 15000 });
  // Wait for the flag grid itself to hydrate before counting controls -
  // otherwise "absent" could just mean "not rendered yet".
  await page.locator('input[type="checkbox"]').first().waitFor({ state: 'attached', timeout: 15000 });

  const flagStates = {};
  for (const { name, label } of ukFlags) {
    const control = page.locator(`input[name="${name}"]`);
    if (await control.count() === 0) {
      flagStates[label] = 'absent';
      continue;
    }
    const isChecked = await control.isChecked();
    flagStates[label] = isChecked ? 'checked' : 'unchecked';
    if (isChecked) {
      throw new Error(`UK-only flag "${label}" is checked on this US tenant, expected absent or unchecked`);
    }
  }

  // "UK Address Import" is the Customers > More menu entry that UK Address
  // Data adds (C65968) - it should not be offered here.
  await page.goto('https://hauler.qa.smartcity.routeware.com/dashboard/all-ops');
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Customers' }).waitFor({ state: 'visible', timeout: 15000 });

  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  let ukAddressImport = 'no-more-menu';
  const moreButton = page.getByRole('button', { name: 'More', exact: true });
  if (await moreButton.count() > 0) {
    await moreButton.click();
    // Anchor on a menu item that exists regardless of region (UK original
    // listed Customer Import first) so "absent" isn't just "not open yet".
    await page.getByRole('button', { name: 'Customer Import', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    if (await page.getByRole('button', { name: 'UK Address Import', exact: true }).count() > 0) {
      throw new Error('"UK Address Import" is offered in the Customers > More menu on this US tenant, expected absent');
    }
    ukAddressImport = 'absent';
  }

  return { flagStates, ukAddressImport, status: 'uk-only-features-inactive' };
}
