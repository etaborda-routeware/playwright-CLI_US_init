// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). The
// Customers -> first customer -> Add New Service flow is the one
// create-service-on-location.spec.js confirmed live; the Edit Service
// pencil and Select Containers modal are guesses from the case titles.
// Service modals with many containers. Nothing is saved.
// Manual only: C45170 (importing 10,000 containers into a vendor). The
// "no delay" checks are meaningful only on a vendor that has that many.
import { test, expect } from '@playwright/test';
import { dismissPromo } from './acceptance-helpers';

// "No delay" from the case, made concrete.
const MAX_OPEN_MS = 5000;

async function openFirstCustomer(page) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Customers' }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await dismissPromo(page);
  await page.locator('[id^="customer-"][id$="-name"]').first().click();
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customer locations' })).toBeVisible({ timeout: 15000 });
}

async function openCreateService(page) {
  await openFirstCustomer(page);
  // Add New Service sits in a hover tooltip (confirmed live).
  const addServiceButton = page.locator('button').filter({ has: page.locator('a[href*="/service/-1"]') }).first();
  await addServiceButton.scrollIntoViewIfNeeded();
  await addServiceButton.hover();
  const start = Date.now();
  await page.getByRole('link', { name: 'Add New Service' }).click();
  await expect(page.getByRole('heading', { name: 'Create New Service' })).toBeVisible({ timeout: 15000 });
  return Date.now() - start;
}

async function openEditService(page) {
  await openFirstCustomer(page);
  const edit = page.locator('a[href*="/service/"]:not([href$="/service/-1"])');
  test.skip(await edit.count() === 0, 'First customer has no service to edit - run the seed project');
  const start = Date.now();
  await page.goto(/** @type {string} */ (await edit.first().getAttribute('href')));
  await expect(page.getByRole('heading', { name: /Edit Service|Service Details/i })).toBeVisible({ timeout: 15000 });
  return Date.now() - start;
}

async function openSelectContainers(page) {
  await page.getByRole('button', { name: /Select Containers/i }).or(page.getByText(/^Select Containers$/i)).first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });
  return modal;
}

test.describe('Service modals - containers', () => {
  test('C45172 - Create Service opens without delay', async ({ page }) => {
    const ms = await openCreateService(page);
    test.info().annotations.push({ type: 'open-time', description: `${ms}ms` });
    expect(ms).toBeLessThan(MAX_OPEN_MS);
  });

  test('C45171 - Edit Service opens without delay', async ({ page }) => {
    const ms = await openEditService(page);
    test.info().annotations.push({ type: 'open-time', description: `${ms}ms` });
    expect(ms).toBeLessThan(MAX_OPEN_MS);
  });

  test('C45173 / C45175 - Create Service: Select Containers modal searches and selects a container', async ({ page }) => {
    await openCreateService(page);
    const modal = await openSelectContainers(page);
    const rows = modal.getByRole('row').filter({ has: modal.locator('input[type="checkbox"]') });
    await rows.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    test.skip(await rows.count() === 0, 'No containers on this vendor');
    const name = (await rows.first().innerText()).split('\n')[0].trim();
    await modal.getByPlaceholder(/Search/i).fill(name);
    await expect(rows.first()).toContainText(name, { timeout: 10000 });
    await rows.first().locator('input[type="checkbox"]').check({ force: true });
    await expect(rows.first().locator('input[type="checkbox"]')).toBeChecked();
    await modal.getByRole('button', { name: /Cancel|Close/ }).first().click();
  });

  test('C45174 - Edit Service: Select Containers modal opens', async ({ page }) => {
    await openEditService(page);
    const modal = await openSelectContainers(page);
    await expect(modal.getByPlaceholder(/Search/i)).toBeVisible();
    await modal.getByRole('button', { name: /Cancel|Close/ }).first().click();
  });
});
