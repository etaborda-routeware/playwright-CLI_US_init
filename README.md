# US-PW-automation

Playwright-driven UI regression scenarios for the Routeware "Hauler" smart city
dashboard (`hauler.qa.smartcity.routeware.com`).

Structure and tooling match the sibling `UK-PW-automation` project: same two
runners, same report formats, different tenant/region.

## How it works

There are two ways to run the same scenarios, as in the UK repo:

- **`@playwright/test` (primary):** `tests/*.spec.js`, run with `npx playwright test`.
  `tests/auth.setup.js` logs in once (the `setup` project) and saves
  `playwright/.auth/user.json`, which every browser project reuses. Results go
  to Playwright's HTML report in `playwright-report/`.
- **`playwright-cli` (original):** `scenarios/*.js`, run with `run-scenarios.sh`.
  Each scenario is a plain async function (`page => { ... }`) handed to a
  `playwright-cli` session. The runner also handles login, screenshots on
  failure, and its own report in `reports/<run-id>/`, with
  `reports/latest.html` always pointing at the most recent run.

```
auth/                Login template + your local (gitignored) credentials
tests/               @playwright/test specs + auth.setup.js
scenarios/           playwright-cli scenarios, run in filename order
report/              Python helpers that build the run-scenarios.sh HTML report
playwright.config.js Environment (baseURL) and browser projects
run-scenarios.sh     Orchestrates: login -> each scenario -> report
```

The environment is set in one place per runner. For the tests it's `baseURL`
in `playwright.config.js` (override with `HAULER_BASE_URL`), and every spec
navigates with relative paths. For the scenarios it's `run-scenarios.sh` and
`auth/login.template.js`. Both runners log in with the same
`auth/credentials.json` and share the saved session in
`.auth/hauler-eliana-qausa.json`, so a login by either one works for the other.

## Prerequisites

- **Node.js** (LTS) - for `@playwright/test`. Run `npm install` once, then
  `npx playwright install` if the browsers aren't already cached.
