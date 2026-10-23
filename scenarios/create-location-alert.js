// name: Create location alert
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Adapted:
// - The UK original restricted Alert Type to that vendor's own configured
//   types ("testA", "School Area", "Gas Station"). Alert types are
//   per-vendor data, so that allow-list won't hold here - it's now a
//   deny-list instead: any type except the custom "New location alert"
//   (which needs its own Title/Description fields - see step 3).
// Still to confirm live: the Customer / Location search input is still
// react-select-3 (that id is render-order dependent), and the search term
// "customer" matches at least one of this tenant's customer locations (if
// not, change CUSTOMER_SEARCH_TERM below).
async page => {
  async function selectRandomOption(trigger, denyList) {
    await trigger.click({ force: true });
    let options = page.locator('[id^="react-select-"][id*="-option-"]');
    if (denyList) {
      const texts = await options.allTextContents();
      options = options.filter({ hasNotText: new RegExp(`^(${denyList.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`) });
      if ((await options.count()) === 0) {
        throw new Error(`No options left after excluding ${denyList.join(', ')} from: ${texts.join(', ')}`);
      }
    }
    const count = await options.count();
    const idx = Math.floor(Math.random() * count);
    const label = (await options.nth(idx).textContent()).trim();
    await options.nth(idx).click();
    return label;
  }

  // 1. Fleet -> Alerts
  await page.getByRole('link', { name: 'Fleet' }).click();
  await page.waitForURL('**/fleet/vehicles');
  await page.getByRole('link', { name: 'Alerts' }).click();
  await page.waitForURL('**/fleet/alerts');
  await page.getByRole('heading', { name: 'Location And City Alerts' }).waitFor({ state: 'visible', timeout: 15000 });

  // A promo dialog can appear on load and sits on top of the page - close
  // it if present so it doesn't intercept later clicks (same as
  // create-edit-city-alert.js and the rest of this suite).
  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  // 2. Create Alert -> Create Location Alert
  await page.getByRole('button', { name: 'Create Alert' }).click();
  await page.getByRole('button', { name: 'Create Location Alert' }).click();
  await page.getByRole('heading', { name: 'Create Location Alert' }).waitFor({ state: 'visible', timeout: 10000 });

  // 3. Alert Type - random selection among the pre-configured types (on
  // the UK tenant each auto-filled a Location Description). "New location
  // alert" is excluded: it's a different, custom type with its own
  // required Location Title/Location Description text fields instead -
  // confirmed live on UK that it fails validation here since this scenario
  // doesn't fill those (a distinct scenario, not this one's concern).
  const alertTypeLabel = await selectRandomOption(page.locator('#alertTypeId'), ['New location alert']);

  // 4. Customer / Location - a live-search combobox over real customer
  // locations (not a free-text address like City Alerts), confirmed live
  // via the network panel: it hits /V2/customers/withLocations. A location
  // can only have ONE alert at a time (confirmed live: the backend
  // rejects a duplicate with "LocationAlertAlreadyExists" - a 400 with
  // Code "LocationAlertAlreadyExists" from POST /V2/alerts), and there's
  // no Delete action for alerts to clean one up afterward - so this picks
  // a random match from a broad search rather than a fixed customer, and
  // retries with a different one if that specific location already has an
  // alert, rather than the whole scenario failing on a collision that has
  // nothing to do with whether alert creation itself actually works.
  const CUSTOMER_SEARCH_TERM = 'customer';
  const custLocInput = page.locator('input#react-select-3-input');
  let saved = false;
  let selectedLocation = null;
  let lat, lng, description;

  for (let attempt = 1; attempt <= 5 && !saved; attempt++) {
    await custLocInput.fill(CUSTOMER_SEARCH_TERM);
    await page.waitForTimeout(1200);
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    const count = await options.count();
    if (count === 0) {
      throw new Error(`Expected the Customer / Location search for "${CUSTOMER_SEARCH_TERM}" to return at least one match`);
    }
    const idx = Math.floor(Math.random() * count);
    selectedLocation = (await options.nth(idx).textContent()).trim();
    await options.nth(idx).click();
    await page.waitForTimeout(800);

    lat = await page.locator('input[name="latitude"]').inputValue();
    lng = await page.locator('input[name="longitude"]').inputValue();
    description = await page.locator('input[name="description"]').inputValue();
    if (!lat || !lng) {
      throw new Error(`Expected Latitude/Longitude to auto-populate from "${selectedLocation}", got lat="${lat}" lng="${lng}"`);
    }

    // 5. Save - confirmed live a location can only have one alert at a
    // time (a 400 "LocationAlertAlreadyExists" from POST /V2/alerts, shown
    // as "Location alert already exists for this location."). Treat *any*
    // non-success outcome as a reason to retry with a different random
    // location, not just that specific message - the goal here is
    // resilience against picking an already-alerted location, not
    // diagnosing every possible failure text.
    await page.getByRole('button', { name: 'Save' }).click();
    saved = await page
      .getByText('Location alert created successfully', { exact: true })
      .waitFor({ state: 'visible', timeout: 6000 })
      .then(() => true)
      .catch(() => false);
  }

  if (!saved) {
    throw new Error('Could not save a location alert after 5 random Customer/Location attempts (each candidate either already had an alert, or some other save error occurred)');
  }

  // 6. Verify it appears in the list.
  await page.getByText('Load alerts', { exact: false }).click();
  const searchBox = page.getByRole('textbox', { name: 'Search' });
  await searchBox.fill(selectedLocation.split(',')[0]);
  await page.getByText(alertTypeLabel, { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 });

  return { alertTypeLabel, selectedLocation, lat, lng, description, status: 'created' };
}
