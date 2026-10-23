// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-snowplow.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case text and need a live check.
// Dispatch -> Snow Tracker list and Snow route details. Most tests need at
// least one snow route in the selected date range; with none they skip
// (not fail), and the skip reason shows up in the report.
// Manual only (need a route run on the driver app): C51917, C51919,
// C51920, C51924, C48546 / C47801 (material ticket icon), C48420 (vehicle
// foreground/background icon on the map).
import { test, expect } from '@playwright/test';
import { dismissPromo, mapContainer, openSnowTracker, snowRouteRows } from './snow-helpers';

// The list defaults to today; widen to the last 3 days so there's more
// chance of a route to work with.
async function selectLastThreeDays(page) {
  await page.getByRole('textbox', { name: /date/i }).or(page.locator('input[name*="date" i]')).first().click({ force: true });
  const option = page.getByText(/Last 3 Days/i).first();
  if (await option.count() > 0) await option.click();
  await page.keyboard.press('Escape');
}

async function firstSnowRoute(page) {
  await openSnowTracker(page);
  await selectLastThreeDays(page);
  const rows = snowRouteRows(page);
  await rows.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  const count = await rows.count();
  test.skip(count === 0, 'No snow routes in the last 3 days - needs QA data');
  return rows.first();
}

async function openFirstSnowRoute(page) {
  const row = await firstSnowRoute(page);
  await row.click();
  await expect(mapContainer(page)).toBeVisible({ timeout: 15000 });
}

test.describe('Snow Tracker - list', () => {
  test('C52535 / C67015 - Snow Tracker page loads', async ({ page }) => {
    await openSnowTracker(page);
    await expect(page.getByPlaceholder(/Search/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible();
  });

  test('C42726 / C66851 - date picker offers Today and Last 3 Days, routes sorted by date ascending', async ({ page }) => {
    await openSnowTracker(page);
    await page.getByRole('textbox', { name: /date/i }).or(page.locator('input[name*="date" i]')).first().click({ force: true });
    await expect(page.getByText('Today', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Last 3 Days/i).first()).toBeVisible();
    await page.getByText(/Last 3 Days/i).first().click();
    await page.keyboard.press('Escape');

    // Pull an M/D/YYYY (or MM/DD/YYYY) date out of each row and check order.
    const texts = await snowRouteRows(page).allInnerTexts();
    const dates = texts
      .map((t) => t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/))
      .filter(Boolean)
      .map((m) => new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])).getTime());
    test.skip(dates.length < 2, 'Fewer than 2 dated snow routes in range - nothing to sort');
    expect(dates, 'routes listed by date ascending').toEqual([...dates].sort((a, b) => a - b));
  });

  test('C42727 / C66852 / C52536 - Search filters snow routes by name', async ({ page }) => {
    const row = await firstSnowRoute(page);
    const name = (await row.innerText()).split('\n')[0].trim();
    const term = name.slice(0, Math.min(name.length, 6));

    await page.getByPlaceholder(/Search/i).first().fill(term);
    const searchButton = page.getByRole('button', { name: /^Search$/i });
    if (await searchButton.count() > 0) await searchButton.click();
    else await page.keyboard.press('Enter');

    const rows = snowRouteRows(page);
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    for (const text of await rows.allInnerTexts()) {
      expect(text.toLowerCase(), `row matches "${term}"`).toContain(term.toLowerCase());
    }
  });

  test('C42728 / C66853 / C52537 - Export downloads an Excel file', async ({ page }) => {
    await openSnowTracker(page);
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.getByRole('button', { name: /Export/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/i);
  });

  test('C1057532 - address search sits at the top of the Snow route map', async ({ page }) => {
    await openSnowTracker(page);
    await dismissPromo(page);
    const map = mapContainer(page);
    await expect(map).toBeVisible({ timeout: 15000 });
    const search = page.getByPlaceholder(/address/i).first();
    await expect(search).toBeVisible();
    const mapBox = await map.boundingBox();
    const searchBox = await search.boundingBox();
    expect(mapBox && searchBox, 'map and address search both rendered').toBeTruthy();
    if (mapBox && searchBox) {
      // Within the top quarter of the map area.
      expect(searchBox.y).toBeGreaterThanOrEqual(mapBox.y - searchBox.height);
      expect(searchBox.y).toBeLessThan(mapBox.y + mapBox.height / 4);
    }
  });

  test('C51649 - Add Street Job is available on Snow Tracker', async ({ page }) => {
    await openSnowTracker(page);
    await expect(page.getByRole('button', { name: /Add Street Job/i }).or(page.getByRole('link', { name: /Add Street Job/i })).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Snow Tracker - route details', () => {
  test('C42729 / C66854 / C52538 - opening a snow route shows the map and route details', async ({ page }) => {
    await openFirstSnowRoute(page);
    await expect(page).toHaveURL(/\/\d+$/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('C42730 / C66855 / C52539 - Material Trips "See more details" opens Service, Fleet and Route tabs', async ({ page }) => {
    await openFirstSnowRoute(page);
    await page.getByText(/See (more )?Details/i).first().click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });
    for (const tab of ['Service', 'Fleet', 'Route']) {
      await expect(modal.getByRole('tab', { name: tab, exact: true }).or(modal.getByText(tab, { exact: true })).first(), `${tab} tab`).toBeVisible();
    }
  });

  test('C48521 / C47776 - Copy and Delete are not offered on a snow route', async ({ page }) => {
    await openFirstSnowRoute(page);
    await expect(page.getByRole('button', { name: /^Copy/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Delete/i })).toHaveCount(0);
  });

  test('C49555 - View segments shows the route segments (step 1)', async ({ page }) => {
    await openFirstSnowRoute(page);
    await page.getByRole('button', { name: /View Segments/i }).click();
    // A segments list/grid appears alongside the map.
    await expect(page.getByText(/Segment/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('C51921 / C51923 - Time Management lists Not Servicing time', async ({ page }) => {
    await openFirstSnowRoute(page);
    await expect(page.getByText(/Total Service Time/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Not Servicing/i).first()).toBeVisible();
  });
});
