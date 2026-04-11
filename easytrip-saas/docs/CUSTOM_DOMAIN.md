# Dominio personalizzato (da `easytripsaas.vercel.app` a `www.easytripsaas.com`)

L’app usa **`APP_BASE_URL`** (vedi `src/config/unifiedConfig.ts`) per redirect Stripe, link nelle email, referral, invite e job Inngest. Il dominio **non** è hardcodato nel codice: si aggiorna solo la configurazione.

## Produzione attuale (Vercel)

| Elemento            | Valore |
| ------------------- | ------ |
| URL deploy Vercel   | `https://easytripsaas.vercel.app` |

Su **Vercel → Project → Settings → Environment Variables → Production** imposta:

```env
APP_BASE_URL=https://easytripsaas.vercel.app
```

(Rimuovi eventuali slash finali: l’app concatena path tipo `/app/trips/...`.)

---

## Quando acquisti `www.easytripsaas.com` (o `easytripsaas.com`)

Segui l’ordine sotto; salta i passi già fatti se usi solo sottodominio o redirect.

### 1. Vercel — collegare il dominio

1. Vercel → **Project → Settings → Domains**.
2. **Add** il dominio (es. `www.easytripsaas.com` e, se vuoi, anche `easytripsaas.com`).
3. Completa la verifica DNS come indicato da Vercel (record **A** / **CNAME** presso il registrar).
4. Imposta il dominio **primario** che vuoi mostrare agli utenti (spesso `www`).

### 2. Variabile `APP_BASE_URL`

Vercel → **Environment Variables → Production** (e **Preview** se usi preview con URL stabile):

```env
APP_BASE_URL=https://www.easytripsaas.com
```

Usa **esattamente** lo schema e host che gli utenti vedono nel browser (`https`, niente slash finale). Dopo il salvataggio, **ridistribuisci** (Redeploy) l’ultimo deploy o fai un commit vuoto, così le funzioni serverless leggono il nuovo valore.

### 3. Stripe — webhook e Checkout

1. **Stripe Dashboard → Developers → Webhooks**.
2. Aggiungi un endpoint (o modifica quello esistente) con URL:
   - `https://www.easytripsaas.com/api/webhooks/stripe`
3. Evento: **`checkout.session.completed`** (come da `docs/stripe-webhook-setup.md`).
4. Copia il nuovo **Signing secret** (`whsec_...`) e aggiorna **`STRIPE_WEBHOOK_SECRET`** su Vercel (Production).  
   - Se lasci il vecchio endpoint solo per test, non mescolare i secret: ogni endpoint ha il suo `whsec_`.

Gli URL di successo/cancel del Checkout sono costruiti da `APP_BASE_URL` nel codice: dopo il punto 2, i redirect puntano al nuovo dominio.

### 4. Clerk — URL consentiti

1. **Clerk Dashboard** → la tua applicazione → **Domains** (o **Paths / URLs** a seconda della UI).
2. Aggiungi il nuovo dominio di produzione e i redirect consentiti (Vercel spesso mostra le istruzioni precise).
3. In **Allowed origins** / **Frontend API** assicurati che includa `https://www.easytripsaas.com` (e `https://easytripsaas.vercel.app` se vuoi ancora usarlo per test).

Se Clerk richiede chiavi diverse per ambienti, allinea `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY` su Vercel.

### 5. Inngest

1. **Inngest Cloud** → app collegata al progetto.
2. Verifica l’URL di sincronizzazione delle funzioni: deve puntare al deploy corretto, tipicamente  
   `https://www.easytripsaas.com/api/inngest`  
   (come in `docs/DEPLOYMENT.md`).
3. Dopo il cambio dominio, **risincronizza** o ridistribuisci così Inngest rileva l’endpoint sul nuovo host.

### 6. Resend / email (se usi `EMAIL_FROM`)

- Aggiungi e verifica il dominio `easytripsaas.com` (o il sottodominio che usi per il mittente) in **Resend → Domains**, poi aggiorna `EMAIL_FROM` se necessario (es. `noreply@easytripsaas.com`).

### 7. Link esterni e SEO

- Aggiorna eventuali link fissi in comunicazioni, social, documentazione pubblica.
- Se usi **www** come canonical, configura redirect **301** da `easytripsaas.com` → `www.easytripsaas.com` (o il contrario) in Vercel **Domains** per evitare duplicati.

### 8. Verifica post-migrazione

- [ ] Login Clerk sul nuovo dominio.
- [ ] Creazione trip → Checkout Stripe (test o importo minimo) → redirect a `https://www.easytripsaas.com/...`.
- [ ] Webhook Stripe in Dashboard: ultimo evento **consegnato** (200).
- [ ] Inngest: una run di prova (es. generazione itinerario) **Completed**.
- [ ] Email transazionali: link nel corpo puntano al nuovo dominio.

---

## Riferimenti nel repo

| File | Contenuto |
| ---- | --------- |
| `src/config/unifiedConfig.ts` | Lettura di `APP_BASE_URL` |
| `docs/stripe-webhook-setup.md` | Webhook Stripe e `STRIPE_WEBHOOK_SECRET` |
| `docs/DEPLOYMENT.md` | Deploy, Inngest, checklist |
| `SECRET_OPS.md` | Variabili su Vercel e rotazione segreti |
