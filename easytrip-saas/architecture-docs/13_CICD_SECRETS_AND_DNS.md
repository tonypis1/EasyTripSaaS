# 13 — CI/CD: segreti GitHub/Vercel, post-deploy, DNS Hostinger

| Documento | Percorso |
|-----------|----------|
| Indice | [README_00.md](../README_00.md) |
| Deploy | [12_DEPLOYMENT.md](12_DEPLOYMENT.md) |
| DevOps | [08_DEVOPS_VERCEL.md](08_DEVOPS_VERCEL.md) |

## 1. Matrice ambienti (Vercel)

| Variabile | Development (locale) | Preview (Vercel) | Production |
|-----------|----------------------|------------------|------------|
| `APP_BASE_URL` | `http://localhost:3000` | URL Preview (`*.vercel.app`) | `https://easytripsaas.com` |
| `DATABASE_URL` | DB locale / dev | **DB dedicato** (branch Neon o altro) — **non** produzione | DB produzione |
| `STRIPE_*` | Chiavi test (`sk_test_`, `whsec_` test) | Test o chiavi dedicate preview | Chiavi **live** + webhook endpoint produzione |
| `CLERK_*` | Istanza dev | Stesso progetto o ambiente Clerk “preview” | Produzione |
| `INNGEST_*` | Dev server (`npm run inngest:dev`) | App Inngest collegata all’URL Preview | App Inngest → `https://easytripsaas.com/api/inngest` |
| `NEXT_PUBLIC_*` | Qualsiasi | Allineato all’ambiente | Valori pubblici produzione |

**Regola**: non usare mai `NEXT_PUBLIC_` per segreti: finiscono nel bundle client. Clerk publishable, PostHog key, ID affiliate sono volutamente pubblici.

## 2. Setup segreti su Vercel

1. **Vercel** → progetto **easytrip-saas** → **Settings** → **Environment Variables**.
2. Per ogni variabile scegliere gli scope: **Production**, **Preview**, **Development** (tastiera multi-selezione).
3. Dopo ogni modifica: **Redeploy** l’ultimo deployment se serve applicare subito.
4. Riferimento elenco: [`.env.example`](../.env.example) e [`src/config/unifiedConfig.ts`](../src/config/unifiedConfig.ts).

Ordine consigliato al primo go-live:

1. `DATABASE_URL`, `APP_BASE_URL` (dominio finale).
2. Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
3. Stripe live + `STRIPE_WEBHOOK_SECRET` (webhook punta a `https://easytripsaas.com/api/webhooks/stripe`).
4. `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL` se serve).
5. Inngest: `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY` dalla dashboard Inngest → sync su `/api/inngest`.
6. `CLERK_WEBHOOK_SIGNING_SECRET` → URL `https://easytripsaas.com/api/webhooks/clerk`.
7. Resend: `RESEND_API_KEY`, `EMAIL_FROM` (dominio verificato su Resend).
8. Opzionali: Upstash, PostHog, Crisp, affiliate `NEXT_PUBLIC_*`.

## 3. Setup segreti su GitHub (job `verify-env`)

Il workflow [`.github/workflows/main.yml`](../../.github/workflows/main.yml) espone il job **Verify production env** solo su **`workflow_dispatch`**.

