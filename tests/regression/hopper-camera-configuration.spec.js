// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). The
// "Camera Configuration" labels are taken from the case text and need a
// live check; Create Vehicle's own selectors are the ones
// create-vehicle.spec.js confirmed live on 2026-09-07.
// C43838 Hopper Camera Strobe Images - step 1 only (the Camera
// Configuration section on Create Vehicle). Steps 2-4 (strobe modal on the
// Dashboard / Route Details) need a Z-device vehicle with strobe images on
// a route, and stay manual. Nothing is saved.
import { test, expect } from '@playwright/test';

test('C43838 - Camera Configuration section on Create Vehicle', async ({ page }) => {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Fleet' }).click();
  await page.waitForURL('**/fleet/vehicles');
  await page.getByRole('link', { name: 'Create Vehicle' }).click();
  await page.waitForURL('**/fleet/vehicles/create');

  await expect(page.getByText('Camera Configuration', { exact: true })).toBeVisible({ timeout: 15000 });

  const cameras = ['Forward', 'Hopper', 'Side - Right'].map((name) => ({
    name,
    box: page.locator('label').filter({ hasText: new RegExp(`^${name}$`) }).locator('input[type="checkbox"]'),
  }));

  // Default: none selected, and disabled while Rubicon Z Device ID is empty.
  await expect(page.locator('input[name="rubiconZDeviceId"]')).toHaveValue('');
  for (const { name, box } of cameras) {
    await expect(box, `${name} should start unchecked`).not.toBeChecked();
    await expect(box, `${name} should be disabled with no Rubicon Z Device ID`).toBeDisabled();
  }

  // Entering a Rubicon Z Device ID enables them.
  await page.locator('label').filter({ hasText: /^Vision AI$/ }).check();
  await page.locator('input[name="rubiconZDeviceId"]').fill(`VISION-${Date.now()}`);
  for (const { name, box } of cameras) {
    await expect(box, `${name} should be enabled once a Rubicon Z Device ID is set`).toBeEnabled();
  }
});
