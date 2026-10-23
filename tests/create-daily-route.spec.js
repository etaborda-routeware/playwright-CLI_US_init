// @ts-check
// NOTE: Ported from UK-PW-automation's tests/ on 2026-09-25 (this flow had no
// scenarios/ counterpart there) - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at port time: its main JS bundle URL returned index.html). Adapted:
// the UK tenant's fixed option labels ("Domestic" / "Refuse" / "Manual") are per-vendor data and
// won't exist here, so those dropdowns now pick randomly and the
// assertions check whatever was picked.
// Still to confirm live: Dispatch > Route Planner / Waste Tracker exist
// under those names, and the "Today" date-picker shortcut.
import { test, expect } from '@playwright/test';

test('Create and delete daily route', async ({ page }) => {
  async function selectDropdownOption(trigger, label) {
    // Same react-select pattern used throughout this suite (see
    // create-delete-facility.spec.js / create-route-template.spec.js), with
    // one addition: this form's cascading dropdowns (Vehicle Type -> Waste
    // Type -> Confirmation Type all appearing/populating in sequence, each
    // only rendering once the previous one is set) proved genuinely flaky
    // live without it - clicking the trigger can open an empty menu (no
    // options rendered yet) often enough that even a generous single wait
    // isn't reliable. Retry the click itself, pressing Escape first to
    // close any stray empty menu from a previous attempt, until options
    // actually show up.
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    for (let attempt = 1; ; attempt++) {
      await trigger.click({ force: true });
      const gotOptions = await options
        .first()
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (gotOptions) break;
      if (attempt >= 5) throw new Error(`Dropdown never showed options after ${attempt} attempts`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    // label = null picks a random option instead - option lists are
    // per-vendor data (the UK tenant's "Domestic"/"Refuse" don't exist
    // here), same fix create-vehicle.spec.js needed. Returns the chosen label.
    if (label) {
      await options.filter({ hasText: new RegExp(`^${label}$`) }).click();
      return label;
    }
    const idx = Math.floor(Math.random() * (await options.count()));
    const picked = (await options.nth(idx).textContent()).trim();
    await options.nth(idx).click();
    return picked;
  }

  const routeName = `DailyRoute-Test-${Date.now()}`;

  // Each test gets its own fresh page (unlike the old scenarios/ runner,
  // where every scenario shared one already-navigated page) - the setup
  // project's storage state keeps it authenticated, but it still needs an
  // explicit starting point of its own.
  await page.goto('/dashboard/all-ops');

  // 1. Dispatch -> Route Planner. Confirmed live: "Plan A Route" only
  // exists on the Route Planner page, not on Waste Tracker itself, even
  // though the created route ends up listed there.
  await page.getByRole('link', { name: 'Dispatch' }).click();
  await page.waitForURL('**/routes/route-tracker', { timeout: 15000 });
  await page.getByRole('link', { name: 'Route Planner' }).click();
  await page.waitForURL('**/routes/route-templates', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Route Planner' })).toBeVisible({ timeout: 15000 });

  // A promo dialog can appear on load and sits on top of the page - close
  // it if present so it doesn't intercept later clicks (same pattern as
  // create-delete-facility.spec.js and create-route-template.spec.js).
  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  // 2. Plan A Route -> Daily Route (a "Daily Route"/"Route Template" choice
  // menu, confirmed live - not a direct navigation; see
  // create-route-template.spec.js for the sibling "Route Template" option).
  await page.getByRole('button', { name: 'Plan A Route' }).click();
  await page.getByRole('button', { name: 'Daily Route' }).click();
  await page.waitForURL('**/routes/route-tracker/create', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Create Daily Route' })).toBeVisible({ timeout: 15000 });

  // 3. Route Name / Date / Vehicle Type / Waste Type / Confirmation Type -
  // confirmed live these are the minimum required to save (Vehicle,
  // Scheduled Start/End Time, Description, Starting/Ending Location,
  // Service Zone, Groups, Supervisor, and "This Is A Test Route" are all
  // optional). Confirmation Type only renders - and only becomes required -
  // once Vehicle Type/Waste Type are set, same as Route Template's form.
  await page.locator('input[name="routeName"]').fill(routeName);
  await page.locator('input[name="routeDate"]').click({ force: true });
  await page.getByText('Today', { exact: true }).click();
  // A brief settle after the date picker closes - confirmed live this
  // avoids a race where the Vehicle Type react-select's click opens (or
  // appears to) before the calendar has actually finished closing/the
  // layout has settled, leaving no options rendered to select from.
  await page.waitForTimeout(500);
  // Same settle-before-clicking reasoning applies between each of these
  // three too - Waste Type and Confirmation Type both only appear/populate
  // in reaction to the previous field's selection (confirmed live: this
  // whole sequence is a chain of conditional re-renders, not independent
  // static fields), and clicking the very next trigger immediately after
  // proved flaky without a brief pause for that re-render to land first.
  const vehicleTypeLabel = await selectDropdownOption(page.locator('#vehicleTypeId'), null);
  await page.waitForTimeout(500);
  await selectDropdownOption(page.locator('#wasteMaterialTypeId'), null);
  await page.waitForTimeout(500);
  await selectDropdownOption(page.locator('#routeConfirmationTypeId'), null);

  // 4. Save
  await page.getByRole('button', { name: 'Save' }).click();

  // 5. Verify - saving navigates to the new route's own details page (URL
  // is /routes/route-tracker/{id}; the page's <title> says "Route Details"
  // but the visible H1 is the route's own name). Capture the numeric id for
  // scoping the delete button later, the same way its row in Waste
  // Tracker's list is keyed by it (not by the route's name).
  await page.waitForURL(/\/routes\/route-tracker\/\d+$/, { timeout: 15000 });
  const routeId = page.url().match(/\/routes\/route-tracker\/(\d+)$/)[1];
  await expect(page.getByRole('heading', { name: routeName })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Scheduled', { exact: true })).toBeVisible();
  await expect(page.getByText(vehicleTypeLabel, { exact: true })).toBeVisible();

  // 6. Waste Tracker defaults its date filter to today (confirmed live),
  // which is also the date just saved above, so the new route is already
  // within the default filtered range - just search for it by name.
  await page.getByRole('link', { name: 'Waste Tracker' }).click();
  await page.waitForURL('**/routes/route-tracker', { timeout: 15000 });
  const searchBox = page.getByPlaceholder('Search');
  await searchBox.fill(routeName);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(routeName, { exact: true })).toBeVisible({ timeout: 10000 });

  // Scope to this route's own row via its numeric id (confirmed live: the
  // row container is #route-{id}-button and its delete button's id is
  // derived from the route's *name* instead, e.g.
  // "route-daily-route-test-...-delete-button" - matching on the row's own
  // id and a generic "-delete-button" suffix sidesteps having to replicate
  // that name-to-id slugification here).
  const row = page.locator(`#route-${routeId}-button`);
  const deleteButton = row.locator('button[id$="-delete-button"]');
  await expect(deleteButton).toBeVisible({ timeout: 10000 });

  // 7. Delete it and confirm the popup.
  await deleteButton.click();
  await expect(page.getByText('Are you sure you want to delete this route?')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Yes' }).click();

  // 8. Confirm it's gone - the search filter is still applied, so an empty
  // result here is unambiguous (confirmed live: "No routes found.").
  await expect(page.getByText('No routes found.', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(routeName, { exact: true })).toHaveCount(0);
});
