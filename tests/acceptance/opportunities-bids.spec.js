// @ts-check
// NOTE: Written 2026-10-01 from the TestRail "US" suite (S139) export
// smartcity___portal-acceptance.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html). Labels
// are taken from the case titles and need a live check.
// Opportunities page bid features (RVP-4335, RVP-4339, RVP-4333, RVP-4337).
// Rubicon Pro page - skips if the nav link isn't on this tenant. Bid
// events come from the Sourcing Tool, so tests that need one skip without.
// Manual only (need the Sourcing Tool): C44850-C44852.
// Not yet: C44899 / C44901 / C44903 (adding/deleting notes - needs a
// throwaway bid event).
import { test, expect } from '@playwright/test';
import { openNavPage } from './acceptance-helpers';

async function openOpportunities(page) {
  await openNavPage(page, test, /^Opportunities$/i);
  await expect(page.getByRole('heading', { name: /Opportunit/i }).first()).toBeVisible({ timeout: 15000 });
}

function columnValues(page, header) {
  return page.getByRole('columnheader', { name: header }).evaluate((th) => {
    const idx = [...th.parentElement.children].indexOf(th);
    return [...th.closest('table').querySelectorAll('tbody tr')].map((tr) => tr.children[idx]?.textContent?.trim() || '');
  });
}

test.describe('Opportunities - bids', () => {
  test('C44849 - quick filters: Open Bids, Submitted Bids, Under Review, Your Awards, Completed', async ({ page }) => {
    await openOpportunities(page);
    for (const name of ['Open Bids', 'Submitted Bids', 'Under Review', 'Your Awards', 'Completed']) {
      await expect(page.getByText(name, { exact: true }).first(), name).toBeVisible();
    }
  });

  test('C45088 / C45089 / C45090 - Request Type is RFP, Launch or No Event', async ({ page }) => {
    await openOpportunities(page);
    const values = await columnValues(page, /Request Type/i);
    test.skip(values.length === 0, 'No opportunities listed');
    for (const v of values) expect(['RFP', 'Launch', 'No Event'], `"${v}"`).toContain(v);
  });

  test('C45144 / C45145 - bid events show "Bid Due: MM/DD/YYYY"; AWARD ones do not', async ({ page }) => {
    await openOpportunities(page);
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    test.skip(count === 0, 'No opportunities listed');
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).innerText();
      if (/AWARD/i.test(text)) expect(text, 'AWARD row').not.toMatch(/Bid Due/i);
      else if (/RFP|Launch/.test(text)) expect(text, 'bid event row').toMatch(/Bid Due: \d{2}\/\d{2}\/\d{4}/);
    }
  });

  test('C44895 / C44896 / C44897 / C44898 / C44900 / C44905 - note icon and note modal on a bid event', async ({ page }) => {
    await openOpportunities(page);
    const noteIcon = page.locator('tbody tr').filter({ hasText: /RFP|Launch/ }).locator('[title*="note" i], [aria-label*="note" i], [id*="note" i]').first();
    test.skip(await noteIcon.count() === 0, 'No bid event with a note icon listed');
    await noteIcon.click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });
    // Customer name and address at the top, add-note control at the bottom.
    await expect(modal.getByRole('button', { name: /Add|\+/ }).or(modal.locator('[title*="add" i]')).first()).toBeVisible();
    // Notes, if any, newest first.
    const stamps = (await modal.innerText()).match(/\d{2}\/\d{2}\/\d{4}[ ,]+\d{1,2}:\d{2}( ?[AP]M)?/gi) || [];
    const times = stamps.map((s) => new Date(s.replace(',', '')).getTime());
    expect(times, 'newest note on top').toEqual([...times].sort((a, b) => b - a));
    if (stamps.length) await expect(modal.locator('[title*="delete" i], [aria-label*="delete" i]').first()).toBeVisible();
  });

  test('C44902 - Enter Bid modal has a note field', async ({ page }) => {
    await openOpportunities(page);
    const enterBid = page.getByRole('button', { name: /Enter Bid/i });
    test.skip(await enterBid.count() === 0, 'No open bid event to enter a bid on');
    await enterBid.first().click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByLabel(/Note/i).or(modal.locator('textarea')).first()).toBeVisible({ timeout: 10000 });
    await modal.getByRole('button', { name: /Cancel|Close/ }).first().click();
  });
});
