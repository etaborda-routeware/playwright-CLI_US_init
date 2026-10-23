// name: Verify customer Billing tab
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). The UK original went straight to a hardcoded
// UK customer (/customers/customers/3382483/edit), which doesn't exist on
// this tenant. It now opens the first customer in the list instead (same
// approach as verify-location-creation-available.js), so it doesn't depend
// on any fixed record.
// Still to confirm live: the "Billing Details" tab name on this tenant.
async page => {
  // Navigate via the in-app nav link rather than page.goto() - on the UK
  // tenant a cold, direct navigation to /customers/customers crashed the app
  // (see verify-location-creation-available.js).
  await page.getByRole('link', { name: 'Customers' }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Customers' }).waitFor({ state: 'visible', timeout: 15000 });

  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  const firstCustomerName = page.locator('[id^="customer-"][id$="-name"]').first();
  await firstCustomerName.waitFor({ state: 'visible', timeout: 15000 });
  const customerName = (await firstCustomerName.textContent()).trim();
  await firstCustomerName.click();
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  const customerId = page.url().match(/\/customers\/customers\/(\d+)\/edit/)?.[1];

  const billingTab = page.getByRole('tab', { name: /^Billing Details$/i });
  await billingTab.waitFor({ state: 'visible', timeout: 15000 });
  await billingTab.click();

  // Confirm the tab is actually active (not just clicked) via its
  // aria-selected state, rather than a brittle hard-coded CSS path.
  await page.waitForFunction(
    () => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Billing Details',
    { timeout: 15000 }
  );

  return {
    customerName,
    customerId,
    billingTab: 'visible-and-selected',
    url: page.url()
  };
}
