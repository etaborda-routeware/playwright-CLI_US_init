// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html, so the app
// never rendered). Every selector below is a best guess from the case text
// and needs a live check.
// Covers C44075 / C45657 / C48307 / C49102 / C67169 - five copies of the same
// "Check messaging feature notifications" case. Only the Vendor Portal half
// is automated; the driver-app half (pop-up with OK / View) needs a device
// and stays manual.
// Sends real messages to the QA vendor's logged-in drivers, so it runs on
// chromium only (not once per browser project).
import { test, expect } from '@playwright/test';

test.describe('Dashboard - messaging (C44075, C45657, C48307, C49102, C67169)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Sends real messages - run once, on chromium only');

  async function openNewMessage(page) {
    await page.getByRole('button', { name: /New Message/ }).click();
  }

  async function pickFirstOption(page, trigger) {
    await trigger.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    await options.first().waitFor({ state: 'visible', timeout: 10000 });
    await options.first().click();
  }

  async function sendAndVerify(page, text) {
    await page.getByPlaceholder(/message/i).fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
    // Case expects the sent message to show up with a timestamp.
    const sent = page.getByText(text, { exact: true });
    await expect(sent).toBeVisible({ timeout: 10000 });
  }

  test('Send messages to All, Driver, Vehicle Type and Route', async ({ page }) => {
    await page.goto('/dashboard/all-ops');

    // 1. Messages button, bottom right - menu expands and lists recent messages.
    await page.getByRole('button', { name: /Messages/ }).click();
    await expect(page.getByRole('button', { name: /New Message/ })).toBeVisible({ timeout: 15000 });

    // 2. + New Message -> Select Recipient lists All / Driver / Vehicle Type / Route.
    await openNewMessage(page);
    const recipient = page.getByText('Select Recipient');
    await recipient.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    for (const name of ['All', 'Driver', 'Vehicle Type', 'Route']) {
      await expect(options.filter({ hasText: new RegExp(`^${name}$`) })).toBeVisible({ timeout: 10000 });
    }

    // 3. All -> send. The case allows messages up to 500 characters.
    await options.filter({ hasText: /^All$/ }).click();
    await sendAndVerify(page, `PW All ${Date.now()}`);

    // 4-6. Driver / Vehicle Type / Route - each needs a second pick from the
    // list that appears once the recipient type is chosen.
    for (const type of ['Driver', 'Vehicle Type', 'Route']) {
      await page.getByRole('button', { name: 'Close' }).click();
      await openNewMessage(page);
      await page.getByText('Select Recipient').click({ force: true });
      await options.filter({ hasText: new RegExp(`^${type}$`) }).click();
      await pickFirstOption(page, page.getByText(new RegExp(`^Select ${type}`)));
      await sendAndVerify(page, `PW ${type} ${Date.now()}`);
    }
  });
});
