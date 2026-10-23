// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Labels
// are taken from the case titles (no step text) and need a live check.
// RVP-4185 Route Builder and Route Sequencing settings modals. Nothing is
// saved: break times are typed in, checked, and the modal is cancelled.
// Not yet: C45010 (Route Start Time not linked to Company Information -
// needs Company Information changed and restored), C45013 / C45014
// (per-vehicle-type units - the requirement's unit table isn't in the
// export).
import { test, expect } from '@playwright/test';
import { closeModal, openFeatureModal } from './acceptance-helpers';

const BREAKS = ['AM Break', 'Lunch', 'PM Break'];

// The H / M / S inputs on the row holding a label.
function timeInputs(modal, label) {
  return modal.getByText(label, { exact: true }).first().locator('xpath=ancestor::*[count(.//input)>=3][1]').locator('input');
}

async function setBreak(modal, label, h, m, s) {
  const inputs = timeInputs(modal, label);
  await inputs.nth(0).fill(String(h));
  await inputs.nth(1).fill(String(m));
  await inputs.nth(2).fill(String(s));
}

async function totalBreakSeconds(modal) {
  const values = await timeInputs(modal, 'Total Break Time').evaluateAll((els) => els.slice(0, 3).map((e) => Number(/** @type {HTMLInputElement} */ (e).value || 0)));
  const text = await modal.getByText('Total Break Time', { exact: true }).first().locator('xpath=ancestor::*[1]').innerText();
  // Either three inputs, or a read-only HH:MM:SS text.
  const m = text.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return values[0] * 3600 + values[1] * 60 + values[2];
}

for (const { feature, ids } of [
  {
    feature: 'Route Builder',
    ids: { open: 'C45006 / C45007 / C45009', breaks: 'C45019 / C45016', defaults: 'C45020', total: 'C45022 / C45015', readOnly: 'C45023' },
  },
  {
    feature: 'Route Sequencing',
    ids: { open: 'C45006 / C45007', breaks: 'C45011 / C45021', defaults: 'C45012', total: 'C45017 / C45015', readOnly: 'C45018' },
  },
]) {
  test.describe(`${feature} settings (RVP-4185)`, () => {
    const open = (page) => openFeatureModal(page, new RegExp(`^${feature}$`));

    test(`${ids.open} - ${feature} modal opens`, async ({ page }) => {
      const modal = await open(page);
      await expect(modal.getByText(feature).first()).toBeVisible();
      await closeModal(modal);
    });

    test(`${ids.breaks} / C45008 - Total Break Time has AM Break, Lunch, PM Break in HH:MM:SS`, async ({ page }) => {
      const modal = await open(page);
      await expect(modal.getByText('Total Break Time', { exact: true })).toBeVisible();
      for (const label of BREAKS) {
        await expect(modal.getByText(label, { exact: true }).first(), label).toBeVisible();
        // Hour, minute and second each set separately.
        await expect(timeInputs(modal, label), `${label} H/M/S inputs`).toHaveCount(3);
      }
    });

    test(`${ids.defaults} - break times default to 0 (report-only)`, async ({ page }) => {
      const modal = await open(page);
      const values = {};
      for (const label of BREAKS) values[label] = await timeInputs(modal, label).evaluateAll((els) => els.map((e) => /** @type {HTMLInputElement} */ (e).value).join(':'));
      test.info().annotations.push({ type: 'break-times', description: JSON.stringify(values) });
    });

    test(`${ids.total} - Total Break Time adds up the breaks`, async ({ page }) => {
      const modal = await open(page);
      await setBreak(modal, 'AM Break', 0, 15, 0);
      await setBreak(modal, 'Lunch', 0, 30, 0);
      await setBreak(modal, 'PM Break', 0, 10, 30);
      await expect.poll(() => totalBreakSeconds(modal), { timeout: 5000 }).toBe((15 + 30 + 10) * 60 + 30);
      await closeModal(modal);
    });

    test(`${ids.readOnly} - Total Break Time is not editable`, async ({ page }) => {
      const modal = await open(page);
      const inputs = timeInputs(modal, 'Total Break Time');
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const locked = (await input.isDisabled()) || (await input.getAttribute('readonly')) !== null;
        expect(locked, `Total Break Time input ${i + 1} is read-only`).toBe(true);
      }
      await closeModal(modal);
    });
  });
}
