// @ts-check
// NOTE: Ported from UK-PW-automation's tests/ on 2026-09-25 (this flow had no
// scenarios/ counterpart there) - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at port time: its main JS bundle URL returned index.html). Adapted:
// the UK tenant's fixed option labels ("Domestic" / "Refuse" / "Manual") are per-vendor data and
// won't exist here, so those dropdowns now pick randomly and the
// assertions check whatever was picked.
// Still to confirm live: Dispatch > Route Planner exists under that
// name, and "Monday" is still a Day Of Service option.
import { test, expect } from '@playwright/test';

test('Create and delete route template', async ({ page }) => {
  async function selectDropdownOption(trigger, label) {
    // Same react-select pattern used throughout this suite (see
    // create-delete-facility.spec.js / create-service-on-location.spec.js).
    await trigger.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    // label = null picks a random option instead - option lists are
    // per-vendor data (the UK tenant's "Domestic"/"Refuse" don't exist
    // here), same fix create-vehicle.spec.js needed. Returns the chosen label.
    if (label) {
      await options.filter({ hasText: new RegExp(`^${label}$`) }).click();
      return label;
    }
    await options.first().waitFor({ state: 'visible', timeout: 10000 });
    const idx = Math.floor(Math.random() * (await options.count()));
    const picked = (await options.nth(idx).textContent()).trim();
    await options.nth(idx).click();
    return picked;
  }

  const routeTemplateName = `RouteTemplate-Test-${Date.now()}`;

  // Each test gets its own fresh page (unlike the old scenarios/ runner,
  // where every scenario shared one already-navigated page) - the setup
  // project's storage state keeps it authenticated, but it still needs an
  // explicit starting point of its own.
  await page.goto('/dashboard/all-ops');

  // 1. Dispatch -> Route Planner
  await page.getByRole('link', { name: 'Dispatch' }).click();
  await page.waitForURL('**/routes/route-tracker', { timeout: 15000 });
  await page.getByRole('link', { name: 'Route Planner' }).click();
  await page.waitForURL('**/routes/route-templates', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Route Planner' })).toBeVisible({ timeout: 15000 });

  // A promo dialog can appear on load and sits on top of the page - close
  // it if present so it doesn't intercept later clicks (same pattern as
  // create-delete-facility.spec.js and create-location-alert.spec.js).
  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  // 2. Plan A Route -> Route Template (a "Daily Route"/"Route Template"
  // choice menu, confirmed live - not a direct navigation).
  await page.getByRole('button', { name: 'Plan A Route' }).click();
  await page.getByRole('button', { name: 'Route Template' }).click();
  await page.waitForURL('**/routes/route-templates/create', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Create Route Template' })).toBeVisible({ timeout: 15000 });

  // 3. Route Name / Day Of Service / Vehicle Type / Waste Type - confirmed
  // live these four are the minimum required to attempt a save (Activate
  // Route Template defaults to on, Start Date/times/locations/zone/groups/
  // supervisor are all optional).
  await page.locator('input[name="routeTemplateName"]').fill(routeTemplateName);
  await selectDropdownOption(page.locator('#scheduledDay'), 'Monday');
  const vehicleTypeLabel = await selectDropdownOption(page.locator('#vehicleTypeId'), null);
  await selectDropdownOption(page.locator('#wasteMaterialTypeId'), null);

  // 4. Confirmation Type - confirmed live: this field only renders (and
  // only becomes required, "You can not leave this empty.") once Vehicle
  // Type/Waste Type are set, replacing where Supervisor was - select it
  // before the real Save below rather than treating it as optional.
  await selectDropdownOption(page.locator('#routeConfirmationTypeId'), null);

  // 5. Save
  await page.getByRole('button', { name: 'Save' }).click();

  // 6. Verify - saving navigates to the new route template's own details
  // page (URL is /routes/route-templates/{id}; the page's <title> says
  // "Route Details" but the visible H1 is the route's own name).
  await page.waitForURL(/\/routes\/route-templates\/\d+$/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: routeTemplateName })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(vehicleTypeLabel, { exact: true })).toBeVisible();
  await expect(page.getByText('Monday', { exact: true })).toBeVisible();

  // 7. Back to Route Planner, search for it, and confirm the row itself
  // shows what was just saved.
  await page.getByRole('link', { name: 'Route Planner' }).click();
  await page.waitForURL('**/routes/route-templates', { timeout: 15000 });
  const searchBox = page.getByPlaceholder('Search');
  await searchBox.fill(routeTemplateName);
  const nameCell = page.locator('[id^="route-template-"][id$="-name"]').filter({ hasText: routeTemplateName });
  await expect(nameCell).toBeVisible({ timeout: 10000 });

  // Scope to this route template's own row (not just any row on the page) -
  // the name cell's immediate parent is the row itself (confirmed live via
  // direct DOM inspection: sibling cells for material type/day/status/etc.
  // and the delete button all live directly under
  // #route-template-{id}, one level up from the name cell).
  const row = nameCell.locator('xpath=..');
  const deleteButton = row.locator('button[id$="-delete-button"]');
  await expect(deleteButton).toBeVisible({ timeout: 10000 });

  // 8. Delete it and confirm the popup.
  await deleteButton.click();
  await expect(page.getByText('Are you sure you want to delete this route template?')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Yes' }).click();

  // 9. Confirm it's gone - the search filter is still applied, so an empty
  // result here is unambiguous (confirmed live: "No route templates found.").
  await expect(page.getByText('No route templates found.', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(nameCell).toHaveCount(0);
});
