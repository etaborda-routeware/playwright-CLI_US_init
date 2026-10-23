// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Labels
// are taken from the case titles and need a live check.
// RVP-4264 Rubicon Services map view. Rubicon Pro page - skips if the nav
// link isn't on this tenant.
// Manual only (map canvas): C45417 / C45418 container icons and colors,
// C45420 / C45421 stacked containers, C45423 icon pop-up.
import { test, expect } from '@playwright/test';
import { mapContainer, openNavPage } from './acceptance-helpers';

async function openMapView(page) {
  await openNavPage(page, test, /Rubicon Services/i);
  await page.getByRole('button', { name: /Map View/i }).or(page.getByRole('tab', { name: /Map View/i })).or(page.getByText(/^Map View$/i)).first().click();
  await expect(mapContainer(page)).toBeVisible({ timeout: 15000 });
}

function legend(page) {
  return page.locator('[class*="legend" i]').first();
}

test.describe('Rubicon Services - Map View (RVP-4264)', () => {
  test('C45414 / C45415 - toggle between List View and Map View', async ({ page }) => {
    await openMapView(page);
    await page.getByRole('button', { name: /List View/i }).or(page.getByRole('tab', { name: /List View/i })).or(page.getByText(/^List View$/i)).first().click();
    await expect(mapContainer(page)).toBeHidden({ timeout: 10000 });
    await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 15000 });
  });

  test('C45416 - filters stay applied when switching to Map View', async ({ page }) => {
    await openNavPage(page, test, /Rubicon Services/i);
    // The first filter dropdown on the list, set to its first option.
    const filter = page.locator('[class*="select__control" i]').first();
    await filter.click({ force: true });
    const option = page.locator('[id^="react-select-"][id*="-option-"]').first();
    const picked = (await option.innerText()).trim();
    await option.click();
    await page.getByRole('button', { name: /Map View/i }).or(page.getByText(/^Map View$/i)).first().click();
    await expect(mapContainer(page)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[class*="select__control" i]').first()).toContainText(picked);
  });

  test('C45422 - legend is collapsed by default', async ({ page }) => {
    await openMapView(page);
    const l = legend(page);
    await expect(l).toBeVisible();
    const expanded = await l.getAttribute('aria-expanded');
    if (expanded !== null) expect(expanded).toBe('false');
    else await expect(l.getByText(/\(\d+\)|\d+$/)).toHaveCount(0);
  });

  test('C45419 - expanded legend lists container types with counts', async ({ page }) => {
    await openMapView(page);
    await legend(page).click();
    const text = await legend(page).innerText();
    test.info().annotations.push({ type: 'legend', description: text.replace(/\s+/g, ' ') });
    expect(text).toMatch(/[A-Za-z].*\d+/);
  });
});