1. **GitHub** → repository → **Settings** → **Secrets and variables** → **Actions**.
2. Crea **Repository secrets** con gli **stessi nomi** usati in Vercel Production (almeno quelli richiesti da `npm run check:env:production`):

   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `ANTHROPIC_API_KEY`
   - `APP_BASE_URL`
   - `INNGEST_SIGNING_KEY`
   - `INNGEST_EVENT_KEY`
   - `CLERK_WEBHOOK_SIGNING_SECRET`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`

3. **Actions** → workflow **Main** → **Run workflow**: esegue `node scripts/check-env.mjs --production` senza stampare valori.

Se preferisci non duplicare segreti su GitHub, salta questo job e usa in locale:

```bash
cd easytrip-saas
set -a && source .env.production && set +a   # oppure export manuale su Windows PowerShell
npm run check:env:production
```

## 4. Post-deployment check

Dopo un deploy Vercel (Production):

```bash
cd easytrip-saas
set APP_BASE_URL=https://easytripsaas.com
npm run postdeploy:check
```

Lo script chiama `GET /api/health` (ping DB + flag Inngest) e la homepage. Se `INNGEST_*` non sono impostate sul deploy, lo script termina comunque con successo ma mostra un **warning**.

**Inngest**: apri la dashboard Inngest e verifica che le funzioni siano sincronizzate e che non ci siano errori sui run recenti.

**Database**: in CI le migrazioni non sono applicate automaticamente su produzione. Operatore:

```bash
cd easytrip-saas
npx prisma migrate deploy
```

(contro `DATABASE_URL` produzione, da macchina fidata o job dedicato).

## 5. Piano DNS Hostinger → Vercel

### 5.1 Sito (HTTPS)

1. **Vercel** → **Domains** → aggiungi `easytripsaas.com` e, se serve, `www.easytripsaas.com`.
2. Copia i record richiesti (es. **A** per `@` verso IP Vercel, **CNAME** per `www` verso `cname.vercel-dns.com` — valori **esatti** dalla UI Vercel).
3. **Hostinger** → **Domini** → **DNS / Nameserver**:
   - Se usi DNS Hostinger: incolla i record indicati da Vercel.
   - TTL: prima del cambio puoi abbassare il TTL (es. 300 s) per propagazione più rapida.
4. Attendi propagazione; in Vercel imposta il **dominio primario** (apex o `www`) coerente con `APP_BASE_URL`.
5. Il file [`vercel.json`](../vercel.json) reindirizza `www.easytripsaas.com` → `https://easytripsaas.com`. Se la canonical fosse `www`, inverti redirect e `APP_BASE_URL` di conseguenza.

### 5.2 Email: Hostinger (caselle) + Resend (transazionale)

- **MX**: per ricevere posta su `@easytripsaas.com` con le caselle Hostinger, usa i record **MX** (e eventualmente **Autodiscover**) che il pannello Hostinger indica. Non sovrascrivere gli MX se devono restare su Hostinger.

- **Resend (invio transazionale dall’app)**:
  1. Aggiungi e verifica il dominio in Resend.
  2. Inserisci in Hostinger i record **TXT/CNAME** per **SPF**, **DKIM** (e opzionale **DMARC**) che Resend mostra.
  3. **Un solo record SPF (TXT) per nome host**: unisci gli `include` necessari (es. `include:_spf.resend.com` e quanto richiesto da Hostinger per l’invio delle caselle, se applicabile) in una riga `v=spf1 ... ~all`, seguendo la documentazione aggiornata di entrambi i provider per evitare conflitti.

- **DMARC** (consigliato): record TXT su `_dmarc.easytripsaas.com`, es. `v=DMARC1; p=none; rua=mailto:...` (iniziare con `p=none` per monitoraggio, poi stringere).

- **Marketing** (newsletter, provider terzo): usa un **sottodominio dedicato** (es. `news.easytripsaas.com`) con SPF/DKIM del provider marketing, separato dalla reputazione del dominio usato da Resend per transazionale.

### 5.3 Clerk e Stripe

Dopo il go-live DNS, aggiorna:

- **Clerk**: domini autorizzati / redirect URL con `https://easytripsaas.com`.
- **Stripe**: webhook endpoint su `https://easytripsaas.com/api/webhooks/stripe`.

## 6. Monitoraggio

- **Vercel**: tab **Logs** (runtime) — il logger applicativo scrive JSON su stdout ([`src/lib/observability.ts`](../src/lib/observability.ts)).
- **Inngest Cloud**: run, retry, alert.
- **PostHog**: sessioni e funnel dopo aver impostato `NEXT_PUBLIC_POSTHOG_KEY` in Production.

## 7. Riferimenti rapidi

| Risorsa | Path |
|---------|------|
| Workflow CI/CD | [`.github/workflows/main.yml`](../../.github/workflows/main.yml) |
| Template env | [`.env.example`](../.env.example) |
| Check env | `npm run check:env` / `check:env:strict` / `check:env:production` |
| Post deploy | `npm run postdeploy:check` |
| Health HTTP | `GET /api/health` |
