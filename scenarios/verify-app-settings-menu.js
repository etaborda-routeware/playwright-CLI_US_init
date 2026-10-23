// name: Verify Application Settings menu
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). Only the host changed (dev.smartcity...uk ->
// qa.smartcity...com).
// Renamed from the UK's "Verify-App-Settings.js" to match this repo's
// lowercase filename convention (it also fixes run order - an uppercase
// "V" sorted ahead of every lowercase file).
// Still to confirm live: the six settings-menu items and their roles.
async page => {
	const dashboardUrl = 'https://hauler.qa.smartcity.routeware.com/dashboard/all-ops';

	// The runner authenticates before scenarios and restores the saved session,
	// so this scenario can go straight to the page it's testing.
	await page.goto(dashboardUrl);
	await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });

	// Icon-only toggle button - no accessible name, so it's targeted by id.
	await page.locator('#menu-settings-button > svg').click();

	// Verified against the live menu for this account. The previous version
	// of this file asserted on "Create Vendor", "User profile" and "Conpany
	// Configuration" (also misspelled), none of which appear in this menu -
	// replaced with the items that are actually there.
	const menuItems = [
		{ name: 'Language Settings', role: 'button' },
		{ name: 'Application Settings', role: 'link' },
		{ name: 'Admin Settings', role: 'link' },
		{ name: 'Help Center', role: 'button' },
		{ name: 'Release Notes', role: 'link' },
		{ name: 'Logout', role: 'link' },
	];

	for (const { name, role } of menuItems) {
		const item = page.getByRole(role, { name, exact: true });
		await item.waitFor({ state: 'visible', timeout: 10000 });
	}

	// Logout and the settings links carry the app's admin base URLs - confirm
	// they actually point where they claim to, not just that the text exists.
	const logoutHref = await page.getByRole('link', { name: 'Logout', exact: true }).getAttribute('href');
	if (!logoutHref || !logoutHref.includes('/account/logout')) {
		throw new Error(`Logout link has unexpected href: ${logoutHref}`);
	}

	const appSettingsHref = await page.getByRole('link', { name: 'Application Settings', exact: true }).getAttribute('href');
	if (!appSettingsHref || !appSettingsHref.includes('/account-settings')) {
		throw new Error(`Application Settings link has unexpected href: ${appSettingsHref}`);
	}

	return {
		menu: 'settings',
		items: menuItems.map(item => item.name),
		status: 'all-visible',
		url: page.url()
	};
}
