// name: Verify Finance > Billing page loads
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Only the host changed. The 500 described
// below was observed on the UK tenant; this port checks whether the same
// page loads here. It also fails with a clear message if this tenant has
// no Finance nav item at all, rather than a bare timeout.
async page => {
  // On the UK tenant this scenario tracked a real, broken backend
  // dependency that blocks most of the Subscription Services TestRail
  // cases: the "Finance" top-level nav item (a recent addition) links to
  // /finance/billing, which failed to load for the UK vendor with a real,
  // reproducible 500 from .../V2/portalAccount/login/billing.
  // The page's own error text ("We couldn't load the billing details.
  // Please try again.") matches the `billingSurfaceLoadError` i18n string
  // found in the app's JS bundle during earlier investigation - this is a
  // real, named error state, not a fluke. /finance/payment-management
  // (a sibling route also found in the bundle) redirects back to this same
  // broken /finance/billing, so the failure blocks that too.
  const dashboardUrl = 'https://hauler.qa.smartcity.routeware.com/dashboard/all-ops';
  const billingUrl = 'https://hauler.qa.smartcity.routeware.com/finance/billing';

  await page.goto(dashboardUrl);
  await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });

  const financeLink = page.getByRole('link', { name: 'Finance', exact: true });
  await financeLink.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
    throw new Error('No "Finance" top-level nav item on this tenant - either it isn\'t rolled out here yet, or it\'s gated behind a flag this vendor doesn\'t have');
  });
  await financeLink.click();
  await page.waitForURL('**/finance/billing', { timeout: 15000 });

  await page.getByRole('heading', { name: 'Billing' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1500);

  const errorMessage = page.getByText("We couldn't load the billing details. Please try again.", { exact: true });
  if ((await errorMessage.count()) > 0) {
    throw new Error(
      'Finance > Billing failed to load ("We couldn\'t load the billing details. Please try again.") - ' +
      'check for the same backend 500 from /V2/portalAccount/login/billing seen on the UK tenant, ' +
      'which blocks the Subscription Services test cases and payment management there.'
    );
  }

  return { url: page.url(), status: 'billing-loaded' };
}
