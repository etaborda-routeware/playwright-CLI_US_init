// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Dispatch
// -> Route Tracker is confirmed live (create-daily-route.spec.js); the Map
// Actions menu and Trigger Map labels are guesses from the case titles.
// RVP-4568 Trigger Map on Route Tracker Details. Needs today's routes on
// Route Tracker: skips without a Front Load route (and, for C45381,
// without a non-Front Load one).
// Manual only: C45380 (needs a non-admin login to check it's hidden).
import { test, expect } from '@playwright/test';
import { dismissPromo } from './acceptance-helpers';

async function openRouteOfType(page, type, { not = false } = {}) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Dispatch' }).click();
  await page.waitForURL('**/routes/route-tracker', { timeout: 15000 });
  await dismissPromo(page);
  // Route Tracker rows are keyed by numeric id (create-daily-route.spec.js).
  const rows = page.locator('[id^="route-"]').filter({ has: page.locator('[id$="-name"]') });
  await rows.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  const match = not ? rows.filter({ hasNotText: type }) : rows.filter({ hasText: type });
  test.skip(await match.count() === 0, `No ${not ? 'non-' : ''}${type} route on Route Tracker today`);
  await match.first().locator('[id$="-name"]').click();
  await page.waitForURL(/\/routes\/route-tracker\/\d+$/, { timeout: 15000 });
}

async function openMapActions(page) {
  await page.getByRole('button', { name: /Map Actions/i }).click();
}

test.describe('Route Tracker Details - Trigger Map (RVP-4568)', () => {
  test('C45379 / C45383 - Map Actions has Trigger Map, which opens the map as a modal', async ({ page }) => {
    await openRouteOfType(page, 'Front Load');
    await openMapActions(page);
    await page.getByText('Trigger Map', { exact: true }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('.gm-style, .mapboxgl-map, canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('C45382 - Trigger Map lists event log items when there are any', async ({ page }) => {
    await openRouteOfType(page, 'Front Load');
    await openMapActions(page);
    await page.getByText('Trigger Map', { exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('tab', { name: /Event Log|Trigger Map/i }).first().click().catch(() => {});
    const items = modal.getByRole('row').or(modal.locator('li'));
    test.info().annotations.push({ type: 'event-log-items', description: String(await items.count()) });
    // Either a list of events or an explicit empty state - never blank.
    await expect(items.first().or(modal.getByText(/No (events|data|triggers)/i)).first()).toBeVisible({ timeout: 10000 });
  });

  test('C45381 - Trigger Map is not offered for other vehicle types', async ({ page }) => {
    await openRouteOfType(page, 'Front Load', { not: true });
    await openMapActions(page);
    await expect(page.getByText('Trigger Map', { exact: true })).toHaveCount(0);
  });
});