- **Bash** - `run-scenarios.sh` is a `.sh` script. On Windows, use Git Bash
  (bundled with [Git for Windows](https://git-scm.com/download/win)) or WSL.
- **Python 3** - used by `run-scenarios.sh` for rendering the login script
  and building its HTML report (stdlib only, no `pip install` needed).
- **`playwright-cli`** - only for `run-scenarios.sh` (`open`, `run-code`,
  `goto`, `screenshot`, `state-load`, `close`). It must be on your `PATH`.

## First-time setup

1. Copy your credentials into place (this file is gitignored, never commit it):

   ```bash
   cp auth/credentials.example.json auth/credentials.json
   ```

   Then edit `auth/credentials.json` with your real email, password, and
   vendor name for this tenant.

2. `npm install`

3. Open this folder in VS Code and, if prompted, install the recommended
   extensions (Python, ESLint, Prettier, ShellCheck, shell-format).

## Running tests (@playwright/test)

```bash
npm test                                        # setup + every spec, all 3 browsers
npx playwright test --project=chromium          # one browser
npx playwright test tests/create-vehicle.spec.js --project=chromium
npm run test:headed                             # watch it run
npm run test:ui                                 # Playwright UI mode
npm run test:report                             # open the last HTML report
```

Specs that only report a value (e.g. the feature-flag specs while
`EXPECTED_CHECKED` is `null`) attach it as an annotation on the test in the
HTML report.

CI (`.github/workflows/playwright.yml`) runs `npx playwright test` on
push/PR. `auth/credentials.json` isn't in the repo, so CI logs in with the
`HAULER_EMAIL`, `HAULER_PASSWORD`, and `HAULER_VENDOR` repository secrets,
which `tests/auth.setup.js` reads when the file is absent.

## Running scenarios (playwright-cli)

From the integrated terminal (Git Bash), or via **Terminal > Run Task** in
VS Code:

```bash
./run-scenarios.sh                              # login + every scenario in scenarios/
./run-scenarios.sh scenarios/create-vehicle.js  # a single scenario
```

VS Code tasks are pre-configured for both runners and for each individual
scenario (`Terminal > Run Task...`), plus **Open latest report** tasks.

## Adding a new scenario

Add a `tests/<name>.spec.js` (same style as `tests/create-vehicle.spec.js`:
`test('...', async ({ page }) => { ... })`, `expect(...)` for assertions, and
a relative `page.goto('/dashboard/all-ops')` as the starting point). To also
run it with `run-scenarios.sh`, drop the equivalent `.js` file into
`scenarios/`. The first line can optionally set a
friendlier display name:

```js
// name: My New Scenario
async page => {
  // ...
}
```

Files run in alphabetical order by filename.

## Seed scenarios

`create-vehicle`, `create-delete-staff`, `create-edit-staff-details`, and
`verify-customer-creation-and-delete-deactivated` were ported from
`UK-PW-automation` and then live-verified against this tenant on 2026-09-07.
The drift found then is described in each file's `NOTE:` header: Staff is
called Resources here, there is no Roles section, different Vehicle Type
options, and no UK Address Data flag. That makes Create Customer and row
Delete *present*.

## Second port batch (2026-09-25, not yet live-verified)

The rest of `UK-PW-automation/scenarios` was reviewed and ported. The QA
frontend was serving a broken build at the time: its main JS bundle URL
returned `index.html`, so nothing could be checked live. Each file's `NOTE:`
header lists what was changed and what still needs a live check. Run each
one on its own first. Every scenario below also exists as a
`tests/<name>.spec.js`.

- **Ported with fixes already confirmed on this tenant** (US address, random
  Vehicle Type/Subtype, no Container Color): `create-delete-facility`,
  `create-edit-vehicle-details`, `verify-vehicle-details`, `create-edit-geofence`,
  `create-edit-city-alert`, `create-location-alert`.
- **Read-only checks, host swapped:** `verify-app-settings-page`,
  `verify-app-settings-menu`, `verify-menus-main`, `verify-customers-page-*`
  (3), `verify-finance-billing-loads`.
- **Adapted to this tenant:** `verify-billing-tab` (first customer instead of
  a hardcoded UK ID), `verify-location-creation-available` (inverted from the
  UK's "deactivated" check, for the same UK Address Data reason as the
  customer scenario), and `verify-billing-invoicing-feature-flag` /
  `verify-service-deployer-feature-flag`. The two flag scenarios only report
  the flag state until `EXPECTED_CHECKED` is set.
- **New:** `verify-uk-only-features-inactive` replaces the 14 UK-only
  scenarios (UK Address Data, UK Address Import, UK Street Data). It asserts
  those features are *not* active here.
- **Test-only** (from the UK repo's `tests/`, no `scenarios/` counterpart
  there either): `create-daily-route`, `create-route-template`,
  `create-service-on-location`. UK option labels ("Domestic", "Refuse",
  "Bin", ...) are now random picks.
- **Pending** (`scenarios/pending/`, skipped by a full run): scenarios that
  need a US fixture or an unconfirmed flow. See `scenarios/pending/README.md`.

Several of these create records (facilities, vehicles, alerts, geo-fences).
Alerts and geo-fences have no delete action, so those records accumulate
with every run.

## US regression specs (2026-09-30, not yet live-verified)

`tests/regression/` holds specs written from the TestRail "US" suite export
(`smartcity___portal-regression.xlsx`). They cover the 132 cases that are
High/Critical priority or typed Functional/Acceptance/Regression.
`traceability/us-regression-traceability.md` maps every one of those case
IDs to a spec, or says why the case stays manual (driver app, DB, SAML,
other vendors or roles). The QA frontend was broken when these were
written, so every selector still needs a live check.

- Specs that change vendor settings or create data (messaging, City Flag
  toggle, Driver PIN, Route Builder) run on chromium only.
- `rubiconselect-partner-tiles.spec.js` skips until `PARTNERS_PATH` is set.
- `api-service-contract-vendorid.spec.js` skips until the `HAULER_API_*`
  variables listed in its header are set.

## US snow plow specs (2026-10-01, not yet live-verified)

`tests/snowplow/` holds specs written from the snow and plow cases in
`C:\cowork\smartcity___portal-snowplow.xlsx`: Snow Ops dashboard, Snow
Tracker, Alternative Fleet settings, Plan A Route, Streets segment data and
Street customer services. `traceability/us-snowplow-traceability.md` maps all
215 of those case IDs to a spec, or says why the case stays manual. Most of
the manual ones need the driver app. The QA frontend was broken when these
were written, so every selector still needs a live check.

```bash
npx playwright test tests/snowplow --project=chromium
```

- The two Alt Fleet tests that save settings (Driver Experience, Snow Plow
  on/off) run on chromium only and restore the original value.
- Snow Tracker tests skip if there's no snow route in the last 3 days.
- `street-customer-snow-service.spec.js` skips until `STREET_CUSTOMER_ID`
  is set to a Street customer that has a snow plow service.

## US acceptance specs (2026-10-01, not yet live-verified)

`tests/acceptance/` holds specs for the acceptance cases in
`C:\cowork\smartcity___portal-acceptance.xlsx` (the same full suite export
as the regression and snowplow files). `traceability/us-acceptance-traceability.md`
maps all 298 cases with "acceptance" in their title, section or type. The
68 already covered by the regression and snowplow specs point there. Most of
these cases have a title only, and the QA frontend was broken when they were
written, so every selector still needs a live check.

```bash
npx playwright test tests/acceptance --project=chromium
```

- Rubicon Services, Work Orders, Opportunities and the RubiconSelect banner
  are Rubicon Pro features. Their tests skip if the page or banner isn't on
  this tenant.
- Strobe Images frequency and App Experience past vehicle tracking are
  saved and restored. These two tests run on chromium only. The other specs
  open forms and modals, check them, and cancel.
- Route Template Builder's load-time test allows up to 99s ("close to
  1 min 30 seconds" in the case).

## Seeding QA data

`tests/seed/seed-qa-data.spec.js` creates the QA records that some
`tests/regression` specs skip without. It adds unassigned Delivery/Utility
jobs for Route Builder, and a service on the first customer for the Service
Contract icon tests. It only tops up what's missing; seeded jobs have a
`PW-SEED-` work order number. It's a separate `seed` project that only
exists when `HAULER_SEED=1` is set, so `npm test` never runs it:

```bash
HAULER_SEED=1 npx playwright test --project=seed                    # Git Bash
HAULER_SEED=1 SEED_JOB_COUNT=5 npx playwright test --project=seed   # more jobs
```

In PowerShell: `$env:HAULER_SEED='1'; npx playwright test --project=seed`.

Route Assist history, Missing/New Address exceptions and registered devices
can't be seeded from the portal. They come from the driver app.

## Notes

- `auth/credentials.json` and everything under `.auth/`, `.playwright-cli/`,
  `.playwright/`, and `reports/` is gitignored - it's either a secret or
  generated output, not source.
- The report generator redacts the login credentials from any echoed output
  before it's written to disk, so `reports/*.html` is safe to share.
