# Storefront e2e tests (Playwright)

Browser tests for the cart, customer login/registration and email confirmation, run against a real
storefront API. They cover the manual checklist in `docs/storefront-frontend-handoff.md` (backend repo)
plus edge cases found while testing.

## Before running

1. Start the storefront API (`site/Katino.Store.Web`, `http://localhost:5088`, `https://localhost:7291`).
2. Start the app: `npm start` (`http://localhost:4200`).
3. Google Chrome must be installed: the tests use it through `channel: 'chrome'`, no browser download.

For the expiry tests, shorten the backend timeouts **locally** (they skip themselves otherwise):

- cart reservation: `CartOptions:ReservationMinutes = 1` in `appsettings.json`;
- customer token lifetime: one minute in `CustomerAuthorizationService`.

## Environment variables

Credentials are read from the environment only. Never put them in files in this repository.

| Variable | Needed for |
|---|---|
| `E2E_CUSTOMER_EMAIL`, `E2E_CUSTOMER_PASSWORD` | a customer with a confirmed email: login, merge, logout, session expiry, tabs |
| `E2E_SECOND_CUSTOMER_EMAIL`, `E2E_SECOND_CUSTOMER_PASSWORD` | a second confirmed customer: account switch between tabs |
| `E2E_REGISTER_EMAIL` | registration + unconfirmed login. Sends a real email. `{n}` becomes a timestamp, e.g. `name+katino{n}@gmail.com` |
| `E2E_CONFIRM_LINK` | a fresh link from a confirmation email (works once) |
| `E2E_BASE_URL` | app URL, default `http://localhost:4200` |
| `E2E_API_URL` | API URL used by the tests themselves, default `http://localhost:5088/api` |

Tests whose variables are missing are skipped with a message saying what to set.

PowerShell:

```powershell
$env:E2E_CUSTOMER_EMAIL = '...'; $env:E2E_CUSTOMER_PASSWORD = '...'
npm run e2e
```

## Running

- `npm run e2e` runs everything: project `main`, then project `rate-limit`.
- `npx playwright test -c e2e --project=main` skips the rate-limit tests.
- `npx playwright test -c e2e tests/guest-cart.spec.ts` runs one file.
- `npm run e2e:report` opens the HTML report; failures keep a screenshot and a trace.

A full run takes several minutes: the expiry tests wait for the real one-minute timeouts.

## How the tests behave

- **Test data** is picked from `/api/Product`: a product without discount, a second product, a
  discounted one and one with fewer than 10 pieces in stock (tests that need a missing kind skip).
- **Rate limits.** The API allows 5 auth calls, 30 cart writes and 100 requests per minute per client.
  `support/rate-budget.ts` records every request (in a file in the OS temp folder, so back-to-back runs
  share it) and makes actions wait for room, so the suite does not trip the limits by accident. `rate-limit.spec.ts` trips them on purpose and runs last.
- **Texts** are compared with `src/assets/i18n/*.json`, so copy changes don't break the tests.
- **Mocked responses** (`mocked-responses.spec.ts`) cover what the data can't produce on demand:
  discontinued variants, a line removed from the catalog, `variantNotPurchasable`, a failed load.
  `cartMerged: false` is mocked in `auth.spec.ts` the same way.
- The tests leave guest carts and lines in the test customer's cart; reservations expire on their own.
