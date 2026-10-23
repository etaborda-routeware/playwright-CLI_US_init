// @ts-check
// NOTE: Written 2026-09-30 from the TestRail "US" suite (S139) export
// smartcity___portal-regression.xlsx - NOT yet run. SCP-4881 VendorId
// removal from the Public API ServiceContract endpoint (C441023-C441028).
// The cases give no endpoint, key header or test contract, so everything
// comes from the environment and the whole file skips until it's set:
//   HAULER_API_BASE_URL            e.g. https://<public api host>
//   HAULER_SERVICE_CONTRACT_PATH   e.g. /v1/servicecontract
//   HAULER_SERVICE_CONTRACT_ID     a contract owned by key A's vendor
//   HAULER_API_KEY                 key A
//   HAULER_API_KEY_B               key B, a different vendor (C441026 / C441027)
//   HAULER_API_KEY_HEADER          optional, defaults to x-api-key
// The PUT cases write the contract back with the body GET just returned,
// so the contract's data is left as it was.
// C441028 only checks the "no vendorId" half: the API spec it should be
// validated against isn't in the export.
import { test, expect } from '@playwright/test';

const env = process.env;
const BASE = env.HAULER_API_BASE_URL;
const PATH = env.HAULER_SERVICE_CONTRACT_PATH;
const ID = env.HAULER_SERVICE_CONTRACT_ID;
const KEY_A = env.HAULER_API_KEY;
const KEY_B = env.HAULER_API_KEY_B;
const KEY_HEADER = env.HAULER_API_KEY_HEADER || 'x-api-key';

const url = () => `${BASE}${PATH}/${ID}`;
const headers = (key) => ({ [KEY_HEADER]: /** @type {string} */ (key), 'Content-Type': 'application/json' });

function hasVendorId(value) {
  return /"vendorId"\s*:/i.test(JSON.stringify(value));
}

function withoutVendorId(body) {
  return JSON.parse(JSON.stringify(body), (k, v) => (k.toLowerCase() === 'vendorid' ? undefined : v));
}

test.describe('Public API - ServiceContract vendorId removal (SCP-4881)', () => {
  test.skip(!BASE || !PATH || !ID || !KEY_A, 'Set HAULER_API_BASE_URL, HAULER_SERVICE_CONTRACT_PATH, HAULER_SERVICE_CONTRACT_ID and HAULER_API_KEY');
  // No browser involved - run once, not per browser project.
  test.skip(({ browserName }) => browserName !== 'chromium', 'API-only - chromium project only');

  test('C441023 / C441028 - GET does not return vendorId', async ({ request }) => {
    const response = await request.get(url(), { headers: headers(KEY_A) });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).length, 'Empty response body').toBeGreaterThan(0);
    expect(hasVendorId(body), 'Response still contains vendorId').toBe(false);
  });

  test('C441024 / C441027 - PUT without vendorId succeeds and keeps the vendor', async ({ request }) => {
    const current = await (await request.get(url(), { headers: headers(KEY_A) })).json();
    const put = await request.put(url(), { headers: headers(KEY_A), data: withoutVendorId(current) });
    expect(put.status()).toBe(200);

    // Still readable with the owning vendor's key...
    const after = await request.get(url(), { headers: headers(KEY_A) });
    expect(after.status()).toBe(200);
    // ...and not with another vendor's, if one is configured.
    if (KEY_B) {
      const other = await request.get(url(), { headers: headers(KEY_B) });
      expect(other.status(), 'Key B can read key A\'s contract after the PUT').not.toBe(200);
    }
  });

  test('C441025 - PUT with vendorId is ignored or rejected, never applied', async ({ request }) => {
    const current = await (await request.get(url(), { headers: headers(KEY_A) })).json();
    const put = await request.put(url(), { headers: headers(KEY_A), data: { ...withoutVendorId(current), vendorId: 999999 } });
    // The case accepts either 200 (ignored) or a validation error.
    expect([200, 400, 422]).toContain(put.status());

    const after = await request.get(url(), { headers: headers(KEY_A) });
    expect(after.status(), 'Contract no longer belongs to key A\'s vendor').toBe(200);
  });

  test('C441026 - vendor is resolved from the API key', async ({ request }) => {
    test.skip(!KEY_B, 'Set HAULER_API_KEY_B (a second vendor) for this case');
    const a = await request.get(url(), { headers: headers(KEY_A) });
    const b = await request.get(url(), { headers: headers(KEY_B) });
    expect(a.status()).toBe(200);
    expect(b.status(), 'Key B can read a contract owned by key A\'s vendor').not.toBe(200);
  });
});
