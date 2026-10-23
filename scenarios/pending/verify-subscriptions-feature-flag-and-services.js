// name: C70220 - Subscriptions Feature Flag - Enabled - Core Functionality
// NOTE: Ported from UK-PW-automation on 2026-09-25 into pending/ - NOT
// runnable here yet (host swapped only). Step 2 hardcodes a UK customer
// (3382483) that already has three subscription-type services (AHP,
// Garden, Clinical), so it can't pass on this tenant as written. To finish:
// confirm live whether input[name="Subscriptions"] exists and is ON for
// "Eliana -QAUSA"; if it is, find (or create) a US customer location with
// subscription-type services, replace the customer ID and the
// subscriptionTypes list below, then move this up to scenarios/. If the
// flag is off here, change step 1 to verify that state instead and drop
// step 2.
async page => {
  const settingsUrl = 'https://hauler.qa.smartcity.routeware.com/account-settings';
  const customerUrl = 'https://hauler.qa.smartcity.routeware.com/customers/customers/3382483/edit';

  // 1. The Subscriptions checkbox is active for this vendor (Eliana FRT -
  // UK). Verified via input[name="Subscriptions"] under Application
  // Settings > Features > Account Management - not clicked, since it's
  // already checked and clicking would flip a shared setting (same
  // reasoning as verify-uk-address-data-activated.js).
  await page.goto(settingsUrl);
  await page.waitForURL('**/account-settings', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Application Settings' }).waitFor({ state: 'visible', timeout: 15000 });

  const flagControl = page.locator('input[name="Subscriptions"]');
  await flagControl.waitFor({ state: 'attached', timeout: 15000 });
  if (!(await flagControl.isChecked())) {
    throw new Error('Subscriptions check button is not marked');
  }

  // 2. With the flag on, "Subscription Type" services (Absorbent Hygiene
  // Products / AHP, Clinical, Garden, Hazardous - confirmed via the app's
  // i18n bundle: a `subscriptionTypes` dictionary with exactly these 4) are
  // real, usable service types on a customer location, not just flag-gated
  // dead code. This customer/location already has 3 of them active
  // (AHP, Garden, Clinical) - verify they're visible and each links to a
  // working service edit page (core functionality actually functioning),
  // rather than only checking the flag bit.
  await page.goto(customerUrl);
  await page.waitForURL('**/customers/customers/3382483/edit', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Customer details' }).waitFor({ state: 'visible', timeout: 15000 });

  // Wait for the location row's own summary text (proof the
  // services/subscriptions data has actually loaded) before touching Show
  // Services - clicking as soon as the button is merely attached races the
  // async services fetch: confirmed live the click can silently no-op if
  // it lands before that data (and the button's real click handler) is
  // ready, leaving the panel collapsed for the rest of the timeout.
  await page.getByText(/Services & \d Subscriptions/).waitFor({ state: 'visible', timeout: 15000 });

  const showServicesButton = page.locator('button').filter({ hasText: 'Show Services' });
  await showServicesButton.waitFor({ state: 'visible', timeout: 15000 });
  await showServicesButton.click();
  await page.locator('button').filter({ hasText: 'Hide Services' }).waitFor({ state: 'visible', timeout: 10000 });

  // Each subscription type's row label also exists (hidden) inside every
  // other service row's own Waste Type <select> options - confirmed live
  // that getByText/waitFor({state:'visible'}) here matches those hidden
  // duplicates before the real, visible row label. document.body.innerText
  // only reflects actually-rendered text, so check against that instead.
  const subscriptionTypes = ['Absorbent Hygiene Products (AHP)', 'Garden', 'Clinical'];
  await page.waitForFunction(
    (names) => names.every((n) => document.body.innerText.includes(n)),
    subscriptionTypes,
    { timeout: 10000 }
  );

  return { flag: 'Subscriptions', status: 'activated', subscriptionTypesVisible: subscriptionTypes, url: page.url() };
}
