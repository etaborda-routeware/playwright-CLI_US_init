// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet live-verified against
// hauler.qa.smartcity.routeware.com (the QA frontend was serving a broken
// build at the time: its main JS bundle URL returned index.html).
// RVP-2660 RUBICONSelect partner tiles (C45525-C45534). The cases don't say
// which page the tiles are on, and RUBICONSelect may not exist on a
// SmartCity tenant at all - so PARTNERS_PATH is null and every test skips
// until someone sets it to the page's path (e.g. '/rubicon-select').
// Expected names and links are copied from the cases. The tile text is
// checked by its first sentence only - the full blurbs are long and
// "as mentioned in jira".
// Not checked: whether the CCG link really lands on commercialcreditgroup.com
// (the case gives only the page title, not a URL).
import { test, expect } from '@playwright/test';

const PARTNERS_PATH = null;

const PARTNERS = [
  { id: 'C45525', name: 'Commercial Credit Group (CCG)', text: 'CCG has been providing superior commercial equipment financing', link: /commercialcreditgroup\.com/ },
  { id: 'C45526', name: 'Concord Inc.', text: 'Did you know that the Department of Transportation (DOT) violations', link: 'https://www.rubicon.com/lp/rubiconselect-concorde/' },
  { id: 'C45527', name: 'ACE Equipment Company', text: 'ACE Equipment provides its customers with unparalleled service', link: 'https://www.rubicon.com/lp/rubiconselect-ace/' },
  { id: 'C45528', name: 'BioBag', text: 'BioBag is a wold leader in providing bags and films', link: 'https://www.rubicon.com/lp/rubiconselect-biobag/' },
  { id: 'C45529', name: 'Insurance Office of America (IOA)', text: 'IOA offers a full range of coverage products', link: 'https://www.rubicon.com/lp/rubiconselect-ioa/' },
  { id: 'C45530', name: 'Michelin', text: "Rubicon's hauler partners now have exclusive access", link: 'https://myportal.michelingroup.com/s/advantage-form?language=en_US&AAC=RGUS' },
  { id: 'C45531', name: 'Plum Creek', text: 'Plum Creek consists of two business segments', link: 'https://www.rubicon.com/lp/rubiconselect-plum-creek/' },
  { id: 'C45532', name: 'ARC Compactors', text: 'ARC customers save money, reduce odor', link: 'https://www.rubicon.com/lp/rubiconselect-arc/' },
  { id: 'C45533', name: 'Compactor Rentals of America', text: 'Compactor Rentals of America is the USA', link: 'https://www.rubicon.com/lp/rubiconselect-cra' },
  { id: 'C45534', name: 'Mil-Tek', text: 'Mil-tek USA air-powered balers and compactors', link: 'https://www.rubicon.com/lp/rubiconselect-mil-tek/' },
];

test.describe('RUBICONSelect partner tiles (RVP-2660)', () => {
  test.skip(PARTNERS_PATH === null, 'PARTNERS_PATH not set - page location for the partner tiles is unknown');

  for (const { id, name, text, link } of PARTNERS) {
    test(`${id} - ${name} tile`, async ({ page }) => {
      await page.goto(/** @type {string} */ (PARTNERS_PATH));

      const tile = page.getByText(name, { exact: true }).locator('xpath=ancestor::*[.//a[contains(., "Learn More") or contains(., "learn more")]][1]');
      await expect(tile, `${name} tile not found`).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText(text);

      const learnMore = tile.getByRole('link', { name: /learn more/i });
      const href = await learnMore.getAttribute('href');
      if (typeof link === 'string') {
        // Trailing slashes differ between cases - compare without them.
        expect(href?.replace(/\/$/, '')).toBe(link.replace(/\/$/, ''));
      } else {
        expect(href).toMatch(link);
      }
    });
  }
});
