# Pending scenarios

Files here are ported from `UK-PW-automation` but **can't pass on this
tenant yet**, because they depend on UK-only data or a flow that hasn't been
confirmed here. `run-scenarios.sh` with no arguments globs `scenarios/*.js`
(non-recursive), so a full suite run skips this directory. This is the same
convention as the UK repo's `scenarios/pending/`.

| File | Blocked on |
|---|---|
| `create-location-first-customer.js` | The UK version works around UK Address Data hiding location creation. Here, location creation should be a normal Add/Create Location action (see `../verify-location-creation-available.js`). Rewrite it against that form once it's confirmed live. |
| `verify-subscriptions-feature-flag-and-services.js` | Hardcodes a UK customer (`3382483`) and its UK subscription services (AHP / Garden / Clinical). This needs a US fixture customer, and it needs confirming that the Subscriptions flag is on for `Eliana -QAUSA`. |

## Not ported at all

These UK scenarios test UK-only features and have no US equivalent.
`../verify-uk-only-features-inactive.js` covers the inverse (they must *not*
be active here):

- `verify-uk-address-data-activated.js` (C65966)
- `verify-uk-address-import-menu-option.js` (C65968)
- `verify-uk-street-data-*.js` (12 files, SCP-5016: Ordnance Survey <-> OpenStreetMap)
- UK `pending/` stubs `c66745`, `c70296`-`c70301` (UK Address Data), and
  `c768407`-`c768422` (UK Street Data)

The UK `pending/` Subscription Services stubs (`c70221`-`c70238`) and
Service Deployer stub (`c66747`) weren't ported either. They're
title-only TestRail placeholders with no steps, so there's nothing to adapt
yet. Revisit them once `../verify-finance-billing-loads.js` and the
Subscriptions item above are resolved on this tenant.

## Promoting a file

1. Walk the real flow live on `hauler.qa.smartcity.routeware.com`.
2. Fix the body (same style as `../create-vehicle.js`) and update the
   `NOTE:` header to say what was verified and when.
3. Move it up into `scenarios/`, then run it on its own:
   `./run-scenarios.sh scenarios/<file>.js`.
