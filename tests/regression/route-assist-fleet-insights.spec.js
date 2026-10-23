// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check.
// RVP-8299, Route Assist icon on the Fleet Insights summary pages.
// The icon only appears when some vehicle actually assisted another route
// in the selected date range, which depends on QA data. With no assisting
// vehicle in range the tests are skipped, not failed - the skip reason
// shows up in the report.
// Manual only (need a known vehicle-type mix in the data): C44832, C44833.
import { test, expect } from '@playwright/test';

async function openSummary(page, tileName, pageHeading) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Insights', exact: true }).click();
  // Each Insights tile has its own "See Details" link.
  const tile = page.getByText(tileName, { exact: true }).locator('xpath=ancestor::*[.//a[contains(., "See Details")]][1]');
  await tile.getByRole('link', { name: /See Details/ }).click();
  await expect(page.getByRole('heading', { name: pageHeading })).toBeVisible({ timeout: 15000 });
}

function routeAssistIcons(page) {
  return page.locator('[id*="route-assist" i], [data-testid*="route-assist" i], [title*="Route Assist" i], [aria-label*="Route Assist" i]');
}

test.describe('Fleet Insights - Route Assist (RVP-8299)', () => {
  for (const { ids, tile, heading, hoverText } of [
    { ids: 'C44830 / C44834', tile: 'Trip Time', heading: 'Trip Time Summary', hoverText: /assist/i },
    { ids: 'C44831 / C44835', tile: 'Pickups Per Hour', heading: 'Pickup Rate Summary', hoverText: /route/i },
  ]) {
    test(`${ids} - Route Assist icon on ${heading}`, async ({ page }) => {
      await openSummary(page, tile, heading);

      const icons = routeAssistIcons(page);
      const count = await icons.count();
      test.skip(count === 0, `No vehicle in range on ${heading} assisted another route - needs QA data`);

      const icon = icons.first();
      await expect(icon).toBeVisible();

      // Hover shows a summary (total assisted duration or number of routes).
      await icon.hover();
      await expect(page.getByRole('tooltip').or(page.locator('[class*="tooltip" i]')).filter({ hasText: hoverText }).first()).toBeVisible({ timeout: 5000 });

      // Click expands nested rows, one per assisted route.
      const rowsBefore = await page.getByRole('row').count();
      await icon.click();
      await expect.poll(() => page.getByRole('row').count(), { timeout: 10000 }).toBeGreaterThan(rowsBefore);
    });
  }
});
