// @ts-check
// Shared by the tests/snowplow specs. Not a spec itself (no .spec.js
// suffix), so Playwright doesn't collect it.
import { expect } from '@playwright/test';
import fs from 'fs';
import zlib from 'zlib';
import { openFeatureModal, openNestedModal } from '../acceptance/acceptance-helpers';

// A promo dialog can appear on load and sit on top of the page (same
// pattern as create-daily-route.spec.js) - close it if present.
export async function dismissPromo(page) {
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.count() > 0) await close.first().click();
}

// The Google Maps container. Its tiles are a canvas, so specs only check
// that the map rendered, not what's drawn on it.
export function mapContainer(page) {
  return page.locator('.gm-style').first();
}

export async function openSnowOps(page) {
  await page.goto('/dashboard/all-ops');
  await page.waitForURL('**/dashboard/all-ops', { timeout: 15000 });
  await dismissPromo(page);
  await page.getByRole('link', { name: 'Snow Ops', exact: true })
    .or(page.getByRole('tab', { name: 'Snow Ops', exact: true }))
    .or(page.getByRole('button', { name: 'Snow Ops', exact: true }))
    .first()
    .click();
  await page.waitForURL(/snow/i, { timeout: 15000 });
}

// Dispatch -> Snow Tracker. Dispatch lands on Route Tracker (confirmed
// live in create-daily-route.spec.js); Snow Tracker is its sibling link.
export async function openSnowTracker(page) {
  await page.goto('/dashboard/all-ops');
  await page.getByRole('link', { name: 'Dispatch' }).click();
  await page.waitForURL('**/routes/route-tracker', { timeout: 15000 });
  await dismissPromo(page);
  await page.getByRole('link', { name: /Snow Tracker/i }).click();
  await page.waitForURL(/snow/i, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /Snow Tracker/i })).toBeVisible({ timeout: 15000 });
}

// Snow route rows on the Snow Tracker list. Route Tracker's rows are keyed
// by numeric id ([id^="route-"]); the snow list is assumed to follow suit,
// with table rows as a fallback.
export function snowRouteRows(page) {
  return page.locator('[id^="route-"][id$="-name"]').or(page.locator('tbody tr'));
}

// Settings -> Application Settings -> Fleet Management -> Alternative
// Fleet pencil icon. (The case text puts it under "Rubicon Admin Features";
// live it's under Fleet Management.) The modal is not an ARIA dialog - see
// featureModals() in acceptance-helpers.js.
export async function openAltFleetModal(page) {
  return openFeatureModal(page, 'Alternative Fleet');
}

export function altFleetRow(page) {
  return page.getByText(/^Alternative Fleet/).first().locator('xpath=ancestor::*[.//button][1]');
}

// The Alternative Fleet modal only lists Snow Plow and Street Sweeping,
// each with its own pencil icon; Snow Plow's settings (Driver Experience,
// Last Serviced Time frames, Save / Restore to Defaults) open in a second
// modal stacked on top.
export async function snowPlowSection(modal) {
  const section = await openNestedModal(modal, 'Snow Plow');
  // The modal frame appears before its settings load, and the Time Frame
  // interval values ("0-4 hours") fill in after the labels - that late
  // re-render closes any dropdown opened before it, so wait for both.
  await expect(section.getByText('Time Frame 1', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(section.getByText(/\d+\s*(?:-\s*\d+|\+)?\s*(?:hours?|days?|weeks?|months?)/i).first()).toBeVisible({ timeout: 10000 });
  return section;
}

// Reads every text cell from an .xlsx (enough to check a sample file's
// column headers) without adding an xlsx dependency: walks the zip central
// directory and inflates xl/sharedStrings.xml plus the worksheets, since
// some exporters write inline strings into the sheet instead.
export function readXlsxStrings(filePath) {
  const buf = fs.readFileSync(filePath);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error(`${filePath} is not a zip/xlsx file`);
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const strings = [];
  for (let i = 0; i < entries; i++) {
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (/^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(name)) {
      const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
      const raw = buf.subarray(dataStart, dataStart + compSize);
      const xml = (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
      strings.push(...[...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1].trim()));
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return strings;
}
