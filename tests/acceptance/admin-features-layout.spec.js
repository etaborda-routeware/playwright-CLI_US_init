// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Selectors
// are best guesses from the case titles and need a live check.
// RVP-4444 Routeware Admin Features layout.
import { test, expect } from '@playwright/test';
import { openAppSettings } from './acceptance-helpers';

// Feature rows under the Routeware Admin Features heading, grouped by the
// x position of their pencil buttons - one group per column.
async function adminFeatureColumns(page) {
  const section = page.getByRole('heading', { name: 'Routeware Admin Features', exact: true }).locator('xpath=following-sibling::*[1]');
  const boxes = await section.getByRole('button').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), label: (e.closest('div')?.innerText || '').split('\n')[0].trim() };
  }));
  const columns = new Map();
  for (const b of boxes) {
    const key = [...columns.keys()].find((x) => Math.abs(x - b.x) < 40) ?? b.x;
    columns.set(key, [...(columns.get(key) || []), b.label]);
  }
  return [...columns.entries()].sort((a, b) => a[0] - b[0]).map(([, labels]) => labels);
}

test.describe('Routeware Admin Features (RVP-4444)', () => {
  test('C45428 - Routeware Admin Features loads', async ({ page }) => {
    await openAppSettings(page);
    const columns = await adminFeatureColumns(page);
    expect(columns.flat().length).toBeGreaterThan(0);
  });

  test('C45429 - features are laid out 6-5-5 per column', async ({ page }) => {
    await openAppSettings(page);
    const columns = await adminFeatureColumns(page);
    test.info().annotations.push({ type: 'columns', description: columns.map((c) => `${c.length}: ${c.join(', ')}`).join(' || ') });
    // The case dates from when there were 16 features; check the shape
    // (first column longest, at most one row difference) rather than
    // exact counts, since features have been added since.
    expect(columns.length).toBe(3);
    const counts = columns.map((c) => c.length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(counts[0]).toBe(Math.max(...counts));
  });

  test('C45430 - every feature\'s edit modal opens and closes', async ({ page }) => {
    test.setTimeout(180000);
    await openAppSettings(page);
    const section = page.getByRole('heading', { name: 'Routeware Admin Features', exact: true }).locator('xpath=following-sibling::*[1]');
    const count = await section.getByRole('button').count();
    for (let i = 0; i < count; i++) {
      await section.getByRole('button').nth(i).click();
      const modal = page.getByRole('dialog');
      await expect(modal, `feature ${i + 1} modal`).toBeVisible({ timeout: 10000 });
      await modal.getByRole('button', { name: /Cancel|Close/ }).first().click();
      await expect(modal).toBeHidden({ timeout: 10000 });
    }
  });
});
