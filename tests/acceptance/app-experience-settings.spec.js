// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Labels
// are taken from the case titles (only C45441 has steps) and need a live
// check.
// RVP-4172 App Experience feature under Route Management.
// Defaults can only be checked on a vendor that never touched these, so
// those tests report what they see until EXPECTED_* is set.
// Manual only: C45447 / C45448 / C45452 / C45453 (line color and width on
// the driver app map), C45455 / C45457 (new vendor at deployment).
import { test, expect } from '@playwright/test';
import { closeModal, openAppSettings, openFeatureModal } from './acceptance-helpers';

const FEATURE = /^App Experience$/;
const EXPECTED_PAST_TRACKING_DEFAULT = null; // C45454: false (Off)
const EXPECTED_FUTURE_TRACKING_DEFAULT = null; // C45456: { on: true, width: 'Thick' }

const GENERAL_FEATURES = [
  'Two Way Messaging',
  'No Route',
  'Weight Tickets',
  'Supervisor Experience',
  /Require Sup(ervisor)? vehicle at login/i,
  'Route Assistance',
  'Turn by Turn Navigation',
  'Sequential Navigation',
];

const openAppExperience = (page) => openFeatureModal(page, FEATURE);

// The toggle on the row holding a label.
function toggleFor(scope, label) {
  return scope.getByText(label).first().locator('xpath=ancestor::*[.//input[@type="checkbox"]][1]').locator('input[type="checkbox"]').first();
}

test.describe('App Experience (RVP-4172)', () => {
  test('C45437 / C45438 - App Experience is listed under Route Management and editable', async ({ page }) => {
    await openAppSettings(page);
    const routeManagement = page.getByRole('heading', { name: /Route Management/i });
    await expect(routeManagement).toBeVisible();
    // Listed after the Route Management heading.
    const appExperience = page.getByText(FEATURE).first();
    await expect(appExperience).toBeVisible();
    expect(await routeManagement.evaluate((h, el) => !!(h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING), await appExperience.elementHandle())).toBe(true);
    const modal = await openAppExperience(page);
    await closeModal(modal);
  });

  test('C45440 / C45441 - General Features holds the moved features', async ({ page }) => {
    const modal = await openAppExperience(page);
    await expect(modal.getByText('General Features', { exact: true })).toBeVisible();
    for (const label of GENERAL_FEATURES) {
      await expect(modal.getByText(label).first(), `${label}`).toBeVisible();
    }
  });

  test('C45442 / C45443 / C45445 / C45446 / C45449 / C45450 / C45451 - Vehicle Tracking past/future configs', async ({ page }) => {
    const modal = await openAppExperience(page);
    await expect(modal.getByText('Vehicle Tracking', { exact: true })).toBeVisible();
    await expect(toggleFor(modal, /past vehicle tracking/i)).toBeAttached();
    await expect(toggleFor(modal, /future vehicle tracking/i)).toBeAttached();
    // Future tracking has a Thin / Thick choice.
    await expect(modal.getByText('Thin', { exact: true })).toBeVisible();
    await expect(modal.getByText('Thick', { exact: true })).toBeVisible();
  });

  test('C45454 / C45456 - Vehicle Tracking defaults (report-only)', async ({ page }) => {
    const modal = await openAppExperience(page);
    const past = await toggleFor(modal, /past vehicle tracking/i).isChecked();
    const future = await toggleFor(modal, /future vehicle tracking/i).isChecked();
    const thick = await modal.getByLabel('Thick', { exact: true }).isChecked().catch(() => null);
    test.info().annotations.push({ type: 'vehicle-tracking', description: `past=${past}, future=${future}, thick=${thick}` });
    if (EXPECTED_PAST_TRACKING_DEFAULT !== null) expect(past).toBe(EXPECTED_PAST_TRACKING_DEFAULT);
    if (EXPECTED_FUTURE_TRACKING_DEFAULT !== null) {
      expect(future).toBe(EXPECTED_FUTURE_TRACKING_DEFAULT.on);
      expect(thick).toBe(EXPECTED_FUTURE_TRACKING_DEFAULT.width === 'Thick');
    }
  });

  test('C45458 - App Experience is on whenever a General feature is on', async ({ page }) => {
    const modal = await openAppExperience(page);
    let anyOn = false;
    for (const label of GENERAL_FEATURES) {
      const t = toggleFor(modal, label);
      if (await t.count() > 0 && await t.isChecked()) anyOn = true;
    }
    await closeModal(modal);
    test.skip(!anyOn, 'No General feature is on for this vendor');
    // The feature row's own toggle on Application Settings.
    const row = page.getByText(FEATURE).first().locator('xpath=ancestor::*[.//button][1]');
    await expect(row.locator('input[type="checkbox"]').first()).toBeChecked();
  });

  test('C45439 / C45444 - Vehicle Tracking can be turned off and back on', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Changes vendor settings - chromium only');
    let modal = await openAppExperience(page);
    const original = await toggleFor(modal, /past vehicle tracking/i).isChecked();
    const save = async (m) => {
      await m.getByRole('button', { name: 'Save' }).click();
      await expect(m).toBeHidden({ timeout: 10000 });
    };
    try {
      await toggleFor(modal, /past vehicle tracking/i).setChecked(!original, { force: true });
      await save(modal);
      modal = await openAppExperience(page);
      expect(await toggleFor(modal, /past vehicle tracking/i).isChecked()).toBe(!original);
      await closeModal(modal);
    } finally {
      modal = await openAppExperience(page);
      if (await toggleFor(modal, /past vehicle tracking/i).isChecked() !== original) {
        await toggleFor(modal, /past vehicle tracking/i).setChecked(original, { force: true });
        await save(modal);
      } else {
        await closeModal(modal);
      }
    }
  });
});
