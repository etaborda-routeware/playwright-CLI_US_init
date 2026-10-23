// name: Verify main page displays the required menus
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Only the host changed (dev.smartcity...uk ->
// qa.smartcity...com).
// Still to confirm live: this tenant shows the same four top-level menus
// (Fleet and Customers are already confirmed by the 2026-09-07 ports;
// Dispatch and Insights are not).
async page => {
	const dashboardUrl = 'https://hauler.qa.smartcity.routeware.com/dashboard/all-ops';

	// The runner authenticates before scenarios and restores the saved session,
	// so this scenario can go straight to the page it's testing.
	await page.goto(dashboardUrl);
	await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });

	const menus = ['Dispatch', 'Customers', 'Fleet', 'Insights'];
	for (const menu of menus) {
		const menuLink = page.getByRole('link', { name: menu, exact: true });
		await menuLink.waitFor({ state: 'visible', timeout: 15000 });
	}

	return { menus, status: 'all-visible', url: page.url() };
}
