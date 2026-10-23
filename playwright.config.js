// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
// tests/seed/ - matched on either path separator (Windows paths use \).
const SEED_DIR = /[\\/]seed[\\/]/;

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. This is the
     * single place the environment is set - every test (and
     * tests/auth.setup.js) navigates with relative paths against it, so
     * pointing the suite at another Hauler host is one change here (or
     * HAULER_BASE_URL in the environment), not an edit in every file. */
    baseURL: process.env.HAULER_BASE_URL || 'https://hauler.qa.smartcity.routeware.com',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      // Logs in once via auth/credentials.json and saves storage state to
      // playwright/.auth/user.json (gitignored) - every other project
      // depends on this and reuses that session, mirroring how
      // run-scenarios.sh authenticates once before running scenarios.
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      // The QA host serves index.html in place of its JS bundles to a
      // "HeadlessChrome" user agent (Playwright's raw headless default),
      // leaving a blank page. The browser projects below already send a
      // non-headless UA via their device presets; give setup the same one.
      use: { userAgent: devices['Desktop Chrome'].userAgent },
    },

    // Creates the QA records some tests/regression specs skip without. Only
    // defined when HAULER_SEED=1, so `npm test` (which runs every project)
    // never seeds - see "Seeding QA data" in README.md.
    ...(process.env.HAULER_SEED === '1'
      ? [{
          name: 'seed',
          testMatch: SEED_DIR,
          use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
          dependencies: ['setup'],
        }]
      : []),

    {
      name: 'chromium',
      testIgnore: SEED_DIR,
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },

    {
      // On the UK dev tenant Chromium intermittently crashed the app with a
      // Redux TypeError after a failed WebSocket hub connection, while
      // Firefox didn't. Not yet seen on this tenant, but kept available as a
      // fallback: `npx playwright test --project=firefox`.
      name: 'firefox',
      testIgnore: SEED_DIR,
      use: { ...devices['Desktop Firefox'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      testIgnore: SEED_DIR,
      use: { ...devices['Desktop Safari'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});
