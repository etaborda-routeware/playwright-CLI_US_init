// name: C66746 - Service deployer feature flag
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
async page => {
  const EXPECTED_CHECKED = null;
  const settingsUrl = 'https://hauler.qa.smartcity.routeware.com/account-settings';

  // The runner authenticates before scenarios and restores the saved session
  // (including the selected vendor), so this scenario can go straight to
  // the Application Settings page it's testing.
  await page.goto(settingsUrl);
  await page.waitForURL('**/account-settings', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Application Settings' }).waitFor({ state: 'visible', timeout: 15000 });

  // The Service Deployer checkbox lives under Features > Account Management
  // (confirmed live - input[name="ServiceDeployerTools"]).
  //
  // TestRail C66746 has this test click the checkbox to activate it.
  // Clicking toggles a shared vendor setting other scenarios may rely on,
  // so (as on the UK tenant) this reads the state instead of toggling it.
  const flagControl = page.locator('input[name="ServiceDeployerTools"]');
  await flagControl.waitFor({ state: 'attached', timeout: 15000 });

  const isChecked = await flagControl.isChecked();
  if (EXPECTED_CHECKED !== null && isChecked !== EXPECTED_CHECKED) {
    throw new Error(`Service Deployer check button is ${isChecked ? 'marked' : 'not marked'}, expected ${EXPECTED_CHECKED ? 'marked' : 'not marked'}`);
  }

  return { flag: 'Service Deployer', isChecked, expectedChecked: EXPECTED_CHECKED };
}
