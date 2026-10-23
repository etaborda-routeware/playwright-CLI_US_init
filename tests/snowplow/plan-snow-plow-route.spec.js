// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-snowplow.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). The
// Plan A Route menu and the Daily Route form's #vehicleTypeId are the ones
// create-daily-route.spec.js / create-route-template.spec.js confirmed
// live; the Snow Plow sub-option and the Street Network page location are
// guesses from the case text.
// Plan A Route -> Daily Route / Route Template -> Snow Plow. Nothing is
// saved: the forms are opened, checked, and left.
// Manual only (map drawing): C42757 polygon selection step, C49572 segments
// drawn on the map (only the map itself is checked here), C48416-C48419
// route geo-fences.
import { test, expect } from '@playwright/test';
import { dismissPromo, mapContainer } from './snow-helpers';

// Customers -> Street Network (the case text also calls it "Service
// Network"), which has its own Plan A Route button.
async function openStreetNetwork(page) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await dismissPromo(page);
  await page.getByRole('link', { name: /Street Network|Service Network/i }).click();
  await expect(page.getByRole('heading', { name: /Street Network|Service Network/i })).toBeVisible({ timeout: 15000 });
}

async function openPlanARouteMenu(page, kind) {
  await page.getByRole('button', { name: 'Plan A Route' }).click();
  await page.getByRole('button', { name: kind }).click();
}

async function openSnowPlowForm(page, kind) {
  await openStreetNetwork(page);
  await openPlanARouteMenu(page, kind);
  await page.getByRole('button', { name: /Snow Plow/i }).or(page.getByRole('menuitem', { name: /Snow Plow/i })).first().click();
}

async function reactSelectOptions(page, trigger) {
  await trigger.click({ force: true });
  const options = page.locator('[id^="react-select-"][id*="-option-"]');
  await options.first().waitFor({ state: 'visible', timeout: 10000 });
  const labels = (await options.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  return labels;
}

test.describe('Plan A Route - Snow Plow', () => {
  for (const { ids, kind } of [
    { ids: 'C46237', kind: 'Daily Route' },
    { ids: 'C46238', kind: 'Route Template' },
  ]) {
    test(`${ids} - Plan A Route -> ${kind} shows Snow Plow and Street Sweeper`, async ({ page }) => {
      await openStreetNetwork(page);
      await openPlanARouteMenu(page, kind);
      await expect(page.getByRole('button', { name: /Snow Plow/i }).or(page.getByRole('menuitem', { name: /Snow Plow/i })).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /Street Sweeper/i }).or(page.getByRole('menuitem', { name: /Street Sweeper/i })).first()).toBeVisible();
    });
  }

  test('C42755 / C66891 / C49568 / C52568 - Daily Route - Snow Plow form', async ({ page }) => {
    await openSnowPlowForm(page, 'Daily Route');
    const form = page.getByRole('dialog').or(page.locator('form')).first();
    await expect(form).toBeVisible({ timeout: 15000 });

    // Date defaults to today.
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const date = form.locator('input[name="routeDate"]').or(form.locator('input[name*="date" i]')).first();
    await expect(date).toHaveValue(new RegExp(`${mm}/${dd}/${today.getFullYear()}|${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`));

    // Priority has three options.
    const priority = form.locator('#priorityTypeId, [id*="priority" i]').first();
    expect(await reactSelectOptions(page, priority)).toHaveLength(3);

    // Optional fields are present.
    for (const label of [/Supervisor/i, /Starting Location/i, /Ending Location/i, /Group/i]) {
      await expect(form.getByText(label).first(), `${label}`).toBeVisible();
    }

    // Name is required.
    await form.locator('input[name="routeName"]').fill('');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText(/required|cannot be empty/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('C42757 / C66893 / C49569 / C49570 / C49571 / C52570 / C49572 - Route Template - Snow Plow page', async ({ page }) => {
    await openSnowPlowForm(page, 'Route Template');
    await expect(page.getByRole('heading', { name: /Snow Plow|Create Route Template/i }).first()).toBeVisible({ timeout: 15000 });

    // Header fields from the case: name and priority required; start date,
    // locations, service zone, supervisor, groups optional.
    for (const label of [/Route Name/i, /Start Date/i, /Starting Location/i, /Ending Location/i, /Priority/i, /Service Zone/i, /Supervisor/i, /Group/i]) {
      await expect(page.getByText(label).first(), `${label}`).toBeVisible();
    }
    expect(await reactSelectOptions(page, page.locator('#priorityTypeId, [id*="priority" i]').first())).toHaveLength(3);

    // The street-segment map.
    await expect(mapContainer(page)).toBeVisible({ timeout: 15000 });

    // Save with no name and no priority is blocked.
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/required/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('C48505 / C47843 / C46275 / C44451 - Daily Route vehicle types include Snow Plow and Street Sweeper', async ({ page }) => {
    // Route Planner -> Plan A Route -> Daily Route, confirmed live in
    // create-daily-route.spec.js.
    await page.goto('/dashboard/all-ops');
    await page.getByRole('link', { name: 'Dispatch' }).click();
    await page.waitForURL('**/routes/route-tracker', { timeout: 15000 });
    await page.getByRole('link', { name: 'Route Planner' }).click();
    await page.waitForURL('**/routes/route-templates', { timeout: 15000 });
    await dismissPromo(page);
    await openPlanARouteMenu(page, 'Daily Route');
    await page.waitForURL('**/routes/route-tracker/create', { timeout: 15000 });

    const types = await reactSelectOptions(page, page.locator('#vehicleTypeId'));
    test.info().annotations.push({ type: 'vehicle-types', description: types.join(' | ') });
    expect(types).toEqual(expect.arrayContaining(['Snow Plow', 'Street Sweeper']));
  });

  test('C49510 / C47621 / C46288 / C44477 - Route Template vehicle types include Snow Plow and Street Sweeper', async ({ page }) => {
    await page.goto('/dashboard/all-ops');
    await page.getByRole('link', { name: 'Dispatch' }).click();
    await page.waitForURL('**/routes/route-tracker', { timeout: 15000 });
    await page.getByRole('link', { name: 'Route Planner' }).click();
    await page.waitForURL('**/routes/route-templates', { timeout: 15000 });
    await dismissPromo(page);
    await openPlanARouteMenu(page, 'Route Template');
    await page.waitForURL('**/routes/route-templates/create', { timeout: 15000 });

    const types = await reactSelectOptions(page, page.locator('#vehicleTypeId'));
    test.info().annotations.push({ type: 'vehicle-types', description: types.join(' | ') });
    expect(types).toEqual(expect.arrayContaining(['Snow Plow', 'Street Sweeper']));
  });
});
