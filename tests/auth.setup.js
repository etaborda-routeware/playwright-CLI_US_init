// @ts-check
import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// This project's package.json sets "type": "commonjs", so Playwright's test
// loader transpiles this file's import/export syntax down to CommonJS -
// __dirname is available in that transpiled scope (import.meta.url is not).
const STATE_PATH = path.join(__dirname, '..', 'playwright', '.auth', 'user.json');
// The session run-scenarios.sh / auth/login.template.js already maintain -
// restored first so both runners share one login.
const LEGACY_STATE_PATH = path.join(__dirname, '..', '.auth', 'hauler-eliana-qausa.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'auth', 'credentials.json');

function loadCredentials() {
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  }
  // CI has no auth/credentials.json (it's gitignored) - fall back to
  // environment variables, which .github/workflows/playwright.yml fills from
  // repository secrets.
  const { HAULER_EMAIL: email, HAULER_PASSWORD: password, HAULER_VENDOR: vendor } = process.env;
  if (email && password && vendor) {
    return { email, password, vendor };
  }
  return null;
}

setup('authenticate', async ({ browser, baseURL, userAgent }) => {
  // The browser fixture's newContext() doesn't pick up `use.baseURL` or
  // `use.userAgent` on its own, so pass them through explicitly - this keeps
  // playwright.config.js the only place the environment is defined.
  //
  // On the UK dev tenant a genuinely fresh, cookie-less context got a CORS
  // preflight failure on POST /V2/portalAccount/login. Mirror
  // auth/login.template.js's approach either way: restore the existing
  // session first and only fall back to a fresh credential login if that
  // session is actually missing/expired.
  const contextOptions = { baseURL, userAgent, ...(fs.existsSync(LEGACY_STATE_PATH) ? { storageState: LEGACY_STATE_PATH } : {}) };
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  await page.goto('/dashboard/all-ops');
  // Locale-independent: the page can render its heading text in whatever
  // language the browser/OS locale selects (e.g. Spanish), so detect the
  // login form via the email input instead of text.
  const loginForm = page.locator('input[name="email"]');
  const fleetLink = page.getByRole('link', { name: 'Fleet' });
  await Promise.race([
    loginForm.waitFor({ state: 'visible', timeout: 15000 }),
    fleetLink.waitFor({ state: 'visible', timeout: 15000 }),
  ]);

  if (!(await loginForm.isVisible())) {
    // Restored session is still valid.
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    await context.storageState({ path: STATE_PATH });
    await context.close();
    return;
  }

  // Restored session missing/expired - log in fresh.
  const credentials = loadCredentials();
  if (!credentials) {
    await context.close();
    throw new Error(
      `No valid session and no ${CREDENTIALS_PATH} (or HAULER_EMAIL/HAULER_PASSWORD/HAULER_VENDOR) to log in fresh with - copy auth/credentials.example.json to auth/credentials.json and fill in real values (see README.md).`
    );
  }
  const { email, password, vendor } = credentials;

  await page.goto('/account/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  // Locale-independent: button label is localized ("Login" / "Iniciar sesión").
  await page.locator('button[type="submit"]').click();

  // Locale-independent: wait for the vendor picker widget itself rather than
  // a localized heading ("Please Select Vendor" / "Seleccione un proveedor").
  const vendorPicker = page.locator('#vendorId');
  await vendorPicker.waitFor({ state: 'visible', timeout: 15000 });
  await vendorPicker.click({ force: true });
  // The list holds hundreds of vendors and only renders those scrolled into
  // view, so type into the (now focused) search box to filter first. Scoped
  // to react-select's option elements, since its hidden input-sizer div
  // mirrors the typed text and would otherwise also match.
  await page.keyboard.type(vendor);
  await page.locator('[id*="-option-"]').getByText(vendor, { exact: true }).click();
  // Scoped by id since the login form's submit button is still in the DOM
  // at this point, and both share button[type="submit"].
  await page.locator('#select-vendor-button').click();

  await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });
  await expect(fleetLink).toBeVisible({ timeout: 15000 });

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  await context.storageState({ path: STATE_PATH });
  // Keep the playwright-cli runner's session fresh too, so a login here
  // also saves run-scenarios.sh a re-login.
  fs.mkdirSync(path.dirname(LEGACY_STATE_PATH), { recursive: true });
  await context.storageState({ path: LEGACY_STATE_PATH });
  await context.close();
});
