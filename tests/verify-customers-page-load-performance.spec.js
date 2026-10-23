// @ts-check
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Only the host changed (dev.smartcity...uk ->
// qa.smartcity...com).
// Still to confirm live: the 5s budget is realistic for this tenant's
// dataset size (it's the TestRail C445023 expectation, so keep it unless
// the case itself changes) and the /V2/customersQuick endpoint.
import { test, expect } from '@playwright/test';

test('C445023 - Initial Page Load Performance - Standard Dataset', async ({ page }) => {
  const dashboardUrl = '/dashboard/all-ops';

  await page.goto(dashboardUrl);
  await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });

  // "the search was optimized for speed (QUICK)" - confirmed live the
  // Customers page's own search hits /V2/customersQuick specifically (a
  // distinct, speed-oriented endpoint), not a generic /V2/customers.
  const quickRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('/V2/customersQuick')) {
      quickRequests.push(req.url());
    }
  });

  const start = Date.now();
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });

  // "The customer list is fully visible and interactive" - wait for real
  // data rows, not just the page shell/heading.
  await page.waitForFunction(
    () => document.querySelectorAll('[id^="customer-"]').length > 0,
    { timeout: 10000 }
  );
  const elapsedMs = Date.now() - start;

  const budgetMs = 5000; // "within 3 to 5 seconds"
  expect(elapsedMs, `Expected the Customers page to load within ${budgetMs}ms, took ${elapsedMs}ms`).toBeLessThanOrEqual(budgetMs);
  expect(quickRequests.length, 'Expected the Customers page to use the speed-optimized /V2/customersQuick endpoint, none was seen').toBeGreaterThan(0);
});
