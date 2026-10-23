async page => {
  const LOGIN_URL = 'https://hauler.qa.smartcity.routeware.com/account/login';
  const DASHBOARD_URL = 'https://hauler.qa.smartcity.routeware.com/dashboard/all-ops';
  const EMAIL = '__EMAIL__';
  const PASSWORD = '__PASSWORD__';
  const VENDOR = '__VENDOR__';
  const STATE_PATH = '.auth/hauler-eliana-qausa.json';

  await page.goto(DASHBOARD_URL);

  // Locale-independent: the page can render its heading text in
  // whatever language the browser/OS locale selects (e.g. Spanish),
  // so detect the login form via the email input instead of text.
  const loginForm = page.locator('input[name="email"]');
  const fleetLink = page.getByRole('link', { name: 'Fleet' });
  await Promise.race([
    loginForm.waitFor({ state: 'visible', timeout: 15000 }),
    fleetLink.waitFor({ state: 'visible', timeout: 15000 }),
  ]);

  if (!(await loginForm.isVisible())) {
    return { status: 'session-valid' };
  }

  // Storage state missing or expired - log in fresh.
  await page.goto(LOGIN_URL);
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  // Locale-independent: button label is localized ("Login" / "Iniciar sesión").
  await page.locator('button[type="submit"]').click();

  // Locale-independent: wait for the vendor picker widget itself rather
  // than a localized heading ("Please Select Vendor" / "Seleccione un proveedor").
  const vendorPicker = page.locator('#vendorId');
  await vendorPicker.waitFor({ state: 'visible', timeout: 15000 });
  await vendorPicker.click({ force: true });
  // The list holds hundreds of vendors and only renders those scrolled into
  // view, so type into the (now focused) search box to filter first. Scoped
  // to react-select's option elements, since its hidden input-sizer div
  // mirrors the typed text and would otherwise also match.
  await page.keyboard.type(VENDOR);
  await page.locator('[id*="-option-"]').getByText(VENDOR, { exact: true }).click();
  // Locale-independent: button label is localized ("Apply" / "Aplicar").
  // Scoped by id since the login form's submit button is still in the DOM
  // at this point, and both share button[type="submit"].
  await page.locator('#select-vendor-button').click();

  await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });
  await fleetLink.waitFor({ state: 'visible', timeout: 15000 });

  await page.context().storageState({ path: STATE_PATH });

  return { status: 'relogged-in', vendor: VENDOR };
}
