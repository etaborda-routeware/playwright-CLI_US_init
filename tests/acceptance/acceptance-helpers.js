// @ts-check
// Shared by the tests/acceptance specs. Not a spec itself (no .spec.js
// suffix), so Playwright doesn't collect it.
import { expect } from '@playwright/test';

// A promo dialog can appear on load and sit on top of the page (same
// pattern as create-daily-route.spec.js) - close it if present.
export async function dismissPromo(page) {
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.count() > 0) await close.first().click();
}

// Google Maps container (tiles are a canvas - only check it rendered).
export function mapContainer(page) {
  return page.locator('.gm-style, .mapboxgl-map').first();
}

// Rubicon Pro hauler pages (Rubicon Services, Work Orders, Opportunities,
// RubiconSelect) may not exist on a SmartCity tenant at all. Open one by
// its nav link from the dashboard, and skip - not fail - when the link
// isn't there, so the report says why.
export async function openNavPage(page, test, name) {
  await page.goto('/dashboard/all-ops');
  await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });
  await dismissPromo(page);
  // Let the nav render before deciding the link is missing.
  await page.getByRole('link', { name: 'Fleet' }).waitFor({ state: 'visible', timeout: 15000 });
  const link = page.getByRole('link', { name }).or(page.getByRole('tab', { name })).first();
  test.skip(await link.count() === 0, `No "${name}" link on this tenant/role - Rubicon Pro page`);
  await link.click();
  await dismissPromo(page);
}

export async function openAppSettings(page) {
  await page.goto('/account-settings');
  await page.waitForURL('**/account-settings', { timeout: 15000 });
  // The case text says "Rubicon Admin Features"; this tenant's heading is
  // "Routeware Admin Features" (see verify-app-settings-page.spec.js).
  await expect(page.getByRole('heading', { name: 'Routeware Admin Features', exact: true })).toBeVisible({ timeout: 15000 });
}

// A feature row on Application Settings: the nearest ancestor of its label
// that holds a button (the pencil icon), same as the City Flag spec.
export function featureRow(page, label) {
  return page.getByText(label, { exact: true }).first().locator('xpath=ancestor::*[.//button][1]');
}

// Feature edit modals on Application Settings aren't ARIA dialogs: each is
// an unnamed portal <div> appended to <body> (outside #root) whose child
// holds an X icon button followed by an <h2> title - and a modal can open
// another on top (Alternative Fleet -> Snow Plow). Every open one, in
// stacking order; .last() is the topmost.
export function featureModals(page) {
  return page.locator('body > div:not(#root) > div').filter({ has: page.getByRole('heading', { level: 2 }), visible: true });
}

// Opens a feature's edit modal from Application Settings. The modal's
// title isn't always the feature's label (App Experience opens "General
// Features"), so it's identified by position, not heading text.
export async function openFeatureModal(page, label) {
  await openAppSettings(page);
  const row = featureRow(page, label);
  await expect(row, `${label} row on Application Settings`).toBeVisible({ timeout: 15000 });
  await row.getByRole('button').first().click();
  const modal = featureModals(page).last();
  await expect(modal).toBeVisible({ timeout: 10000 });
  return modal;
}

// Opens the modal of a row inside an already-open modal (e.g. Snow Plow
// inside Alternative Fleet), which stacks on top of it.
export async function openNestedModal(modal, label) {
  const page = modal.page();
  const before = await featureModals(page).count();
  await modal.getByText(label, { exact: true }).first().locator('xpath=ancestor::*[.//button][1]').getByRole('button').first().click();
  await expect(featureModals(page)).toHaveCount(before + 1, { timeout: 10000 });
  return featureModals(page).last();
}

// Closes the topmost modal with its X (Escape doesn't close these). The
// .last() locator re-resolves to whatever is underneath once it's gone, so
// check the count dropped rather than that `modal` is hidden.
export async function closeModal(modal) {
  const page = modal.page();
  const before = await featureModals(page).count();
  await modal.getByRole('button').first().click();
  await expect(featureModals(page)).toHaveCount(before - 1, { timeout: 10000 });
}

// Option labels of a dropdown - react-select (the suite's usual dropdown)
// or a native <select>.
export async function dropdownOptions(page, trigger) {
  if (await trigger.evaluate((el) => el.tagName === 'SELECT')) {
    return (await trigger.locator('option').allInnerTexts()).map((t) => t.trim());
  }
  await trigger.click({ force: true });
  const options = page.locator('[id^="react-select-"][id*="-option-"]');
  await options.first().waitFor({ state: 'visible', timeout: 10000 });
  const labels = (await options.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  return labels;
}

// The dropdowns inside a container: native selects and react-select
// controls.
export function dropdownsIn(container) {
  return container.locator('select, [class*="select__control" i]');
}
