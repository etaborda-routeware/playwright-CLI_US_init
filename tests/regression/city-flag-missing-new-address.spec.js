// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check.
// RVP-3727, "Missing/New Address" City Flag. Each test lists both copies of
// its case (the export has the acceptance/functional set twice).
// The case text says "Rubicon Admin Features"; this tenant's heading is
// "Routeware Admin Features" (see verify-app-settings-page.spec.js).
// Manual only (need the driver app, email inbox or an existing exception):
// C45391/C45046, C45392/C45047, C45399/C45054, C45400/C45055,
// C45401/C45056, C45402/C45057, C45403/C45058.
import { test, expect } from '@playwright/test';

const FLAG = 'Missing/New Address';
// The default state can only be checked on a vendor that has never touched
// this flag. Until that's confirmed for this vendor, the default-state test
// only reports what it sees. Set to false once confirmed, so a change turns
// the test red.
const EXPECTED_DEFAULT_ENABLED = null;

async function openCityFlagModal(page) {
  await page.goto('/account-settings');
  await page.waitForURL('**/account-settings', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Routeware Admin Features', exact: true })).toBeVisible({ timeout: 15000 });
  // The City Flag row's pencil icon - scoped to the row holding the label.
  const row = page.getByText('City Flag', { exact: true }).locator('xpath=ancestor::*[.//button][1]');
  await row.getByRole('button').first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });
  return modal;
}

function flagRow(modal) {
  return modal.getByText(FLAG, { exact: true }).locator('xpath=ancestor::*[.//input[@type="checkbox"]][1]');
}

test.describe('City Flag - Missing/New Address (RVP-3727)', () => {
  test('C45389 / C45044 - Missing/New Address is listed under City Flag', async ({ page }) => {
    const modal = await openCityFlagModal(page);
    await expect(modal.getByText(FLAG, { exact: true })).toBeVisible();
  });

  test('C45390 / C45045 - Missing/New Address is disabled by default', async ({ page }) => {
    const modal = await openCityFlagModal(page);
    const enabled = await flagRow(modal).locator('input[type="checkbox"]').first().isChecked();
    test.info().annotations.push({ type: 'flag-state', description: `enabled=${enabled}, expected default=${EXPECTED_DEFAULT_ENABLED}` });
    if (EXPECTED_DEFAULT_ENABLED !== null) {
      expect(enabled).toBe(EXPECTED_DEFAULT_ENABLED);
    }
  });

  test('C45394 / C45049, C45395 / C45050 - picture request and email options exist', async ({ page }) => {
    const modal = await openCityFlagModal(page);
    const row = flagRow(modal);
    // The row's checkboxes: enable, then request picture.
    await expect(row.locator('input[type="checkbox"]')).toHaveCount(2, { timeout: 10000 });
    await expect(row.getByRole('textbox')).toBeVisible();
  });

  test.describe('state-changing', () => {
    // Saves vendor settings - run once, on chromium only, and always restore.
    test.skip(({ browserName }) => browserName !== 'chromium', 'Changes vendor settings - chromium only');

    test('C45393 / C45048, C45396 / C45051, C45398 / C45053, C45397 / C45052 - enable shows it in City Insights, then disable', async ({ page }) => {
      let modal = await openCityFlagModal(page);
      let toggle = flagRow(modal).locator('input[type="checkbox"]').first();
      const original = await toggle.isChecked();

      try {
        // Enable and save.
        if (!original) await toggle.check({ force: true });
        await modal.getByRole('button', { name: 'Save' }).click();
        await expect(modal).toBeHidden({ timeout: 10000 });

        modal = await openCityFlagModal(page);
        await expect(flagRow(modal).locator('input[type="checkbox"]').first()).toBeChecked();
        await modal.getByRole('button', { name: /Cancel|Close/ }).first().click();

        // Dashboard -> Filters -> City Insights lists the new flag.
        await page.goto('/dashboard/all-ops');
        await page.getByRole('button', { name: /Filters/ }).click();
        await page.getByText(/City Insights?/).first().click();
        await expect(page.getByText(FLAG, { exact: true }).first()).toBeVisible({ timeout: 15000 });

        // Community Insights page lists it too.
        await page.getByRole('link', { name: 'Insights', exact: true }).click();
        await page.getByRole('link', { name: /Community Insights/ }).click();
        await expect(page.getByText(FLAG, { exact: true }).first()).toBeVisible({ timeout: 15000 });

        // Disable and save.
        modal = await openCityFlagModal(page);
        toggle = flagRow(modal).locator('input[type="checkbox"]').first();
        await toggle.uncheck({ force: true });
        await modal.getByRole('button', { name: 'Save' }).click();
        modal = await openCityFlagModal(page);
        await expect(flagRow(modal).locator('input[type="checkbox"]').first()).not.toBeChecked();
        await modal.getByRole('button', { name: /Cancel|Close/ }).first().click();
      } finally {
        // Put the vendor back the way it was.
        modal = await openCityFlagModal(page);
        toggle = flagRow(modal).locator('input[type="checkbox"]').first();
        if ((await toggle.isChecked()) !== original) {
          await toggle.setChecked(original, { force: true });
          await modal.getByRole('button', { name: 'Save' }).click();
        }
      }
    });
  });
});
