# E2E critical paths

## Scope

- Home `/`: ramo marketing (anonimo) vs dashboard leggera (sessione Clerk) — regressioni UI/nav.
- Signup access guard (anonymous user -> auth flow)
- Checkout start from trip detail (authenticated user)

## Path 1: Signup guard

1. User opens protected route `/app/trips`.
2. Clerk middleware redirects to auth.
3. User sees sign-in/sign-up CTA.

### Risks

- Custom Clerk theme changes labels and breaks weak selectors.
- Redirect loop if env keys mismatch.

### Mitigations in tests

- User-facing locators (`getByRole`) with regex alternatives.
- URL assertion with broad auth pattern.

## Path 2: Checkout start

1. Authenticated user opens `/app/trips/:tripId`.
2. User clicks `Vai al pagamento`.
3. App calls `/api/billing/checkout` and redirects to Stripe Checkout.

### Risks

- Missing metadata (`tripId`) blocks webhook completion.
- Wrong `APP_BASE_URL` breaks success/cancel return URLs.
- Invalid auth state causes silent redirect to sign-in.

### Mitigations in tests

- Isolated authenticated storage state.
- Explicit Stripe URL assertion after click.
- Required env guards (`E2E_AUTH_STORAGE_STATE`, `E2E_TRIP_ID`).

## Known gap

- Full end-to-end payment confirmation (Stripe webhook -> generated days) requires test Stripe setup + webhook tunnel in CI/staging.

## See also

- [tests/e2e/README.md](./README.md) — progetti Playwright (`chromium` vs `mobile-chromium`), perché alcuni test risultano _skipped_ senza `E2E_AUTH_STORAGE_STATE` / `E2E_TRIP_ID`, e come abilitarli.
