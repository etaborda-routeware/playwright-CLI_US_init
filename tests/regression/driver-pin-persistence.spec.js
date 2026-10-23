// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check.
// SCP-4780 Driver PIN Persistence (both cases are Critical).
// Changes vendor settings, so it runs on chromium only, in order, and
// turns Driver PIN back off at the end if it was off to start with.
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Driver PIN persistence (SCP-4780)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Changes vendor settings - chromium only');

  let originallyOn = null;

  async function openDriverPin(page) {
    await page.goto('/account-settings');
    await page.waitForURL('**/account-settings', { timeout: 15000 });
    // Application Settings -> App Experience -> Driver PIN row.
    await page.getByText('App Experience', { exact: true }).click();
    const row = page.getByText('Driver PIN', { exact: true }).locator('xpath=ancestor::*[.//input[@type="checkbox"]][1]');
    await expect(row).toBeVisible({ timeout: 15000 });
    return row;
  }

  function toggleOf(row) {
    return row.locator('input[type="checkbox"]').first();
  }

  async function saveDialog(page) {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden({ timeout: 10000 });
  }

  test('C441029 - Driver PIN stays ON after enabling, saving and refreshing', async ({ page }) => {
    const row = await openDriverPin(page);
    originallyOn = await toggleOf(row).isChecked();

    if (!originallyOn) {
      await toggleOf(row).check({ force: true });
      // Turning it on opens the Driver PIN popup, which needs a PIN.
      const pin = page.getByRole('dialog').locator('input').first();
      if (await pin.isVisible()) await pin.fill('1234');
      await saveDialog(page);
    }

    await page.reload();
    await expect(toggleOf(await openDriverPin(page))).toBeChecked();
  });

  test('C441030 - resetting the PIN does not turn Driver PIN off', async ({ page }) => {
    let row = await openDriverPin(page);
    await expect(toggleOf(row)).toBeChecked();

    await row.getByRole('button').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Reset PIN/ }).click();
    await dialog.locator('input').first().fill(String(1000 + Math.floor(Math.random() * 9000)));
    await saveDialog(page);

    row = await openDriverPin(page);
    await expect(toggleOf(row)).toBeChecked();
    await page.reload();
    await expect(toggleOf(await openDriverPin(page))).toBeChecked();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    if (originallyOn !== false) return;
    // Turn it back off. A fresh context has no storageState of its own, so
    // pass the project's one through.
    const context = await browser.newContext({ storageState: 'playwright/.auth/user.json', baseURL: testInfo.project.use.baseURL });
    const page = await context.newPage();
    const row = await openDriverPin(page);
    if (await toggleOf(row).isChecked()) {
      await toggleOf(row).uncheck({ force: true });
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible()) await saveDialog(page);
    }
    await context.close();
  });
});
