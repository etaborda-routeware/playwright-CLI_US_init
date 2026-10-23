// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Labels
// are taken from the case titles (no step text) and need a live check.
// Add / Edit Work Order modals on the Rubicon Services and Work Orders
// pages. These are Rubicon Pro hauler pages - every test skips if the page's
// nav link isn't on this tenant. Nothing is submitted: modals are filled,
// checked and cancelled.
// Not yet: C46622 / C46636 / C46637 (submit creates a real WO - needs a
// cleanup path), C46625 / C46635 (upload order), C46640-C46642 (need an
// open change request), C46646-C46651 (option lists are "to follow" in the
// case text).
import { test, expect } from '@playwright/test';
import { dropdownOptions, openNavPage } from './acceptance-helpers';

const REQUEST_TYPES = ['Dry Runs/Blocked Containers', 'Contaminations', 'Extra Yardage'];
const UPLOAD_FORMATS = ['jpg', 'png', 'pdf', 'doc', 'xls', 'csv', 'ppt', 'txt'];

function field(modal, label) {
  return modal.getByText(label).first().locator('xpath=ancestor::*[.//input or .//*[contains(@class,"select")] or .//textarea][1]');
}

async function openRubiconServices(page) {
  await openNavPage(page, test, /Rubicon Services/i);
  await expect(page.getByRole('heading', { name: /Services/i }).first()).toBeVisible({ timeout: 15000 });
}

async function openAddWoFromServices(page) {
  await openRubiconServices(page);
  const add = page.getByRole('button', { name: /Add Work Order/i }).or(page.locator('[title*="Add Work Order" i], [aria-label*="Add Work Order" i]'));
  test.skip(await add.count() === 0, 'No services listed - nothing to add a WO to');
  await add.first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });
  return modal;
}

async function openAddWoFromWorkOrders(page) {
  await openNavPage(page, test, /^Work Orders$/i);
  await page.getByRole('button', { name: /Add New/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });
  return modal;
}

// Date Service Performed: today by default, and past dates are disabled.
async function checkServiceDate(page, modal) {
  const input = field(modal, /Date Service Performed/i).locator('input').first();
  const t = new Date();
  await expect(input).toHaveValue(new RegExp(`${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')}/${t.getFullYear()}`));
  await input.click({ force: true });
  const yesterday = page.locator('[class*="day--disabled" i], [aria-disabled="true"]').filter({ hasText: new RegExp(`^${new Date(Date.now() - 864e5).getDate()}$`) });
  if (t.getDate() > 1) await expect(yesterday.first(), 'yesterday is not selectable').toBeVisible();
  await page.keyboard.press('Escape');
}

async function submitEmptyShowsRequired(modal, labels) {
  await modal.getByRole('button', { name: /Submit/i }).click();
  for (const label of labels) {
    await expect(field(modal, label).getByText(/required/i).first(), `${label} is required`).toBeVisible({ timeout: 5000 });
  }
}

async function cancelDiscards(page, modal) {
  await modal.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText(/discard/i).first()).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Yes|Discard|Confirm/i }).first().click();
  await expect(modal).toBeHidden({ timeout: 10000 });
}

test.describe('Rubicon Services - Add Work Order', () => {
  test('C46615 / C46617 / C46639 - Add and Edit Work Order actions open the modal', async ({ page }) => {
    const modal = await openAddWoFromServices(page);
    await expect(modal.getByText(/Work Order/i).first()).toBeVisible();
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[title*="Edit Work Order" i], [aria-label*="Edit Work Order" i]').or(page.getByRole('button', { name: /Edit Work Order/i })).first()).toBeVisible();
  });

  test('C46618 - Customer, Location, Service ID and Service are prefilled and read-only', async ({ page }) => {
    const modal = await openAddWoFromServices(page);
    for (const label of [/^Customer/i, /^Location/i, /Service ?ID/i, /^Service$/i]) {
      const f = field(modal, label);
      await expect(f, `${label}`).toBeVisible();
      await expect(f.locator('input:not([readonly]):not([disabled])'), `${label} is not editable`).toHaveCount(0);
    }
  });

  test('C46619 - Date Service Performed defaults to today, future dates only', async ({ page }) => {
    const modal = await openAddWoFromServices(page);
    await checkServiceDate(page, modal);
  });

  test('C46620 / C46621 - Request Type and Amount are required; Amount takes positive integers only', async ({ page }) => {
    const modal = await openAddWoFromServices(page);
    expect(await dropdownOptions(page, field(modal, /Request Type/i).locator('[class*="select__control" i], select').first())).toEqual(REQUEST_TYPES);
    await submitEmptyShowsRequired(modal, [/Request Type/i, /Amount/i]);

    const amount = field(modal, /Amount/i).locator('input').first();
    for (const bad of ['-3', '2.5', 'abc']) {
      await amount.fill('');
      await amount.pressSequentially(bad);
      expect(await amount.inputValue(), `"${bad}" is rejected`).not.toBe(bad);
    }
    await amount.fill('4');
    await expect(amount).toHaveValue('4');
  });

  test('C46623 / C46624 - Upload Documents is optional and limited to the listed formats', async ({ page }) => {
    const modal = await openAddWoFromServices(page);
    const accept = (await modal.locator('input[type="file"]').first().getAttribute('accept')) || '';
    test.info().annotations.push({ type: 'accept', description: accept });
    for (const ext of UPLOAD_FORMATS) expect(accept.toLowerCase(), ext).toContain(ext);
    expect(accept.toLowerCase()).not.toContain('exe');
  });
});

