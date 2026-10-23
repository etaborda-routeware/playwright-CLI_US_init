// @ts-check
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). The UK original asserted the flag is ON
// because that vendor had it on. This vendor's ("Eliana -QAUSA") state
// isn't known yet, so EXPECTED_CHECKED is null: the scenario verifies the
// flag control exists and reports its state. Set EXPECTED_CHECKED to
// true/false once confirmed live. Service Deployer's editor shares the
// "Classification Descriptor" concept with UK Address Data (see the UK
// repo's pending/c66747), so it's possible this control doesn't exist
// here at all - if so, this scenario should move to the UK-only list.
import { test, expect } from '@playwright/test';

test('C66746 - Service deployer feature flag', async ({ page }) => {
  const EXPECTED_CHECKED = null;
  const settingsUrl = '/account-settings';

  // The runner authenticates before scenarios and restores the saved session
  // (including the selected vendor), so this scenario can go straight to
  // the Application Settings page it's testing.
  await page.goto(settingsUrl);
  await page.waitForURL('**/account-settings', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 15000 });

  // The Service Deployer checkbox lives under Features > Account Management
  // (confirmed live - input[name="ServiceDeployerTools"]).
  //
  // TestRail C66746 has this test click the checkbox to activate it.
  // Clicking toggles a shared vendor setting other scenarios may rely on,
  // so (as on the UK tenant) this reads the state instead of toggling it.
  const flagControl = page.locator('input[name="ServiceDeployerTools"]');
  await expect(flagControl).toBeAttached({ timeout: 15000 });

  const isChecked = await flagControl.isChecked();
  // Surfaced in the HTML report so the observed state is visible even while
  // EXPECTED_CHECKED is still null (nothing asserted yet).
  test.info().annotations.push({ type: 'flag-state', description: `isChecked=${isChecked}, expected=${EXPECTED_CHECKED}` });
  if (EXPECTED_CHECKED !== null) {
    expect(isChecked, `Service Deployer check button is ${isChecked ? 'marked' : 'not marked'}, expected ${EXPECTED_CHECKED ? 'marked' : 'not marked'}`).toBe(EXPECTED_CHECKED);
  }
});
