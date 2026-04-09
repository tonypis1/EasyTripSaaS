# Security review — EasyTrip

Checklist orientata a OWASP e alle superfici reali dell’app (Next.js App Router, Clerk, Stripe, Prisma).

## Autenticazione e sessioni

- [x] **Clerk** gestisce login, sessioni e token; chiavi solo server per `CLERK_SECRET_KEY`.
- [ ] Verificare che le route sensibili usino sempre `auth()` / middleware come da `src/middleware.ts`.
- [ ] Session fixation: delegato a Clerk; mantenere cookie `Secure` e `SameSite` in produzione (default provider).

## Autorizzazione (IDOR)

- [ ] Ogni operazione su `tripId` deve verificare **organizzatore o membro** nel service layer (non fidarsi solo del client).
- [ ] Endpoint `join`, `expenses`, `generate`, `replace-slot`, `live-suggest`: audit periodico del codice in `TripController` / `TripService`.

## Input e validazione

- [x] **Zod** su input API (`src/server/validators/*.schema.ts`).
- [ ] Evitare `dangerouslySetInnerHTML` con dati utente non sanitizzati nell’UI.

## Pagamenti (Stripe)

- [x] Webhook con **verifica firma** (`STRIPE_WEBHOOK_SECRET`).
- [ ] Idempotenza eventi: verificare gestione duplicati nel handler webhook.
- [ ] Non loggare payload completi degli eventi in produzione (PII / dati sensibili).

## API e abuse

- [x] **Rate limiting** opzionale via Upstash su: waitlist, join, referral track, generate, live-suggest, replace-slot (`src/lib/rate-limit.ts`).
- [ ] Configurare `UPSTASH_*` in produzione.
- [ ] Considerare WAF / CDN rate limit per `/api/*` a livello edge (Vercel Firewall, Cloudflare).

## Headers HTTP

- [ ] Abilitare **HSTS**, **X-Content-Type-Options**, **Referrer-Policy** via `next.config.ts` o middleware (valutare `headers()`).
- [ ] **CSP** (Content-Security-Policy): graduale; testare con report-only per non rompere Leaflet/CDN.

## Segreti e configurazione

- [ ] Mai committare `.env`; usare secret manager in CI/CD.
- [ ] Rotazione periodica chiavi API (Anthropic, Stripe).

## Dipendenze

- [ ] Eseguire `npm audit` regolarmente; valutare `npm audit fix` con cautela su major.

## Dati personali (GDPR)

- [ ] Informativa privacy e base giuridica per email waitlist, referral, analytics.
- [ ] Export/cancellazione utente: valutare roadmap se richiesto da policy interne.

---

*Revisione consigliata: a ogni release maggiore o dopo modifiche a auth/API.*
