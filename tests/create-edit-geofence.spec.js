// @ts-check
// NOTE: Ported from UK-PW-automation on 2026-09-25 - NOT yet live-verified
// against hauler.qa.smartcity.routeware.com (at port time the QA frontend
// was serving a broken build: its main JS bundle URL returned index.html,
// so the app never rendered). No tenant-specific values in this flow (no
// address, no fixed IDs), so nothing needed changing beyond this note.
// The KNOWN BUG below was observed on the UK tenant (same Hauler app, so
// likely shared) - confirm live whether it reproduces here too; if Save
// succeeds on this tenant, the "edit" half from step 7 onwards is the part
// that has never been exercised anywhere yet and needs a first real run.
import { test, expect } from '@playwright/test';

test('Create edit geofence', async ({ page }) => {
  // KNOWN BUG (confirmed live on UK, 2026-09-10, 20+ isolated test runs): Save on
  // "New Geo-Fence" rejects the drawn polygon with "Define a general
  // geographical geo-fence area before saving" whenever the Geo-Fence Name
  // field has any value - regardless of fill order (name before/after
  // drawing), timing (tested waits up to 10s), or fill method (.fill() vs
  // real keystroke typing via pressSequentially()). Proven with a two-stage
  // save: draw the polygon with Name left blank -> Save fails ONLY on
  // "Geo-Fence Name: You can not leave this empty." (confirming the polygon
  // itself is valid) -> fill Name -> Save again -> the polygon error comes
  // back. So this scenario is expected to fail at step 6 (Save) until the
  // app is fixed - it asserts the actually-intended behavior (a named,
  // drawn geo-fence saves successfully) rather than being softened to
  // avoid Name entirely, which would silently hide a real product bug.
  // Everything after that point (steps 7+, the "edit" half of this
  // scenario) is written to the same standard as the rest of this suite
  // but is UNVERIFIED beyond this bug - there's no way to reach a real
  // saved geo-fence to edit until Save actually works.

  async function drawSquarePolygon() {
    // The map canvas needs real time to finish rendering before clicks
    // register (confirmed live: canvas height reads 0 via
    // getBoundingClientRect() for a beat after the Type selection, even
    // though the element already exists in the DOM).
    await page.waitForFunction(() => {
      const el = document.querySelector('.mapboxgl-canvas');
      return el && el.getBoundingClientRect().height > 0;
    }, { timeout: 15000 });
    await page.waitForTimeout(2000);

    const rect = await page.evaluate(() => {
      const el = document.querySelector('.mapboxgl-canvas');
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const points = [
      [cx - 80, cy - 80],
      [cx + 80, cy - 80],
      [cx + 80, cy + 80],
      [cx - 80, cy + 80],
    ];
    for (const [x, y] of points) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(400);
    }
    // Double-click the last vertex to close/complete the polygon - this
    // custom map tool doesn't expose a dedicated "draw" button (its only
    // tool button is for editing an *existing* polygon's shape/position,
    // confirmed live via its own instructions text: "Click on an existing
    // polygon to start editing it..."); plain clicks directly on the map
    // are what place new vertices.
    await page.mouse.dblclick(points[points.length - 1][0], points[points.length - 1][1]);
    await page.waitForTimeout(800);
  }

  const name = `Geofence-Test-${Date.now()}`;

  // Each test gets its own fresh page (unlike the old scenarios/ runner,
  // where every scenario shared one already-navigated page) - the setup
  // project's storage state keeps it authenticated, but it still needs an
  // explicit starting point of its own.
  await page.goto('/dashboard/all-ops');

  // 1. Fleet -> Geo-fences
  await page.getByRole('link', { name: 'Fleet' }).click();
  await page.waitForURL('**/fleet/vehicles');
  await page.getByRole('link', { name: 'Geo-fences' }).click();
  await page.waitForURL('**/fleet/geo-fences');
  await expect(page.getByRole('heading', { name: 'Geo-fences' })).toBeVisible({ timeout: 15000 });

  // A promo dialog can appear on load and sits on top of the page - close
  // it if present so it doesn't intercept later clicks (same as Facilities).
  const closeDialogButton = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialogButton.count() > 0) {
    await closeDialogButton.click();
  }

  // 2. Add Geo-Fence
  await page.getByRole('link', { name: 'Add Geo-Fence' }).click();
  await page.waitForURL('**/fleet/geo-fences/create');
  await expect(page.getByRole('heading', { name: 'New Geo-Fence' })).toBeVisible({ timeout: 15000 });

  // 3. Name
  await page.locator('input[name="geoFenceName"]').fill(name);

  // 4. Type
  await page.locator('#geoFenceZoneType\\.id').click({ force: true });
  await page.locator('[id^="react-select-"][id*="-option-"]').filter({ hasText: 'General' }).click();

  // 5. Draw a boundary on the map
  await drawSquarePolygon();

  // 6. Save
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(2000);

  const errorText = page.getByText('Define a general geographical geo-fence area before saving', { exact: true });
  if (await errorText.count() > 0) {
    throw new Error(
      'Save rejected the drawn polygon because the Geo-Fence Name field had a value - ' +
      'this is the known bug described in this file\'s header comment, not a script defect.'
    );
  }
  await expect(page.getByText(/successfully/i)).toBeVisible({ timeout: 10000 });
  await page.waitForURL('**/fleet/geo-fences');

  // 7. Search for the created geo-fence
  const searchBox = page.getByRole('textbox', { name: 'Search' });
  await searchBox.fill(name);
  const nameCell = page.getByText(name, { exact: true });
  await expect(nameCell).toBeVisible({ timeout: 10000 });

  // Scope to this geo-fence's own row (not just any row on the page) - the
  // name cell is nested one level below the row, same structure as
  // Facilities (see create-delete-facility.spec.js), not one level like
  // Vehicles/Staff.
  const row = nameCell.locator('xpath=../..');

  // 8. Verify Edit and Delete icons are displayed under Options
  const editButton = row.locator('button').filter({ hasText: 'Edit Geo-Fence' });
  const deleteButton = row.locator('button').filter({ hasText: 'Delete Geo-Fence' });
  await expect(editButton).toBeVisible({ timeout: 10000 });
  await expect(deleteButton).toBeVisible({ timeout: 10000 });

  // 9. Click Edit icon
  await editButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await editButton.click();

  // 10. Verify the Edit Geo-Fence page is displayed
  await page.waitForURL(/\/fleet\/geo-fences\/\d+\/edit/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Edit Geo-Fence' })).toBeVisible({ timeout: 15000 });

  // 11. Rename it to a new dynamic value and save
  const newName = `${name}-Edited`;
  await page.locator('input[name="geoFenceName"]').fill(newName);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/successfully/i)).toBeVisible({ timeout: 10000 });

  // 12. Search again to confirm the rename persisted
  await searchBox.fill('');
  await page.waitForTimeout(300);
  await searchBox.fill(newName);
  await expect(page.getByText(newName, { exact: true })).toBeVisible({ timeout: 10000 });
});
