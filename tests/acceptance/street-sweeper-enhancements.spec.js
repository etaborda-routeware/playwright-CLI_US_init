// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Labels
// are taken from the case titles (no step text) and need a live check.
// Street Sweeping enhancements: Fleet Insights (RVP-4489), Geo-Fences
// (RVP-4491) and street attributes (RVP-1096). Nothing is saved.
// Manual only: C45210, C45211, C45288 (need sweeper routes run on the
// app), C45274 / C45275 values (only the tiles are checked).
// Not yet: C45279 (edit a sweeper geo-fence - needs one to exist),
// C45281-C45285 (geo-fence filter on route, template, Dispatch Board,
// Add Job and Builder maps).
import { test, expect } from '@playwright/test';
import { dismissPromo, mapContainer } from './acceptance-helpers';

async function openStreetNetwork(page) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await dismissPromo(page);
  await page.getByRole('link', { name: /Street Network|Service Network/i }).click();
  await expect(mapContainer(page)).toBeVisible({ timeout: 15000 });
}

async function openSweeperInsights(page) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Insights', exact: true }).click();
  await dismissPromo(page);
  const sweeper = page.getByRole('tab', { name: /Street Sweep/i }).or(page.getByRole('link', { name: /Street Sweep/i })).or(page.getByRole('button', { name: /Street Sweep/i })).first();
  await sweeper.click();
}

// Geo-fence filter: a "Geo-Fences" toggle/checkbox in the map's filters.
async function expectGeoFenceFilter(page) {
  const filters = page.getByRole('button', { name: /Filters/ });
  if (await filters.count() > 0) await filters.first().click();
  await expect(page.getByText(/Geo-?Fences?/i).first()).toBeVisible({ timeout: 10000 });
}

test.describe('Street Sweeper Fleet Insights (RVP-4489)', () => {
  test('C45271 / C45272 / C45273 / C45274 - sweeper insights load with Water Fill-Ups, Loads Dumped, Miles Swept', async ({ page }) => {
    await openSweeperInsights(page);
    for (const tile of [/Water Fill-?Ups?/i, /Loads? Dumped/i, /Miles Swept/i]) {
      await expect(page.getByText(tile).first(), `${tile}`).toBeVisible({ timeout: 15000 });
    }
  });

  test('C45275 - Miles Swept See Details shows miles per route', async ({ page }) => {
    await openSweeperInsights(page);
    const tile = page.getByText(/Miles Swept/i).first().locator('xpath=ancestor::*[.//a[contains(., "See Details")]][1]');
    await tile.getByRole('link', { name: /See Details/ }).click();
    await expect(page.getByRole('columnheader', { name: /Route/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('columnheader', { name: /Miles/i }).first()).toBeVisible();
  });
});

test.describe('Street Sweeper Geo-Fences (RVP-4491)', () => {
  test('C45277 / C45287 - Street Network can create a Street Sweeper geo-fence', async ({ page }) => {
    await openStreetNetwork(page);
    await page.getByRole('button', { name: /Create Geo-?Fence/i }).or(page.getByRole('link', { name: /Create Geo-?Fence/i })).first().click();
    // The create flow offers Street Sweeper as a geo-fence type.
    await expect(page.getByText(/Street Sweep/i).first()).toBeVisible({ timeout: 10000 });
    // Leave without drawing anything.
    const cancel = page.getByRole('button', { name: /Cancel/ });
    if (await cancel.count() > 0) await cancel.first().click();
  });

  test('C45278 / C45286 - Street Network shows the geo-fence filter', async ({ page }) => {
    await openStreetNetwork(page);
    await expectGeoFenceFilter(page);
  });

  test('C45280 - Dashboard shows the geo-fence filter', async ({ page }) => {
    await page.goto('/dashboard/all-ops');
    await dismissPromo(page);
    await expectGeoFenceFilter(page);
  });
});

test.describe('Street Sweeper attributes (RVP-1096)', () => {
  test('C45212 - Street Network loads street segments', async ({ page }) => {
    await openStreetNetwork(page);
    const load = page.getByRole('button', { name: /Load (Street )?Segments/i });
    if (await load.count() > 0) await load.first().click();
    await expect(page.getByText(/Segment/i).first()).toBeVisible({ timeout: 15000 });
  });
});
