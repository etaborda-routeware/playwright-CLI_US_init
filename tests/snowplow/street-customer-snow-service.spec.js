// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-snowplow.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check.
// Snow plow service on a Street customer. Which customer is a Street
// customer is per-vendor data, so these skip until STREET_CUSTOMER_ID is
// set (env var or the constant below) to one with a snow plow service.
// Manual only: C49557 steps 2-4 (turning Snow Plow / Street Sweeper off
// under Alt Fleet and uploading a segment file).
import { test, expect } from '@playwright/test';
import { dismissPromo } from './snow-helpers';

const STREET_CUSTOMER_ID = process.env.STREET_CUSTOMER_ID || null;

async function openSnowServices(page) {
  test.skip(!STREET_CUSTOMER_ID, 'Set STREET_CUSTOMER_ID to a Street customer with a snow plow service');
  await page.goto(`/customers/customers/${STREET_CUSTOMER_ID}`);
  await dismissPromo(page);
  await page.getByRole('button', { name: /Show Services/i }).first().click();
  await expect(page.getByText(/Plow Passes - Forward/i).first()).toBeVisible({ timeout: 15000 });
}

async function openEditService(page) {
  await openSnowServices(page);
  await page.getByRole('button', { name: /Edit( Service)?/i }).first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });
  return modal;
}

test.describe('Street customer - snow plow service', () => {
  test('C66808 / C66885 - services list shows plow passes, Active and Edit', async ({ page }) => {
    await openSnowServices(page);
    await expect(page.getByText(/Plow Passes - Reverse/i).first()).toBeVisible();
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit/i }).first()).toBeVisible();
  });

  test('C66808 / C66885 / C49557 - Edit Service shows passes and a read-only Segment ID', async ({ page }) => {
    const modal = await openEditService(page);
    for (const label of ['Plow Passes - Forward', 'Plow Passes - Reverse', 'Service Notes']) {
      await expect(modal.getByText(label, { exact: false }).first(), label).toBeVisible();
    }
    // Segment ID is shown, not editable.
    const segment = modal.getByText(/Segment ID/i).first();
    await expect(segment).toBeVisible();
    await expect(segment.locator('xpath=ancestor::*[1]').locator('input:not([readonly]):not([disabled])')).toHaveCount(0);
    // RVP-11152 dropped the Service Type dropdown.
    await expect(modal.getByText(/^Service Type$/)).toHaveCount(0);
  });

  test('C66808 / C66885 - Save keeps the service', async ({ page, browserName }) => {
    // Saves the unchanged service - chromium only, like the suite's other
    // state-changing tests.
    test.skip(browserName !== 'chromium', 'Saves customer data - chromium only');
    const modal = await openEditService(page);
    const forward = modal.getByLabel(/Plow Passes - Forward/i);
    const before = await forward.inputValue();
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).toBeHidden({ timeout: 10000 });

    const reopened = await openEditService(page);
    await expect(reopened.getByLabel(/Plow Passes - Forward/i)).toHaveValue(before);
  });
});