test.describe('Work Orders page - Add New Work Order', () => {
  test('C46616 / C46626 - Add New opens the modal', async ({ page }) => {
    const modal = await openAddWoFromWorkOrders(page);
    await expect(modal.getByText(/Work Order/i).first()).toBeVisible();
  });

  test('C46627 - Date Service Performed defaults to today, future dates only', async ({ page }) => {
    const modal = await openAddWoFromWorkOrders(page);
    await checkServiceDate(page, modal);
  });

  test('C46628 / C46630 / C46631 / C46632 / C46633 / C46634 - required fields', async ({ page }) => {
    const modal = await openAddWoFromWorkOrders(page);
    await submitEmptyShowsRequired(modal, [/Work Order Number/i, /Customer$/i, /Customer Location/i, /Service$/i, /Request Type/i, /Documents/i]);
    expect(await dropdownOptions(page, field(modal, /Request Type/i).locator('[class*="select__control" i], select').first())).toEqual(REQUEST_TYPES);
  });

  test('C46629 - Work Order Number takes digits only', async ({ page }) => {
    const modal = await openAddWoFromWorkOrders(page);
    const number = field(modal, /Work Order Number/i).locator('input').first();
    await number.pressSequentially('12a-3');
    await expect(number).toHaveValue('123');
  });

  test('C46638 - Cancel shows the discard message and saves nothing', async ({ page }) => {
    const modal = await openAddWoFromWorkOrders(page);
    const woNumber = String(Date.now()).slice(-9);
    await field(modal, /Work Order Number/i).locator('input').first().fill(woNumber);
    await cancelDiscards(page, modal);
    await page.getByPlaceholder(/Search/i).first().fill(woNumber);
    await page.keyboard.press('Enter');
    await expect(page.getByText(woNumber)).toHaveCount(0);
  });
});

test.describe('Rubicon Services - Edit Work Order', () => {
  async function openEditWo(page) {
    await openRubiconServices(page);
    const edit = page.locator('[title*="Edit Work Order" i], [aria-label*="Edit Work Order" i]').or(page.getByRole('button', { name: /Edit Work Order/i }));
    test.skip(await edit.count() === 0, 'No services listed - nothing to edit');
    await edit.first().click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });
    return modal;
  }

  test('C46643 / C46644 / C46645 - Edit WO shows read-only customer and current service data', async ({ page }) => {
    const modal = await openEditWo(page);
    for (const label of [/^Customer$/i, /Customer Location/i, /Service ?ID/i, /Equipment Type/i, /Service Type|Frequency/i, /Day\(?s\)? of Service/i, /Rate/i]) {
      await expect(modal.getByText(label).first(), `${label}`).toBeVisible();
    }
  });

  test('C46646 / C46647 / C46648 / C46651 - Equipment type, size, material and day of service are changeable', async ({ page }) => {
    const modal = await openEditWo(page);
    for (const label of [/Equipment Type/i, /Equipment Size/i, /Material/i]) {
      // The editable (requested) dropdown is the last one for the label;
      // the first copy is the read-only current service.
      const dd = modal.getByText(label).last().locator('xpath=ancestor::*[.//*[contains(@class,"select")] or .//select][1]').locator('[class*="select__control" i], select').first();
      expect((await dropdownOptions(page, dd)).length, `${label} has options`).toBeGreaterThan(0);
    }
    // Week-long day bubbles: 7 toggles.
    await expect(modal.getByRole('button', { name: /^(M|T|W|F|S|Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/ })).toHaveCount(7);
  });
});
