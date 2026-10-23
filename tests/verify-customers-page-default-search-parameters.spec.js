// @ts-check
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Only the host changed (dev.smartcity...uk ->
// qa.smartcity...com).
// Still to confirm live: the /V2/customersQuick endpoint and its
// customerStatusTypeIds default, and the [id^="customer-"] row ids.
import { test, expect } from '@playwright/test';

test('C445022 - Automatic Application of Default Search Parameters', async ({ page }) => {
  const dashboardUrl = '/dashboard/all-ops';

  await page.goto(dashboardUrl);
  await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });

  // Capture the customer search API call the Customers page fires on its
  // own, before any manual input - this is the real signal for "default
  // search parameters are automatically populated" and "the search is
  // triggered automatically", rather than trying to read values back out
  // of the (visually blank - see verify-customers-page-ui-consistency-
  // defaults.js) filter textboxes.
  const quickRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('/V2/customersQuick')) {
      quickRequests.push(req.url());
    }
  });

  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 15000 });

  // "results are displayed within 3 to 5 seconds" - the data grid showing
  // real rows (not just the heading) is the actual "search executed
  // successfully" signal.
  await page.waitForFunction(
    () => document.querySelectorAll('[id^="customer-"]').length > 0,
    { timeout: 5000 }
  );

  expect(quickRequests.length, 'Expected the Customers page to automatically fire a /V2/customersQuick search request, none was seen').toBeGreaterThan(0);

  const queryString = quickRequests[0].split('?')[1] || '';
  const params = Object.fromEntries(
    queryString.split('&').filter(Boolean).map((pair) => {
      const [key, value] = pair.split('=');
      return [decodeURIComponent(key), decodeURIComponent(value || '')];
    })
  );

  // Confirmed live: the request always carries customerStatusTypeIds=1,2 -
  // a real default parameter applied without any manual input.
  expect(params.customerStatusTypeIds, `Expected the automatic search to include a default customerStatusTypeIds parameter, got: ${JSON.stringify(params)}`).toBeTruthy();
});
