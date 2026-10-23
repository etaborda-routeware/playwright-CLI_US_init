// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Labels
// are taken from the case titles and need a live check.
// RVP-2660 RubiconSelect banner and page (the partner tiles themselves are
// in tests/regression/rubiconselect-partner-tiles.spec.js). RubiconSelect
// may not exist on a SmartCity tenant - with no banner every test skips.
import { test, expect } from '@playwright/test';

// "Pro pages" per the case - the main portal sections.
const PAGES = ['/dashboard/all-ops', '/customers/customers', '/fleet/vehicles', '/routes/route-tracker'];

function banner(page) {
  return page.locator('[class*="banner" i], [role="banner"], [role="region"]').filter({ hasText: /Rubicon ?Select/i }).first();
}

async function gotoWithBanner(page, path = PAGES[0]) {
  await page.goto(path);
  await page.getByRole('link', { name: 'Fleet' }).waitFor({ state: 'visible', timeout: 15000 });
  test.skip(await banner(page).count() === 0, 'No RubiconSelect banner on this tenant');
  await expect(banner(page)).toBeVisible();
}

async function openSelectPage(page) {
  await gotoWithBanner(page);
  await banner(page).getByRole('link', { name: /Learn More/i }).or(banner(page).getByRole('button', { name: /Learn More/i })).first().click();
  await expect(page.getByRole('heading', { name: /Rubicon ?Select/i }).first()).toBeVisible({ timeout: 15000 });
}

test.describe('RubiconSelect banner (RVP-2660)', () => {
  test('C45514 - banner shows on every main page', async ({ page }) => {
    await gotoWithBanner(page);
    for (const path of PAGES.slice(1)) {
      await page.goto(path);
      await expect(banner(page), path).toBeVisible({ timeout: 15000 });
    }
  });

  test('C45515 / C45516 / C45519 - Learn More opens the RubiconSelect page in the same tab, with the main nav', async ({ page, context }) => {
    const pagesBefore = context.pages().length;
    await openSelectPage(page);
    expect(context.pages().length, 'same tab').toBe(pagesBefore);
    await expect(page.getByRole('link', { name: 'Fleet' })).toBeVisible();
  });

  test('C45518 - back arrow returns to the original page', async ({ page }) => {
    await openSelectPage(page);
    await page.getByRole('button', { name: /Back/i }).or(page.getByRole('link', { name: /Back/i })).or(page.locator('[class*="back" i]')).first().click();
    await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });
  });

  test('C45517 / C45520 - banner can be closed and comes back after a day', async ({ page }) => {
    await page.clock.install();
    await gotoWithBanner(page);
    await banner(page).getByRole('button', { name: /Close|Dismiss|×/i }).or(banner(page).locator('[class*="close" i]')).first().click();
    await expect(banner(page)).toBeHidden({ timeout: 5000 });

    // Still hidden later the same day, back once a day has passed.
    await page.clock.fastForward('20:00:00');
    await page.reload();
    await page.getByRole('link', { name: 'Fleet' }).waitFor({ state: 'visible', timeout: 15000 });
    await expect(banner(page)).toBeHidden();
    await page.clock.fastForward('04:01:00');
    await page.reload();
    await expect(banner(page)).toBeVisible({ timeout: 15000 });
  });

  test('C45521 / C45523 - partner tiles three per row, each with image and text', async ({ page }) => {
    await openSelectPage(page);
    const tiles = page.locator('*:has(> img)').filter({ has: page.getByRole('link', { name: /Learn More/i }) });
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
    const tops = await tiles.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    const perRow = new Map();
    tops.forEach((t) => perRow.set(t, (perRow.get(t) || 0) + 1));
    for (const n of [...perRow.values()].slice(0, -1)) expect(n, 'full rows hold 3 tiles').toBe(3);
    for (let i = 0; i < count; i++) await expect(tiles.nth(i).locator('img')).toBeVisible();
  });

  test('C45522 / C45524 - partner Learn More opens in a new tab', async ({ page, context }) => {
    await openSelectPage(page);
    const link = page.locator('main, body').getByRole('link', { name: /Learn More/i }).first();
    expect(await link.getAttribute('target')).toBe('_blank');
    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await popup.waitForLoadState('domcontentloaded');
    expect(popup.url()).not.toContain('smartcity.routeware.com');
    await popup.close();
  });
});
