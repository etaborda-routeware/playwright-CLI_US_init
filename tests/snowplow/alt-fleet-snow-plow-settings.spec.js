// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-snowplow.xlsx, then live-verified 2026-10-20 against
// hauler.qa.smartcity.routeware.com (vendor "Eliana -QAUSA").
// Application Settings -> Fleet Management -> Alternative Fleet (pencil) is
// a modal listing Snow Plow and Street Sweeping, each with an on/off
// checkbox (name="SnowPlow" / "StreetSweeping") and its own pencil; Snow
// Plow's pencil stacks a second modal on top holding:
//   FEATURES / ACTIVE - read-only status icons (Display Snow Plow Data on
//     Dashboard, Switch Routes Capability, Material Pick Up Ticket, Route
//     Reset - Portal/App Experience, Simple Driver Experience)
//   DISPLAY OPTIONS - Last Serviced Time unit (Hours/Days/Weeks/Months) and
//     Time Frame 1-5, each an enabled checkbox + interval + color
//   SERVICE / NON-SERVICE SUB-TYPES - checkboxes (Plowing, Salting, ...)
//   DRIVER EXPERIENCE - radios name="drivingComplexityType" (1-3)
//   Restore To Defaults / Save
// Read-only tests first; the state-changing ones run on chromium only and
// always restore what they changed.
// Defaults can only be checked on a vendor that has never touched these
// settings, so those tests only report what they see until the EXPECTED_*
// value is set (then a change turns them red).
// Manual only (need the driver app): C45220, C45337-C45339 app side,
// C47098, C51663-C51667, C51901-C51907, C51915, C51916.
import { test, expect } from '@playwright/test';
import { altFleetRow, openAltFleetModal, snowPlowSection } from './snow-helpers';
import { closeModal, featureModals } from '../acceptance/acceptance-helpers';

const EXPECTED_DRIVER_LATEST_ACTIVITY_DEFAULT = null; // C51661: true (ON)
const EXPECTED_PICTURE_DEFAULT = null; // C51900: 'None'

const DRIVER_EXPERIENCE = ['Simple', 'Moderate', 'Complex']; // radio values 1-3

