// @ts-check
// NOTE: Ported from UK-PW-automation (verify-trade-featureFlag.js) on
// 2026-09-25 - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (at port time the QA frontend was
// serving a broken build: its main JS bundle URL returned index.html, so
// the app never rendered). Renamed to describe what it actually checks, and
// the vendor name dropped from the display name (it was "Eliana FRT - UK").
// The UK original asserted the flag is ON because that vendor had it on.
// This vendor's ("Eliana -QAUSA") state isn't known yet, so EXPECTED_CHECKED
// is null: the scenario verifies the flag control exists and is editable,
// and reports its state. Set EXPECTED_CHECKED to true/false once confirmed
// live, so a flipped flag turns this red.
import { test, expect } from '@playwright/test';

test('Verify Billing & Invoicing feature flag', async ({ page }) => {
  const EXPECTED_CHECKED = null;
  const settingsUrl = '/account-settings';

  // The runner authenticates before scenarios and restores the saved session
  // (including the selected vendor), so this scenario can go straight to
  // the Application Settings page it's testing.
  await page.goto(settingsUrl);
  await page.waitForURL('**/account-settings', { timeout: 15000 });

  // Locate the Billing & Invoicing feature flag via its stable `name`
  // attribute rather than a text lookup + fragile ancestor-row xpath.
  // The native checkbox is visually hidden behind a styled toggle span,
  // so wait for it to be attached rather than "visible".
  const flagControl = page.locator('input[name="BillingInvoicing"]');
  await expect(flagControl).toBeAttached({ timeout: 15000 });

  const isChecked = await flagControl.isChecked();
  // Surfaced in the HTML report so the observed state is visible even while
  // EXPECTED_CHECKED is still null (nothing asserted yet).
  test.info().annotations.push({ type: 'flag-state', description: `isChecked=${isChecked}, expected=${EXPECTED_CHECKED}` });
  if (EXPECTED_CHECKED !== null) {
    expect(isChecked, `Billing & Invoicing feature flag is ${isChecked ? 'checked' : 'not checked'}, expected ${EXPECTED_CHECKED ? 'checked' : 'not checked'}`).toBe(EXPECTED_CHECKED);
  }

  await expect(flagControl, 'Billing & Invoicing feature flag control is disabled').toBeEnabled();
});
