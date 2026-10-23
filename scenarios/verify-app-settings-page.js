// name: Verify Application Settings page
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). No tenant-specific values in this flow, so
// the body is unchanged from the UK original.
// Still to confirm live: all five headings exist on this tenant -
// "Routeware Admin Features" in particular depends on this account's role.
async page => {
  await page.locator('#menu-settings-button > svg').click();

  const appSettingsLink = page.getByText('Application Settings', { exact: true });
  await appSettingsLink.waitFor({ state: 'visible', timeout: 15000 });
  await appSettingsLink.click();
  await page.waitForURL('**/account-settings', { timeout: 15000 });

  const headings = [
    'Application Settings',
    'User Profile',
    'Company Configuration',
    'Features',
    'Routeware Admin Features',
  ];

  for (const heading of headings) {
    await page.getByRole('heading', { name: heading, exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  }

  return { url: page.url(), headingsVerified: headings };
}