// Opens the dropdown that holds a timeframe/unit and returns its option
// labels. Works for react-select (the suite's usual dropdown) and native
// <select>.
async function dropdownOptions(page, trigger) {
  if (await trigger.evaluate((el) => el.tagName === 'SELECT')) {
    return (await trigger.locator('option').allInnerTexts()).map((t) => t.trim());
  }
  // A force-click on react-select's hidden <input> doesn't always open the
  // menu; focusing it and pressing ArrowDown does.
  if (await trigger.evaluate((el) => el.tagName === 'INPUT')) {
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
  } else {
    await trigger.click({ force: true });
  }
  const options = page.locator('[id^="react-select-"][id*="-option-"]');
  await options.first().waitFor({ state: 'visible', timeout: 10000 });
  const labels = (await options.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  return labels;
}

// Time Frame 1-5 enabled checkboxes, in order.
function categoryToggles(section) {
  return section.locator('input[type="checkbox"][name^="displayConfiguration.segmentColorSettings"]');
}

function driverExperienceRadio(section, index) {
  return section.locator(`input[name="drivingComplexityType"][value="${index + 1}"]`);
}

// The radio inputs are visually hidden behind styled labels - select one by
// clicking its label text.
async function chooseDriverExperience(section, index) {
  await section.getByText(DRIVER_EXPERIENCE[index], { exact: true }).click();
  await expect(driverExperienceRadio(section, index)).toBeChecked();
}

test.describe('Alternative Fleet - Snow Plow settings', () => {
  test('C49014 / C48219 / C45216 / C45323 - Alternative Fleet groups Snow Plow and Street Sweeper', async ({ page }) => {
    const modal = await openAltFleetModal(page);
    await expect(modal.getByText('Snow Plow', { exact: true })).toBeVisible();
    await expect(modal.getByText('Street Sweeping', { exact: true })).toBeVisible();
    await closeModal(modal);

    // Snow Plow is no longer its own feature row on the settings page.
    await expect(altFleetRow(page)).toBeVisible();
    await expect(page.getByText(/^Snow Plow$/)).toHaveCount(0);
  });

  test('C42840 / C66993 / C67101 / C49642 / C48969 / C48174 / C46434 / C43978 - Snow Plow settings are listed', async ({ page }) => {
    const section = await snowPlowSection(await openAltFleetModal(page));
    const settings = [
      /Driver Experience/i, // C44916
      /Last Serviced Time/i, // C45024 / C45218 ("Latest Activity" in TestRail)
      /^Plowing$/, // C45337
      /Switch Routes Capability/i, // C45338
      /Material Pick Up Ticket/i, // C45339
    ];
    // C45336 "Snow Plow Conditions" isn't in the Snow Plow modal on this
    // tenant - nearest is "Display Snow Plow Data on Dashboard". Not asserted
    // until the TestRail case confirms which one it means.
    for (const label of settings) {
      await expect(section.getByText(label).first(), `${label}`).toBeVisible();
    }
  });

  test('C44916 / C44917 - Driver Experience offers Simple, Moderate and Complex', async ({ page }) => {
    const section = await snowPlowSection(await openAltFleetModal(page));
    await expect(section.getByText(/Driver Experience/i).first()).toBeVisible();
    for (const [i, option] of DRIVER_EXPERIENCE.entries()) {
      await expect(section.getByText(option, { exact: true }).first(), option).toBeVisible();
      await expect(driverExperienceRadio(section, i), `${option} radio`).toBeAttached();
    }
  });

  test('C45024 / C45026 / C45027 / C45218 / C45219 - up to 5 Latest Activity categories, each with a color', async ({ page }) => {
    const section = await snowPlowSection(await openAltFleetModal(page));
    const count = await categoryToggles(section).count();
    test.info().annotations.push({ type: 'category-rows', description: String(count) });
    expect(count, 'at most 5 categories').toBeLessThanOrEqual(5);
    expect(count, 'at least 2 categories (lower and max range, C45030)').toBeGreaterThanOrEqual(2);
    await expect(section.locator('input[name="colorPickerColor"]'), 'one color per category').toHaveCount(count);
  });

  test('C45029 - a category must be active before its time window can be edited', async ({ page }) => {
    const section = await snowPlowSection(await openAltFleetModal(page));
    const boxes = categoryToggles(section);
    const total = await boxes.count();
    let inactive = -1;
    for (let i = 0; i < total; i++) {
      if (!(await boxes.nth(i).isChecked())) { inactive = i; break; }
    }
    test.skip(inactive < 0, 'Every Time Frame is active on this vendor - nothing inactive to check');
    const windowInput = section.locator(`[id="displayConfiguration.segmentColorSettings[${inactive}].streetSegmentAgingInterval.id"]`);
    await expect(windowInput).toBeDisabled();
  });

  test('C45031 / C45032 / C45327 - default category time windows (report-only)', async ({ page }) => {
    const section = await snowPlowSection(await openAltFleetModal(page));
    const text = (await section.innerText()).replace(/\s+/g, ' ');
    const windows = text.match(/\d+\s*(?:-\s*\d+|\+)?\s*(?:hours?|hrs?|days?|weeks?|months?)/gi) || [];
    test.info().annotations.push({ type: 'time-windows', description: windows.join(' | ') || '(none found)' });
    expect(windows.length).toBeGreaterThan(0);
  });

  test('C48409 / C48410 / C48413 / C47092 / C47094 / C47095 - timeframe offers Hours, Weeks and Months', async ({ page }) => {
    const section = await snowPlowSection(await openAltFleetModal(page));
    const trigger = section.locator('[id="lastServicedTimeFormatId"]');
    await expect(trigger).toBeAttached();
    const options = await dropdownOptions(page, trigger);
    test.info().annotations.push({ type: 'timeframe-options', description: options.join(' | ') });
    for (const unit of [/Hour/i, /Week/i, /Month/i]) {
      expect(options.some((o) => unit.test(o)), `${unit} option`).toBe(true);
    }
  });

  test('C51661 - drivers can view Latest Activity: default ON for Snow Plow (report-only)', async ({ page }) => {
    const section = await snowPlowSection(await openAltFleetModal(page));
    const label = section.getByText(/Latest Activity/i);
    test.skip(await label.count() === 0, 'No driver "Latest Activity" setting in the Snow Plow modal on this tenant - confirm where C51661 lives');
    const toggle = label.locator('xpath=ancestor::*[.//input[@type="checkbox"]][1]').locator('input[type="checkbox"]').first();
    await expect(toggle).toBeAttached();
    const on = await toggle.isChecked();
    test.info().annotations.push({ type: 'latest-activity-for-drivers', description: `on=${on}, expected default=${EXPECTED_DRIVER_LATEST_ACTIVITY_DEFAULT}` });
    if (EXPECTED_DRIVER_LATEST_ACTIVITY_DEFAULT !== null) expect(on).toBe(EXPECTED_DRIVER_LATEST_ACTIVITY_DEFAULT);
  });

  test('C51899 / C51900 / C51908 - material ticket picture requirement: Optional, Required, None', async ({ page }) => {
    const section = await snowPlowSection(await openAltFleetModal(page));
    const picture = section.getByText(/Picture|Image/i);
    // Material Pick Up Ticket is a read-only status here (off on this
    // vendor); the picture setting may only show once it's on.
    test.skip(await picture.count() === 0, 'No picture-requirement setting in the Snow Plow modal on this vendor (Material Pick Up Ticket is off)');
    const row = picture.first().locator('xpath=ancestor::*[.//select or .//*[contains(@class,"select")] or .//input[@type="radio"]][1]');
    let options;
    let current;
    if (await row.locator('input[type="radio"]').count() > 0) {
      options = (await row.locator('label').allInnerTexts()).map((t) => t.trim());
      current = (await row.locator('label:has(input:checked)').innerText()).trim();
    } else {
      const trigger = row.locator('select, [class*="select__control" i]').first();
      current = (await trigger.innerText()).trim();
      options = await dropdownOptions(page, trigger);
    }
    test.info().annotations.push({ type: 'picture-requirement', description: `options=${options.join('|')}, current=${current}, expected default=${EXPECTED_PICTURE_DEFAULT}` });
    for (const opt of ['Optional', 'Required', 'None']) {
      expect(options.some((o) => o.includes(opt)), opt).toBe(true);
    }
    if (EXPECTED_PICTURE_DEFAULT !== null) expect(current).toContain(EXPECTED_PICTURE_DEFAULT);
  });

  test.describe('state-changing', () => {
    // Saves vendor settings - run once, on chromium only, and always restore.
    test.skip(({ browserName }) => browserName !== 'chromium', 'Changes vendor settings - chromium only');
    test.describe.configure({ mode: 'serial' });

    // Save closes the Snow Plow modal; count-based for the same reason as
    // closeModal() (the .last() locator re-resolves to the modal beneath).
    async function save(section) {
      const page = section.page();
      const before = await featureModals(page).count();
      await section.getByRole('button', { name: 'Save' }).click();
      await expect.poll(() => featureModals(page).count(), { timeout: 10000 }).toBeLessThan(before);
    }

    test('C44918 - Driver Experience change is saved', async ({ page }) => {
      let section = await snowPlowSection(await openAltFleetModal(page));
      let original = null;
      for (let i = 0; i < DRIVER_EXPERIENCE.length; i++) if (await driverExperienceRadio(section, i).isChecked()) original = i;
      test.skip(original === null, 'No Driver Experience option is selected - nothing to restore to');
      const target = (original + 1) % DRIVER_EXPERIENCE.length;

      try {
        await chooseDriverExperience(section, target);
        await save(section);
        section = await snowPlowSection(await openAltFleetModal(page));
        await expect(driverExperienceRadio(section, target)).toBeChecked();
      } finally {
        section = await snowPlowSection(await openAltFleetModal(page));
        if (!(await driverExperienceRadio(section, original).isChecked())) {
          await chooseDriverExperience(section, original);
          await save(section);
        }
      }
    });

    // The Alternative Fleet modal has a Snow Plow checkbox but no Save
    // button, so toggling it may apply immediately and disable Snow Plow for
    // the whole vendor. Needs a manual check of how it saves before this is
    // automated.
    test.fixme('C67102 / C49643 / C48970 / C48175 / C46435 / C43979 - Snow Plow can be disabled and re-enabled', async () => {});
  });
});
