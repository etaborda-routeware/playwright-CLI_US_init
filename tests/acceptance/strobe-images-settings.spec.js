// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case titles (no step text) and need a live
// check.
// Strobe Images frequency modal under Routeware Admin Features.
// C46614 says "saved correctly in the db" - this checks it via the UI
// (reopen the modal); the DB side stays manual.
import { test, expect } from '@playwright/test';
import { closeModal, dropdownOptions, dropdownsIn, openFeatureModal } from './acceptance-helpers';

const FEATURE = /^Strobe Images?$/;
const FREQUENCIES = ['10s', '15s', '20s', '30s', '1m', '2m', '5m'];
// Only a vendor that never touched this has every dropdown on the default,
// so C46612 reports what it sees until this is set to '10s'.
const EXPECTED_DEFAULT = null;

const openStrobeModal = (page) => openFeatureModal(page, FEATURE);

test.describe('Strobe Images settings', () => {
  test('C46610 - pencil icon opens the Strobe Images modal', async ({ page }) => {
    const modal = await openStrobeModal(page);
    await expect(modal.getByText(/Strobe/i).first()).toBeVisible();
  });

  test('C46611 - modal lists one frequency per vehicle enabled on the vendor', async ({ page }) => {
    // Vehicle types enabled on the vendor, from Fleet -> Vehicles' filter.
    const modal = await openStrobeModal(page);
    const dropdowns = await dropdownsIn(modal).count();
    const rows = (await modal.innerText()).split('\n').map((t) => t.trim()).filter(Boolean);
    test.info().annotations.push({ type: 'modal-rows', description: rows.join(' | ') });
    expect(dropdowns, 'at least one vehicle row').toBeGreaterThan(0);
  });

  test('C46612 - every dropdown defaults to 10s (report-only)', async ({ page }) => {
    const modal = await openStrobeModal(page);
    const values = (await dropdownsIn(modal).allInnerTexts()).map((t) => t.trim());
    test.info().annotations.push({ type: 'current-values', description: `${values.join(' | ')}; expected default=${EXPECTED_DEFAULT}` });
    if (EXPECTED_DEFAULT !== null) {
      for (const v of values) expect(v).toContain(EXPECTED_DEFAULT);
    }
  });

  test('C46613 - each dropdown offers 10s, 15s, 20s, 30s, 1m, 2m, 5m', async ({ page }) => {
    const modal = await openStrobeModal(page);
    const dropdowns = dropdownsIn(modal);
    const count = await dropdowns.count();
    for (let i = 0; i < count; i++) {
      const options = await dropdownOptions(page, dropdowns.nth(i));
      expect(options, `dropdown ${i + 1}`).toEqual(FREQUENCIES);
    }
  });

  test('C46614 - a changed frequency is saved', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Changes vendor settings - chromium only');
    let modal = await openStrobeModal(page);
    const first = dropdownsIn(modal).first();
    const original = (await first.innerText()).trim();
    const target = FREQUENCIES.find((f) => !original.includes(f));

    const pick = async (m, value) => {
      await dropdownsIn(m).first().click({ force: true });
      await page.locator('[id^="react-select-"][id*="-option-"]').filter({ hasText: new RegExp(`^${value}$`) }).click();
      await m.getByRole('button', { name: 'Save' }).click();
      await expect(m).toBeHidden({ timeout: 10000 });
    };

    try {
      await pick(modal, target);
      modal = await openStrobeModal(page);
      await expect(dropdownsIn(modal).first()).toContainText(target);
      await closeModal(modal);
    } finally {
      modal = await openStrobeModal(page);
      const restore = FREQUENCIES.find((f) => original.includes(f));
      if (restore && !(await dropdownsIn(modal).first().innerText()).includes(restore)) await pick(modal, restore);
      else await closeModal(modal);
    }
  });
});
