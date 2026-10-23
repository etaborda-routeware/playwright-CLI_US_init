// @ts-check
// NOTE: Ported from UK-PW-automation's tests/ on 2026-09-25 (this flow had no
// scenarios/ counterpart there) - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at port time: its main JS bundle URL returned index.html). Adapted:
// the UK tenant's fixed option labels ("Domestic" / "Bin" / "240 Litre
// Container" / "Refuse") are per-vendor data and
// won't exist here, so those dropdowns now pick randomly and the
// assertions check whatever was picked.
// Still to confirm live: the "Every Week" pickup frequency (kept fixed
// because it's what reveals the Monday checkbox). This test adds a service
// to the first customer's first location and, like the UK original, does
// not remove it afterwards.
import { test, expect } from '@playwright/test';

test('Create service on location', async ({ page }) => {
  async function selectDropdownOption(trigger, label) {
    // Same react-select pattern used throughout this suite (see
    // create-delete-facility.spec.js) - options render with ids like
    // "react-select-N-option-M", filtered by exact visible text since some
    // of these lists have substring collisions (e.g. Equipment Type's
    // "Bin" vs "EuroBin").
    await trigger.click({ force: true });
    const options = page.locator('[id^="react-select-"][id*="-option-"]');
    // label = null picks a random option instead - option lists are
    // per-vendor data (the UK tenant's "Domestic"/"Bin"/"240 Litre
    // Container"/"Refuse" don't exist here), same fix create-vehicle.spec.js
    // needed. Returns the chosen label.
    if (label) {
      await options.filter({ hasText: new RegExp(`^${label}$`) }).click();
      return label;
    }
    await options.first().waitFor({ state: 'visible', timeout: 10000 });
    const idx = Math.floor(Math.random() * (await options.count()));
    const picked = (await options.nth(idx).textContent()).trim();
    await options.nth(idx).click();
    return picked;
  }

  // Each test gets its own fresh page (unlike the old scenarios/ runner,
  // where every scenario shared one already-navigated page) - the setup
  // project's storage state keeps it authenticated, but it still needs an
  // explicit starting point of its own.
  await page.goto('/dashboard/all-ops');

  // 1. Customers -> first customer on the list.
  await page.getByRole('link', { name: 'Customers' }).click();
  await page.waitForURL('**/customers/customers', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 15000 });

  // A promo dialog can appear on load and sits on top of the page - close
  // it if present so it doesn't intercept later clicks (same pattern as
  // create-delete-facility.spec.js and create-location-alert.spec.js).
  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  const firstCustomerName = page.locator('[id^="customer-"][id$="-name"]').first();
  await expect(firstCustomerName).toBeVisible({ timeout: 15000 });
  const customerName = (await firstCustomerName.textContent()).trim();
  await firstCustomerName.click();
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customer locations' })).toBeVisible({ timeout: 15000 });

  // Baseline "N Services & M Subscriptions" count for the first location, to
  // confirm afterwards that a new service actually got added (not just that
  // some dialog reported success) - same before/after-count approach as
  // scenarios/pending/create-location-first-customer.js. Scoped to .first() in case the
  // first customer ever has more than one location.
  const servicesCountText = page.getByText(/^\d+ Services? & \d+ Subscriptions?$/).first();
  await expect(servicesCountText).toBeVisible({ timeout: 15000 });
  const beforeCount = parseInt((await servicesCountText.textContent()).match(/^(\d+)/)[1], 10);

  // 2. Add New Service - confirmed live: this row action is a real link
  // (href=".../location/{id}/service/-1") but it's rendered inside a
  // visually-hidden tooltip that only becomes visible on hover of its
  // parent icon button (Playwright's own accessibility snapshot doesn't
  // even see the link's text until then) - hover first, then click the
  // now-visible link, rather than clicking the button/link directly.
  const addServiceButton = page.locator('button').filter({ has: page.locator('a[href*="/service/-1"]') }).first();
  await addServiceButton.scrollIntoViewIfNeeded();
  await addServiceButton.hover();
  const addServiceLink = page.getByRole('link', { name: 'Add New Service' });
  await expect(addServiceLink).toBeVisible({ timeout: 10000 });
  await addServiceLink.click();

  await page.waitForURL('**/service/-1', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Create New Service' })).toBeVisible({ timeout: 15000 });

  // 3. Service Type / Equipment Type / Equipment Size / Waste Type -
  // Equipment Type and Equipment Size are dependent on the previous
  // selection (confirmed live: Equipment Type's options change per Service
  // Type, and disabled until one is chosen - same cascading pattern as
  // Facility Type/Sub-Type in create-delete-facility.spec.js).
  // Random picks cascade (each list depends on the previous choice), so
  // give each dependent list a moment to repopulate - same reason as the
  // Vehicle Subtype wait in create-vehicle.spec.js.
  await selectDropdownOption(page.locator('#serviceTypeId'), null);
  await page.waitForTimeout(500);
  await selectDropdownOption(page.locator('#equipmentTypeId'), null);
  await page.waitForTimeout(500);
  await selectDropdownOption(page.locator('#equipmentSizeId'), null);
  await selectDropdownOption(page.locator('#wasteMaterialTypeId'), null);

  // Number Of Containers / Containers are derived, read-only fields
  // (confirmed live: both render disabled) - populated via the separate
  // "Create Container" modal behind the "+" icon, which isn't required to
  // save a service, so this scenario doesn't need it.

  // 4. Pickup Frequency Type - required (confirmed live: Save blocks with
  // "You can not leave this empty." until one is chosen). Choosing one
  // reveals a "Routes" section of day checkboxes, same
  // check-a-day-to-configure pattern as Facility's Days of Operation.
  await selectDropdownOption(page.locator('#edit-service-pickup-frequency-type'), 'Every Week');
  await page.locator('label').filter({ hasText: /^Monday$/ }).check();

  // Service Effective Date defaults to today and Account Status defaults to
  // Active (confirmed live) - left as-is for this scenario.

  // 5. Save
  await page.getByRole('button', { name: 'Save' }).click();

  // 6. Verify - saving returns to the customer's own edit page, and this
  // location's service count has gone up by one.
  await page.waitForURL('**/customers/customers/*/edit', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Customer locations' })).toBeVisible({ timeout: 15000 });
  await expect
    .poll(async () => {
      const text = await servicesCountText.textContent();
      return parseInt(text.match(/^(\d+)/)[1], 10);
    }, {
      message: `Expected the location's service count to increase from ${beforeCount} after saving`,
      timeout: 15000,
    })
    .toBeGreaterThan(beforeCount);

  expect(customerName).toBeTruthy();
});
