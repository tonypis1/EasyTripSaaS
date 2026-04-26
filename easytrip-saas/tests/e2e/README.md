# Test end-to-end (Playwright)

## Perché con `npx playwright test` compaiono 4 test “skipped”

Su un run tipico in locale (senza variabili opzionali) **quattro** test risultano *skipped* perché **tutti e quattro richiedono la stessa coppia di variabili d’ambiente** che in CI/locale raramente sono impostate “per sbaglio”:

| # | Progetto Playwright | File | Nome (indicativo) | Motivo dello skip |
|---|------------------------|------|--------------------|--------------------|
| 1 | `chromium` | `checkout.spec.ts` | checkout flow | `test.skip` sul `describe` se mancano le env (vedi sotto) |
| 2 | `chromium` | `edge-stripe-cancel.spec.ts` | Stripe checkout back | stesso `describe` skip; opzionale skip in test se manca il bottone pagamento |
| 3 | `chromium` | `slot-replace-geolocation.spec.ts` | trip detail + geolocation | stesso `describe` skip |
| 4 | `mobile-chromium` | `visual/carousel-versions.spec.ts` | version pills @visual | stesso `describe` skip; in più skip in test se non ci sono versioni trip |

**Condizione comune (describe):**

```ts
test.skip(
  !authState || !tripId,
  "Set E2E_AUTH_STORAGE_STATE and E2E_TRIP_ID",
);
```

- `E2E_AUTH_STORAGE_STATE` — percorso a un file JSON generato da Playwright dopo login reale (storage state, es. `e2e/.auth/user.json`).
- `E2E_TRIP_ID` — id (es. cuid) di un viaggio esistente per l’utente in sessione, usato in URL `/it/app/trips/${tripId}`.

Senza almeno una delle due, **tutto il `describe` viene saltato** (non fallisce: è *by design* per non eseguire checkout/geo/visual senza un ambiente preparato).

### Skip aggiuntivi (solo con env già impostate)

- **`edge-stripe-cancel.spec.ts`**: anche con env ok, se il trip **non** mostra “Vai al pagamento” (es. già pagato o stato incoerente), il test si salta a runtime: `No checkout button — trip may not need payment`.
- **`visual/carousel-versions.spec.ts`**: anche con env ok, se `data-testid="trip-version-pills"` non è visibile, si salta: `Trip has no versions yet — cannot snapshot carousel`.

## Configurazione `playwright.config.ts` (perché due “progetti”)

| Progetto | Cosa esegue |
|----------|-------------|
| **`chromium`** | Tutti i file sotto `tests/e2e/**` **tranne** la cartella `visual/` (`testIgnore: [/visual\//]`). È la suite “principale” in Desktop Chrome. |
| **`mobile-chromium`** | **Solo** i file in `tests/e2e/visual/*.spec.ts` (`testMatch`), emulando Pixel 5. Gli altri file non fanno parte di questo progetto. |

Quando lanci `npx playwright test` **senza** filtri, Playwright esegue **entrambi** i progetti. I test in `visual/` **non** compaiono nel progetto `chromium` (sono *ignorati* da quel progetto, non *skipped* lì), ma vengono **contati** come parte della run dal progetto `mobile-chromium`, dove possono risultare *skipped* se mancano le env.

Per eseguire **solo** un progetto:

```bash
npx playwright test --project=chromium
npx playwright test --project=mobile-chromium
```

## Come abilitare i quattro test (flusso consigliato in sintesi)

1. Generare (o copiare) un **storage state** autenticato con il flusso documentato in root (`README_00.md`, sezioni su Clerk e `screenshots:clerk-session` dove applicabile).
2. Esportare un `tripId` reale (DB o UI) per quell’utente.
3. Esempio in PowerShell (adatta i percorsi):

```powershell
$env:E2E_AUTH_STORAGE_STATE="e2e/.auth/user.json"
$env:E2E_TRIP_ID="il-tuo-id-viaggio"
npx playwright test
```

4. Rimuovi le variabili quando vuoi di nuovo la run “leggera” (solo @smoke / senza trip).

Riferimenti aggiuntivi: `CRITICAL_PATHS.md` (path checkout e mitigazioni), `README_00.md` (screenshot e variabili `E2E_*`).

## Comandi utili

| Comando | Effetto |
|--------|---------|
| `npx playwright test` | Tutti i progetti, web server `npm run dev` a meno di `PLAYWRIGHT_SKIP_WEBSERVER=1` |
| `npx playwright test --grep @smoke` | Solo test taggati `@smoke` |
| `PLAYWRIGHT_SKIP_WEBSERVER=1` | Assumi dev server già in esecuzione sull’URL in `E2E_BASE_URL` o default `http://127.0.0.1:3000` |

## Tabella file e dipendenze (sintesi)

| File | Auth / trip / altro | Note |
|------|----------------------|------|
| `smoke-landing.spec.ts` | no | Home redirect e locale base |
| `locale-detection.spec.ts` | no | Rilevamento locale e `LocaleSwitcher` |
| `signup.spec.ts` | no | Guard anonimo |
| `presentation-screenshots.spec.ts` | opzionale (`E2E_AUTH_STORAGE_STATE` / `E2E_TRIP_ID` usati in parte del file) | Screenshot pubblici; vedi sorgente |
| `checkout.spec.ts` | **sì, entrambe** | |
| `edge-stripe-cancel.spec.ts` | **sì, entrambe** | Skip runtime se niente checkout |
| `slot-replace-geolocation.spec.ts` | **sì, entrambe** | + permesso geolocalizzazione |
| `visual/carousel-versions.spec.ts` | **sì, entrambe** | Progetto `mobile-chromium` + versioni UI |

Se qualcosa in questa tabella diventa obsoleto, aggiornare i commenti in cima a ogni `*.spec.ts` e questo README in parallelo.
