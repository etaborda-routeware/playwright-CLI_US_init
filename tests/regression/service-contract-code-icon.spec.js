// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check.
// RVP-8872: on a SmartCity vendor, the Service Account # field of a service
// contract has a green info icon whose hover text is
// "Rubicon Service Account #<ServiceContractCode>".
// This suite's login vendor ("Eliana -QAUSA") is assumed to be a SmartCity
// vendor - confirm live.
// Manual only (need a Superadmin, other vendor types or other roles):
// C44836, C44838, C44840. C44839 (new contract) is not automated yet: the
// create flow is in create-service-on-location.spec.js, but this check
// isn't wired onto it.
import { test, expect } from '@playwright/test';

async function openFirstServiceContract(page) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Customers' }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });

  // Same promo dialog handling as create-service-on-location.spec.js.
  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  await page.locator('[id^="customer-"][id$="-name"]').first().click();
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customer locations' })).toBeVisible({ timeout: 15000 });

  // An existing service (not the "/service/-1" Add New Service link).
  const editLink = page.locator('a[href*="/service/"]:not([href$="/service/-1"])').first();
  await expect(editLink).toBeAttached({ timeout: 15000 });
  await page.goto(await editLink.getAttribute('href'));
}

function serviceAccountInfoIcon(page) {
  return page.getByText('Service Account #').locator('xpath=ancestor::*[.//svg][1]').locator('svg').first();
}

test.describe('Service contract - ServiceContractCode icon (RVP-8872)', () => {
  test('C44842 - info icon is shown for a SmartCity vendor and hover shows the account number', async ({ page }) => {
    await openFirstServiceContract(page);
    const icon = serviceAccountInfoIcon(page);
    await expect(icon).toBeVisible({ timeout: 15000 });
    await icon.hover();
    await expect(page.getByText(/Rubicon Service Account #\s*\S+/)).toBeVisible({ timeout: 5000 });
  });

  test('C44837 - hover text matches the ServiceContractCode returned by the API', async ({ page }) => {
    // Capture the service contract the edit page loads, instead of reading
    // it by hand in dev tools as the manual case does.
    let contractCode = null;
    page.on('response', async (response) => {
      if (contractCode || !['fetch', 'xhr'].includes(response.request().resourceType())) return;
      try {
        const match = JSON.stringify(await response.json()).match(/"serviceContractCode"\s*:\s*"([^"]+)"/i);
        if (match) contractCode = match[1];
      } catch {
        // Not JSON - ignore.
      }
    });

    await openFirstServiceContract(page);
    const icon = serviceAccountInfoIcon(page);
    await expect(icon).toBeVisible({ timeout: 15000 });
    await expect.poll(() => contractCode, { message: 'No serviceContractCode seen in any API response', timeout: 10000 }).not.toBeNull();

    await icon.hover();
    await expect(page.getByText(`Rubicon Service Account #${contractCode}`, { exact: false })).toBeVisible({ timeout: 5000 });
  });
});
