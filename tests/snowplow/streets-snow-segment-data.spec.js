// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-snowplow.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check.
// Customers -> Streets: Update Segment Attributes (RVP-11152) and Add a
// Snow job. Nothing is uploaded or saved.
// Manual only: C49554 upload of a filled-in file (needs a prepared
// segment file), C42852-C42854 / C67011-C67013 saving a snow job (no steps
// in the export - only the modal is checked here).
import { test, expect } from '@playwright/test';
import fs from 'fs';
import { dismissPromo, readXlsxStrings } from './snow-helpers';

async function openStreets(page) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await dismissPromo(page);
  await page.getByRole('link', { name: 'Streets', exact: true }).or(page.getByRole('tab', { name: 'Streets', exact: true })).first().click();
  await expect(page.getByRole('button', { name: /Update Segment Attributes/i })).toBeVisible({ timeout: 15000 });
}

test.describe('Streets - snow segment data', () => {
  test('C42761 / C66898 / C52561 / C49554 - Update Segment Attributes opens the upload modal with a sample', async ({ page }) => {
    await openStreets(page);
    await page.getByRole('button', { name: /Update Segment Attributes/i }).click();
    // Older cases go through a "Update Snow Plowing Data" sub-option.
    const sub = page.getByText(/Update Snow Plowing Data/i);
    if (await sub.count() > 0) await sub.first().click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('input[type="file"]')).toBeAttached();
    await expect(modal.getByRole('button', { name: /Download/i }).or(modal.getByRole('link', { name: /Download/i })).first()).toBeVisible();
  });

  test('C49554 - sample file has the Snow Plow columns', async ({ page }, testInfo) => {
    await openStreets(page);
    await page.getByRole('button', { name: /Update Segment Attributes/i }).click();
    const sub = page.getByText(/Update Snow Plowing Data/i);
    if (await sub.count() > 0) await sub.first().click();
    const modal = page.getByRole('dialog');

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await modal.getByRole('button', { name: /Download/i }).or(modal.getByRole('link', { name: /Download/i })).first().click();
    const download = await downloadPromise;
    const file = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(file);

    const headers = /\.csv$/i.test(file)
      ? fs.readFileSync(file, 'utf8').split(/\r?\n/)[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
      : readXlsxStrings(file);
    test.info().annotations.push({ type: 'sample-columns', description: headers.join(' | ') });

    // Plow passes only appear while Snow Plow is on under Alt Fleet; sweep
    // passes only while Street Sweeper is on - so only Snow's are asserted.
    expect(headers).toEqual(expect.arrayContaining(['Route Template Assignment', 'Plow Passes - Forward', 'Plow Passes - Reverse']));
  });

  test('C51649 - Add Street Job is available on Streets', async ({ page }) => {
    await openStreets(page);
    await expect(page.getByRole('button', { name: /Add Street Job/i }).or(page.getByRole('link', { name: /Add Street Job/i })).first()).toBeVisible();
  });

  test('C42852 / C42853 / C42854 / C67011 / C67012 / C67013 - Add a Snow job offers One Time and Range', async ({ page }) => {
    await openStreets(page);
    await page.getByRole('button', { name: /Add (Street|Snow) Job/i }).or(page.getByRole('link', { name: /Add (Street|Snow) Job/i })).first().click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText(/One ?Time/i).first()).toBeVisible();
    await expect(modal.getByText(/Range/i).first()).toBeVisible();
    // Vehicle type here is Snow Plow / Street Sweeper only (C51618).
    await modal.getByRole('button', { name: /Cancel|Close/ }).first().click();
  });
});
