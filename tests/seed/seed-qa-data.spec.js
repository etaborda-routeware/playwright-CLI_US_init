// @ts-check
// NOTE: Written 2026-09-30 - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). The
// "+ Add Job" modal selectors are best guesses from TestRail case C42739
// ("Jobs - +Add Job is working") and need a live check. The Add New Service
// steps are the ones create-service-on-location.spec.js confirmed live.
//
// Seeds the QA records the tests/regression specs otherwise skip without:
//   - unassigned Delivery/Utility jobs, for Route Builder (C44547)
//   - a service on the first customer, for the Service Contract icon tests
//     (C44842, C44837)
// Only tops up what's missing, so re-running doesn't pile up records.
// Seeded jobs carry a "PW-SEED-" work order number so they're easy to find.
//
// Not seedable from the portal (they need the driver app): Route Assist
// history (RVP-8299), Missing/New Address exceptions (RVP-3727), registered
// devices (RVP-4211).
//
// Runs as its own "seed" project - not part of `npm test`:
//   npx playwright test --project=seed
//   SEED_JOB_COUNT=5 npx playwright test --project=seed
import { test, expect } from '@playwright/test';

const TARGET_JOBS = Number(process.env.SEED_JOB_COUNT || 3);

test.describe.configure({ mode: 'serial' });

async function selectOption(page, trigger, label = null) {
  // Same react-select pattern used across this suite.
  await trigger.click({ force: true });
  const options = page.locator('[id^="react-select-"][id*="-option-"]');
  await options.first().waitFor({ state: 'visible', timeout: 10000 });
  if (label) {
    await options.filter({ hasText: new RegExp(`^${label}$`) }).click();
    return label;
  }
  const picked = (await options.first().textContent()).trim();
  await options.first().click();
  return picked;
}

async function openDeliveryUtilityBoard(page) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Dispatch', exact: true }).click();
  await page.getByRole('link', { name: 'Dispatch Board' }).click();
  await page.getByText('Delivery/Utility', { exact: true }).click();
}

async function countUnassignedJobs(page) {
  // Read the count the same way dispatch-board-route-builder.spec.js does,
  // so "seeded enough" means "enough for that test".
  await page.getByRole('button', { name: 'Route Builder' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  const boxes = dialog.locator('input[type="checkbox"]');
  await boxes.first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
  const count = await boxes.count();
  await dialog.getByRole('button', { name: /Cancel|Close/ }).first().click();
  // With more than one checkbox the first is the header's select-all.
  return count > 1 ? count - 1 : count;
}

test('Seed unassigned Delivery/Utility jobs', async ({ page }) => {
  test.setTimeout(60000 + TARGET_JOBS * 60000);

  await openDeliveryUtilityBoard(page);
  const existing = await countUnassignedJobs(page);
  test.info().annotations.push({ type: 'unassigned-jobs', description: `before=${existing}, target=${TARGET_JOBS}` });

  for (let i = existing; i < TARGET_JOBS; i++) {
    await page.getByRole('button', { name: /Add Job/ }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Vehicle type first - it filters which customers show up (C42739: the
    // customer must have a service for that vehicle type).
    await selectOption(page, modal.locator('[id*="vehicleType" i]').first(), 'Delivery/Utility');

    // Date defaults to today, which C42739 says is allowed - left as-is.

    // Customer/Location is a search box; the first result is fine.
    const customer = modal.locator('[id*="customerLocation" i], [id*="location" i]').first();
    await customer.click({ force: true });
    const results = page.locator('[id^="react-select-"][id*="-option-"]');
    await expect(results.first(), 'No customer has a Delivery/Utility service - add one before seeding jobs').toBeVisible({ timeout: 15000 });
    await results.first().click();

    // No route - that's what keeps the job unassigned.

    await selectOption(page, modal.locator('[id*="pickupType" i]').first());
    await selectOption(page, modal.locator('[id*="material" i]').first());
    await modal.locator('input[name*="workOrder" i]').fill(`PW-SEED-${Date.now()}`);
    await selectOption(page, modal.locator('[id*="reasonCode" i]').first());
    await selectOption(page, modal.locator('[id*="priority" i]').first(), 'Low');

    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal).toBeHidden({ timeout: 15000 });
  }

  const after = await countUnassignedJobs(page);
  expect(after, `Expected at least ${TARGET_JOBS} unassigned Delivery/Utility jobs after seeding`).toBeGreaterThanOrEqual(TARGET_JOBS);
});

test('Seed a service on the first customer', async ({ page }) => {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Customers' }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });

  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  await page.locator('[id^="customer-"][id$="-name"]').first().click();
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customer locations' })).toBeVisible({ timeout: 15000 });

  // Already has one - nothing to do. Same link service-contract-code-icon.spec.js opens.
  const existingService = page.locator('a[href*="/service/"]:not([href$="/service/-1"])');
  if (await existingService.count() > 0) {
    test.info().annotations.push({ type: 'service', description: 'first customer already has a service - skipped' });
    return;
  }

  // Add New Service - steps as confirmed live in create-service-on-location.spec.js.
  const addServiceButton = page.locator('button').filter({ has: page.locator('a[href*="/service/-1"]') }).first();
  await addServiceButton.scrollIntoViewIfNeeded();
  await addServiceButton.hover();
  await page.getByRole('link', { name: 'Add New Service' }).click();
  await page.waitForURL('**/service/-1', { timeout: 15000 });

  await selectOption(page, page.locator('#serviceTypeId'));
  await page.waitForTimeout(500);
  await selectOption(page, page.locator('#equipmentTypeId'));
  await page.waitForTimeout(500);
  await selectOption(page, page.locator('#equipmentSizeId'));
  await selectOption(page, page.locator('#wasteMaterialTypeId'));
  await selectOption(page, page.locator('#edit-service-pickup-frequency-type'), 'Every Week');
  await page.locator('label').filter({ hasText: /^Monday$/ }).check();

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  await expect(existingService.first()).toBeAttached({ timeout: 15000 });
});
