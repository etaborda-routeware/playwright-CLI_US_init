// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-snowplow.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check - in
// particular whether All Ops / Snow Ops / Sweeper Ops are links, tabs or
// buttons, and the Snow Ops URL.
// Dashboard Ops views. Each test lists every copy of its case (the export
// repeats them across sections).
// Manual only (need a segment clicked on the map canvas, or routes run on
// the driver app): C49558 segment pop-up, C45220.
import { test, expect } from '@playwright/test';
import { dismissPromo, mapContainer, openSnowOps } from './snow-helpers';

function opsSwitch(page, name) {
  return page.getByRole('link', { name, exact: true })
    .or(page.getByRole('tab', { name, exact: true }))
    .or(page.getByRole('button', { name, exact: true }))
    .first();
}

test.describe('Dashboard - Snow Ops', () => {
  test('C42720 / C66828 / C52529 / C45631 - switch between All Ops, Snow Ops and Sweeper Ops', async ({ page }) => {
    await page.goto('/dashboard/all-ops');
    await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });
    await dismissPromo(page);

    for (const name of ['All Ops', 'Snow Ops', 'Sweeper Ops']) {
      await expect(opsSwitch(page, name), `${name} switch`).toBeVisible({ timeout: 15000 });
    }

    // Snow Ops and Sweeper Ops each swap the filters and show the Latest
    // Activity / Today Status tabs over the map.
    for (const { name, url } of [{ name: 'Snow Ops', url: /snow/i }, { name: 'Sweeper Ops', url: /sweep/i }]) {
      await opsSwitch(page, name).click();
      await page.waitForURL(url, { timeout: 15000 });
      await expect(page.getByText(/Latest Activity/i).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Today'?s? Status/i).first()).toBeVisible();
      await expect(mapContainer(page)).toBeVisible();
    }

    await opsSwitch(page, 'All Ops').click();
    await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });
  });

  test('C45632 - Snow Ops page loads', async ({ page }) => {
    await openSnowOps(page);
    await expect(mapContainer(page)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Latest Activity/i).first()).toBeVisible();
  });

  test('C45633 - Filters open and apply on Snow Ops', async ({ page }) => {
    await openSnowOps(page);
    await page.getByRole('button', { name: /Filters/ }).click();
    const panel = page.getByRole('dialog').or(page.locator('[class*="filter" i][class*="panel" i]')).first();
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Toggle the first filter option and apply - the page should stay on
    // Snow Ops with the map still rendered, not error out.
    const firstOption = panel.locator('input[type="checkbox"]').first();
    await expect(firstOption).toBeVisible();
    const before = await firstOption.isChecked();
    await firstOption.setChecked(!before, { force: true });
    const apply = panel.getByRole('button', { name: /Apply|Save|Done/ });
    if (await apply.count() > 0) await apply.first().click();
    await expect(mapContainer(page)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/snow/i);
  });

  test('C45261 - Latest Activity legend shows on the map', async ({ page }) => {
    await openSnowOps(page);
    // The legend sits over the map's bottom-left corner.
    const legend = page.getByText(/Latest Activity/i).last();
    await expect(legend).toBeVisible({ timeout: 15000 });
    const map = await mapContainer(page).boundingBox();
    const box = await legend.boundingBox();
    expect(map && box, 'map and legend both rendered').toBeTruthy();
    if (map && box) {
      expect(box.x, 'legend in the left half of the map').toBeLessThan(map.x + map.width / 2);
      expect(box.y, 'legend in the bottom half of the map').toBeGreaterThan(map.y + map.height / 2);
    }
  });
});
