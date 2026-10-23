// name: Create Location for first customer
// NOTE: Ported from UK-PW-automation on 2026-09-25 into pending/ - NOT
// runnable as a regular scenario yet (host and address swapped only). The
// UK version drives the Edit Customer modal's Address tab because UK
// Address Data hides every other location-creation entry point there - and
// that tab rendered empty for the UK vendor. This tenant doesn't have UK
// Address Data active, so location creation most likely goes through a
// normal Add/Create Location action on the customer page instead (see
// ../verify-location-creation-available.js). Once that's confirmed live,
// rewrite steps 2-4 against that real form (fixed field names, like
// ../create-delete-facility.js) instead of this field-discovery approach,
// add a delete step for cleanup, and move the file up to scenarios/.
async page => {
  async function fillAddress(input, value) {
    // Same Mapbox Geocoding autocomplete pattern as the Staff Home Address
    // field (see create-delete-staff.js) and Facility Address field (see
    // create-delete-facility.js) - try it first for any field that looks
    // like an address field, and fall back to whatever was typed if no
    // suggestion list appears (a plain text field, not an autocomplete).
    await input.fill(value);
    const suggestion = input.locator('xpath=../ul/li').first();
    const gotSuggestion = await suggestion
      .waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (!gotSuggestion) {
      return value;
    }
    const selectedText = (await suggestion.textContent()).trim();
    await suggestion.click();
    return selectedText;
  }

  // Fields that exist on the Customers page / Edit Customer modal's other
  // tabs regardless of which tab is active (confirmed live, 2026-09-21):
  // "name"/"phone"/"accountNumber"/"primaryClassificationId"/
  // "customerAccountStatusTypeId" belong to the Customer tab,
  // "locationSearchTerm"/"accountStatusTypeId"/"serviceStatusTypeIds" are
  // the background Customers-list filters, and "feedbackText" is the
  // +Feedback widget. None of these are Address-tab fields - exclude them
  // so whatever's left is actually part of the location form.
  const KNOWN_NON_ADDRESS_NAMES = ['locationSearchTerm', 'accountStatusTypeId', 'serviceStatusTypeIds', 'feedbackText', 'name', 'phone', 'accountNumber'];
  const KNOWN_NON_ADDRESS_IDS = ['primaryClassificationId', 'customerAccountStatusTypeId'];

  // 1. Customers -> first customer on the list.
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

  const firstCustomerName = page.locator('[id^="customer-"][id$="-name"]').first();
  await firstCustomerName.waitFor({ state: 'visible', timeout: 15000 });
  const customerName = (await firstCustomerName.textContent()).trim();
  await firstCustomerName.click();
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Customer locations' }).waitFor({ state: 'visible', timeout: 15000 });

  // Baseline location count for this customer, to confirm afterwards that a
  // new one actually got added (not just that some dialog reported success).
  const locationRows = page.locator('[id^="location-"][id$="-edit-location-button"]');
  const locationCountBefore = await locationRows.count();

  // 2. Open Edit Customer -> Address tab, which is confirmed live (as of
  // 2026-09-21) to be where a customer's location/address is meant to be
  // managed (it sits alongside the Customer and Billing tabs on the same
  // "Edit Customer" modal) - though at the time of writing it renders no
  // fields at all for this vendor (same as the Billing tab, which fails
  // outright with a 500 from POST /V2/portalAccount/login/billing). This
  // scenario drives whatever fields the tab actually exposes rather than
  // hardcoding field names that don't exist yet, so it starts working the
  // moment that tab is implemented/fixed.
  await page.locator('#edit-customer-details-button').click();
  const addressTab = page.getByRole('tab', { name: 'Address', exact: true });
  await addressTab.waitFor({ state: 'visible', timeout: 10000 });
  await addressTab.click();
  await page.waitForTimeout(1000);

  const candidateFields = await page.locator('input:visible, select:visible, textarea:visible').all();
  const addressFields = [];
  for (const field of candidateFields) {
    const name = await field.getAttribute('name');
    const id = await field.getAttribute('id');
    if (KNOWN_NON_ADDRESS_NAMES.includes(name) || KNOWN_NON_ADDRESS_IDS.includes(id)) {
      continue;
    }
    addressFields.push({ field, name, id });
  }

  if (addressFields.length === 0) {
    throw new Error(
      'The Address tab in the Edit Customer modal exposed no fields to create a location with (confirmed live 2026-09-21: this vendor\'s Address tab renders completely empty - no inputs, selects, or Save button - the same way the Billing tab fails via a 500 from POST /V2/portalAccount/login/billing). Location creation is not currently possible through this UI for this vendor.'
    );
  }

  // 3. Fill whatever fields showed up.
  const locationName = `Location-Test-${Date.now()}`;
  const address = '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA';
  const filledValues = {};

  for (const { field, name, id } of addressFields) {
    const tagName = await field.evaluate(el => el.tagName);
    const label = name || id || '';

    if (tagName === 'SELECT') {
      const options = field.locator('option:not([value=""])');
      if (await options.count() > 0) {
        const optionValue = await options.first().getAttribute('value');
        await field.selectOption(optionValue);
        filledValues[label] = await options.first().textContent();
      }
      continue;
    }

    if (/address|street|line1/i.test(label)) {
      filledValues[label] = await fillAddress(field, address);
    } else if (/name/i.test(label)) {
      await field.fill(locationName);
      filledValues[label] = locationName;
    } else {
      await field.fill(String(Date.now()));
      filledValues[label] = String(Date.now());
    }
  }

  // 4. Save - search broadly since the actual button wording isn't known
  // until the form exists.
  const saveButton = page.getByRole('button', { name: /^(Save|Add|Create|Submit)/i }).first();
  const hasSaveButton = await saveButton.count() > 0;
  if (!hasSaveButton) {
    throw new Error(`The Address tab exposed fields (${Object.keys(filledValues).join(', ')}) but no Save/Add/Create/Submit button to commit a new location with.`);
  }
  await saveButton.click();

  // 5. Verify a new location actually appeared for this customer.
  await page.waitForTimeout(1500);
  const locationCountAfter = await locationRows.count();
  if (locationCountAfter <= locationCountBefore) {
    throw new Error(`Expected the customer's location count to increase after saving (was ${locationCountBefore}, still ${locationCountAfter})`);
  }

  return { customerName, locationName, filledValues, locationCountBefore, locationCountAfter, status: 'created' };
}
