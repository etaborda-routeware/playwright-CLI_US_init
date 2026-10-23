// name: Create edit city alert
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Adapted:
// - Pinned address swapped to a US one, and the row search term changed
//   from "Belagavi" to "Mountain View" to match it.
// - The UK tenant renders "Last Flagged At" as DD/MM/YYYY. A US tenant most
//   likely renders MM/DD/YYYY, so the date order is now a single constant
//   (DATE_ORDER below) instead of a hardcoded DD/MM swap. If the newest-row
//   pick looks wrong live, flip that constant first.
// Still to confirm live: an "Accident" Alert Type exists on this tenant
// (if not, switch step 3 to a random pick like create-vehicle.js does),
// and the create/save toast copy.
async page => {
  async function fillAddress(input, value) {
    // Same Mapbox Geocoding autocomplete pattern used throughout this suite
    // (see create-delete-staff.js) - suggestions render as a plain <ul><li>
    // sibling of the input; the field persists the *selected* suggestion's
    // text, not whatever was literally typed.
    await input.fill(value);
    const suggestion = input.locator('xpath=../ul/li').first();
    await suggestion.waitFor({ state: 'visible', timeout: 10000 });
    const selectedText = (await suggestion.textContent()).trim();
    await suggestion.click();
    return selectedText;
  }

  // There's no Delete action for alerts (confirmed live: a row's Options
  // column only ever has "Edit"), so previous runs' alerts for this same
  // search term are still sitting in the list every time this runs, and
  // they're NOT reliably in DOM/creation order (confirmed live) - so
  // .first()/.last() can silently grab the wrong one. This resolves the
  // row unambiguously every time by parsing each candidate's own "Last
  // Flagged At" timestamp and picking the genuinely most recent one -
  // called fresh both before and after editing, since a stale Locator
  // captured pre-edit isn't guaranteed to still point at the same row if
  // the list re-sorts.
  async function findMostRecentAlertRow(searchTerm) {
    // 'MDY' (US) or 'DMY' (UK) - order of the "Last Flagged At" date parts.
    const DATE_ORDER = 'MDY';
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill('');
    await page.waitForTimeout(300);
    await searchBox.fill(searchTerm);

    // Two levels up from the matched text is what actually contains the
    // row's Edit button, confirmed live via direct DOM inspection (the
    // accessibility-tree snapshot used to pick selectors elsewhere in this
    // suite renders misleadingly flat here, collapsing wrapper elements
    // that are real, present nodes in the DOM).
    const rows = page
      .getByText(searchTerm, { exact: false })
      .locator('xpath=../..')
      .filter({ has: page.locator('button').filter({ hasText: 'Edit' }) });
    await rows.first().waitFor({ state: 'visible', timeout: 10000 });

    const rowCount = await rows.count();
    const timestamps = await rows.evaluateAll((els, dateOrder) =>
      els.map((el) => {
        // "Last Flagged At" is the second line of the row's first cell,
        // e.g. (UK) "10/09/2026\n10/09/2026 11:42 AM\neliana.taborda\n@routeware.com".
        // Note: .innerText, not .textContent - textContent concatenates all
        // descendant text with no line breaks at all (confirmed live: this
        // broke the regex below entirely, silently falling back to index 0
        // every time), while innerText reflects actual rendered line breaks.
        const lines = el.innerText.split('\n').filter(Boolean);
        const m = (lines[1] || '').match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}:\d{2} [AP]M)/);
        if (!m) return null;
        // Date parses MM/DD/YYYY - reorder first if this tenant is DD/MM.
        const [month, day] = dateOrder === 'DMY' ? [m[2], m[1]] : [m[1], m[2]];
        return new Date(`${month}/${day}/${m[3]} ${m[4]}`).getTime();
      }),
      DATE_ORDER
    );
    let newestIndex = 0;
    for (let i = 1; i < rowCount; i++) {
      if ((timestamps[i] || 0) > (timestamps[newestIndex] || 0)) newestIndex = i;
    }
    return rows.nth(newestIndex);
  }

  const address = '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA';
  const rowSearchTerm = 'Mountain View';

  // 1. Fleet -> Alerts
  await page.getByRole('link', { name: 'Fleet' }).click();
  await page.waitForURL('**/fleet/vehicles');
  await page.getByRole('link', { name: 'Alerts' }).click();
  await page.waitForURL('**/fleet/alerts');
  await page.getByRole('heading', { name: 'Location And City Alerts' }).waitFor({ state: 'visible', timeout: 15000 });

  // A promo dialog can appear on load and sits on top of the page - close
  // it if present so it doesn't intercept later clicks (same as Facilities
  // and Geo-fences).
  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  // 2. Create Alert -> Create City Alert
  // "Create Alert" opens a small menu with the two alert kinds, matching
  // this suite's "create-location-alert.js" sibling scenario.
  await page.getByRole('button', { name: 'Create Alert' }).click();
  await page.getByRole('button', { name: 'Create City Alert' }).click();
  await page.getByRole('heading', { name: 'Create City Alert' }).waitFor({ state: 'visible', timeout: 10000 });

  // 3. Alert Type = Accident
  await page.locator('#alertTypeId').click({ force: true });
  await page.locator('[id^="react-select-"][id*="-option-"]').filter({ hasText: 'Accident' }).click();

  // 4. Pin the location via address search - confirmed live this
  // auto-populates the (otherwise disabled) Latitude/Longitude fields.
  await fillAddress(page.locator('input[name="pinnedAddress"]'), address);
  const lat = await page.locator('input[name="latitude"]').inputValue();
  const lng = await page.locator('input[name="longitude"]').inputValue();
  if (!lat || !lng) {
    throw new Error(`Expected Latitude/Longitude to auto-populate from the pinned address, got lat="${lat}" lng="${lng}"`);
  }

  // 5. Save
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('City alert created successfully', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });

  // 6. Find the created alert - "Load alerts" (an in-page link, not a
  // navigation) switches the page from map-only to a table with an Options
  // column; searching alone only shows a map popup card with no Edit
  // action, confirmed live.
  await page.getByText('Load alerts', { exact: false }).click();
  let row = await findMostRecentAlertRow(rowSearchTerm);

  // 7. Verify Edit is displayed under Options
  const editButton = row.locator('button').filter({ hasText: 'Edit' });
  await editButton.waitFor({ state: 'visible', timeout: 10000 });

  // 8. Click Edit
  await editButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await editButton.click({ force: true });
  await page.getByRole('heading', { name: 'Edit Accident Alert' }).waitFor({ state: 'visible', timeout: 15000 });

  // 9. Edit - confirmed live that Location/Latitude/Longitude/Start Date
  // are all locked (disabled) on this form; only "Active" and "End Date"
  // are actually editable. Set an End Date via the date-picker calendar
  // (a plain text field the picker opens against, not a typeable input).
  const endDateContainer = page.locator('text=End Date').locator('xpath=..');
  await endDateContainer.locator('input, textbox').first().click({ force: true });
  // The calendar needs a beat to actually render/attach its click handlers
  // after opening - confirmed live that clicking a day immediately can
  // silently no-op (the click "succeeds" against a day cell that exists in
  // the DOM but isn't wired up yet, leaving End Date unchanged). The day
  // cells themselves are plain text, not a listbox/option role - a bare
  // getByText('25') is what actually works.
  await page.waitForTimeout(800);
  await page.getByText('25', { exact: true }).click();
  await page.waitForTimeout(300);
  const newEndDate = await endDateContainer.locator('input, textbox').first().inputValue();

  // 10. Save
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('City alert was successfully saved', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });

  // 11. Verify the new End Date persisted (shown as the row's Expiration
  // column). Re-resolve the row fresh rather than trusting the Locator
  // captured before editing to still point at the same one, and reload -
  // confirmed live the list can still show the pre-edit value for a beat
  // even after the "successfully saved" toast appears.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('heading', { name: 'Location And City Alerts' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText('Load alerts', { exact: false }).click();
  row = await findMostRecentAlertRow(rowSearchTerm);
  const rowTextAfter = await row.textContent();
  if (!rowTextAfter.includes(newEndDate)) {
    throw new Error(`Expected the edited End Date "${newEndDate}" to appear in the alert's row, got: ${rowTextAfter}`);
  }

  return { address, lat, lng, newEndDate, status: 'created-and-edited' };
}
