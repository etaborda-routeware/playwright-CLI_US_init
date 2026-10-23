// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). The
// ESRI sync modal's location (assumed: an ESRI feature on Application
// Settings) and labels are guesses from the case titles.
// RVP-3613 ESRI sync validation buttons. Nothing is saved: invalid values
// are typed in, validated, and the modal is cancelled.
// Manual only (need real ESRI credentials / an ESRI job): C45112, C45113,
// C45116-C45119, C45121, and all of RVP-3512 (C45091-C45100).
import { test, expect } from '@playwright/test';
import { closeModal, openFeatureModal } from './acceptance-helpers';

const openEsriModal = (page) => openFeatureModal(page, /^ESRI/i);

test.describe('ESRI sync (RVP-3613)', () => {
  test('C45111 / C45115 - modal has Validate Credentials and Validate Feature Service Layer', async ({ page }) => {
    const modal = await openEsriModal(page);
    await expect(modal.getByRole('button', { name: 'Validate Credentials' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Validate Feature Service Layer' })).toBeVisible();
    await closeModal(modal);
  });

  test('C45114 - invalid credentials show "Credentials are invalid"', async ({ page }) => {
    const modal = await openEsriModal(page);
    await modal.getByLabel(/User ?name|Login/i).first().fill(`pw-invalid-${Date.now()}`);
    await modal.getByLabel(/Password/i).first().fill('not-a-real-password');
    await modal.getByRole('button', { name: 'Validate Credentials' }).click();
    await expect(page.getByText('Credentials are invalid', { exact: false })).toBeVisible({ timeout: 30000 });
    await closeModal(modal);
  });

  test('C45120 - Data Export lists the ESRI Ops report', async ({ page }) => {
    // Insights -> Data Export (per the export's Data Export cases).
    await page.goto('/dashboard/all-ops');
    await page.getByRole('link', { name: 'Insights', exact: true }).click();
    await page.getByRole('link', { name: /Data Export/i }).click();
    await expect(page.getByText(/ESRI Ops/i).first()).toBeVisible({ timeout: 15000 });
  });
});
