// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). The
// Route Planner navigation is the one create-route-template.spec.js
// confirmed live; the Route Template Builder entry point is a guess.
// RVP-3736 Route Template Builder (each case is in the export twice).
// Not yet: C45411 / C45074, C45412 / C45075 (creating and publishing a
// work session changes real route templates - needs a throwaway template).
import { test, expect } from '@playwright/test';
import { dismissPromo, mapContainer } from './acceptance-helpers';

// The case: initial load is "close to 1 min 30 seconds". Allow 10% over.
const MAX_LOAD_MS = 99000;

async function openRouteTemplateBuilder(page) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Dispatch' }).click();
  await page.waitForURL('**/routes/route-tracker', { timeout: 15000 });
  await page.getByRole('link', { name: 'Route Planner' }).click();
  await page.waitForURL('**/routes/route-templates', { timeout: 15000 });
  await dismissPromo(page);
  const start = Date.now();
  await page.getByRole('link', { name: /Route Template Builder/i }).or(page.getByRole('button', { name: /Route Template Builder/i })).first().click();
  await expect(page.getByRole('heading', { name: /Route Template Builder/i })).toBeVisible({ timeout: MAX_LOAD_MS });
  await expect(mapContainer(page)).toBeVisible({ timeout: MAX_LOAD_MS });
  return Date.now() - start;
}

test.describe('Route Template Builder (RVP-3736)', () => {
  test.setTimeout(180000);

  test('C45410 / C45073 - Route Template Builder opens', async ({ page }) => {
    await openRouteTemplateBuilder(page);
    await expect(page.getByRole('button', { name: /Work Session|New Session|Create/i }).first()).toBeVisible();
  });

  test('C45413 / C45076 - initial load takes about 1:30 or less', async ({ page }) => {
    const ms = await openRouteTemplateBuilder(page);
    test.info().annotations.push({ type: 'load-time', description: `${(ms / 1000).toFixed(1)}s` });
    expect(ms).toBeLessThanOrEqual(MAX_LOAD_MS);
  });
});
