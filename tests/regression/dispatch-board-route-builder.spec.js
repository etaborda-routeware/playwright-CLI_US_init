// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check.
// C44547 Dispatch Board -> Route Builder, steps 1-6 (one unassigned job ->
// one route -> View Routes). Steps 7-11 need 250 clustered unassigned jobs
// and 10 spread-out ones, which QA doesn't have on demand, so they stay
// manual. Skips if there are no unassigned Delivery/Utility jobs.
// Creates a real route that this test does not delete, so it runs on
// chromium only.
import { test, expect } from '@playwright/test';

test('C44547 - Route Builder creates a route from one unassigned job', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Creates a route - chromium only');
  // Route Builder runs in the background; the case says "after a few seconds".
  test.setTimeout(180000);

  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Dispatch', exact: true }).click();
  await page.getByRole('link', { name: 'Dispatch Board' }).click();
  await page.getByText('Delivery/Utility', { exact: true }).click();

  // 2. Route Builder lists unassigned jobs with checkboxes.
  await page.getByRole('button', { name: 'Route Builder' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  const jobs = dialog.locator('input[type="checkbox"]');
  await jobs.first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
  const jobCount = await jobs.count();
  test.skip(jobCount === 0, 'No unassigned Delivery/Utility jobs on QA');

  // 3. One job -> Next -> starting location -> Create Routes. With more than
  // one checkbox the first is assumed to be the header's select-all.
  await jobs.nth(jobCount > 1 ? 1 : 0).check({ force: true });
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.locator('[id*="startingLocation" i], [id*="location" i]').first().click({ force: true });
  await page.locator('[id^="react-select-"][id*="-option-"]').first().click();
  await dialog.getByRole('button', { name: 'Create Routes' }).click();
  await expect(page.getByText(/Route Builder is creating your routes/)).toBeVisible({ timeout: 15000 });

  // 4. Close -> wait for the "Routes Created" prompt.
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText(/Your routes were created successfully/)).toBeVisible({ timeout: 150000 });

  // 5. View Routes -> Dispatch Board map.
  await page.getByRole('button', { name: 'View Routes' }).or(page.getByRole('link', { name: 'View Routes' })).click();
  await expect(page.locator('canvas, .mapboxgl-map, [class*="map" i]').first()).toBeVisible({ timeout: 15000 });
});
