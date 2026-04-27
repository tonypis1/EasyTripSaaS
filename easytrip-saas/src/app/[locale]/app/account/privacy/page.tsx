"use client";

import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

export default function AccountPrivacyPage() {
  const locale = useLocale();
  const tPrivacy = useTranslations("app.privacyPage");
  const tDelete = useTranslations("app.privacyDelete");
  const tCommon = useTranslations("common");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [marketingLoaded, setMarketingLoaded] = useState(false);
  const [marketingSaving, setMarketingSaving] = useState(false);
  const [marketingError, setMarketingError] = useState<string | null>(null);
  const clerk = useClerk();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/user/marketing-preferences");
        const json = (await res.json()) as {
          ok?: boolean;
          marketingOptIn?: boolean;
        };
        if (
          !cancelled &&
          res.ok &&
          json.ok &&
          typeof json.marketingOptIn === "boolean"
        ) {
          setMarketingOptIn(json.marketingOptIn);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setMarketingLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onMarketingToggle(next: boolean) {
    setMarketingSaving(true);
    setMarketingError(null);
    try {
      const res = await fetch("/api/user/marketing-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingOptIn: next }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        marketingOptIn?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setMarketingError(json.error?.message ?? "Salvataggio non riuscito.");
        return;
      }
      if (typeof json.marketingOptIn === "boolean") {
        setMarketingOptIn(json.marketingOptIn);
      }
    } catch {
      setMarketingError("Errore di rete. Riprova.");
    } finally {
      setMarketingSaving(false);
    }
  }

  async function onDeleteAccount() {
    const expectedPhrase = tDelete("confirmPhrase");
    if (phrase.trim() !== expectedPhrase) {
      setError(tDelete("confirmMismatch", { phrase: expectedPhrase }));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: phrase.trim() }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "Operazione non riuscita.");
        return;
      }
      setDeleteSuccess(true);
      setPhrase("");
      await new Promise((r) => setTimeout(r, 2200));
      try {
        await clerk.signOut();
      } catch {
        /* session may already be invalid */
      }
      window.location.assign(`/${locale}`);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-12">
      <div className="border-et-accent/40 border-l-2 pl-6">
        <p className="text-et-accent/88 text-xs font-semibold tracking-[0.16em] uppercase">
          Account
        </p>
        <h1 className="font-display text-et-ink mt-2 text-3xl font-normal tracking-tight sm:text-4xl">
          Privacy e dati personali
        </h1>
        <p className="text-et-ink/65 mt-2 max-w-xl text-sm">
          Esporta una copia dei tuoi dati (diritto alla portabilità) o richiedi
          la cancellazione coordinata del tuo account (diritto all&apos;oblio).
        </p>
      </div>

      <section
        aria-labelledby="marketing-heading"
        className="border-et-border bg-et-card rounded-2xl border p-6"
      >
        <h2
          id="marketing-heading"
          className="font-display text-et-ink text-lg font-normal"
        >
          Comunicazioni email
        </h2>
        <p className="text-et-ink/65 mt-2 max-w-xl text-sm">
          Le email su pagamenti e viaggi restano sempre attive. Puoi scegliere
          se ricevere anche suggerimenti e promemoria promozionali (es. se non
          hai ancora creato un viaggio).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-et-ink/88 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={marketingOptIn}
              disabled={!marketingLoaded || marketingSaving}
              onChange={(e) => void onMarketingToggle(e.target.checked)}
              className="border-et-border h-4 w-4 rounded"
            />
            {tPrivacy("marketingOptIn", { appName: tCommon("appName") })}
          </label>
          {!marketingLoaded ? (
            <span className="text-et-ink/45 text-xs">Caricamento…</span>
          ) : null}
        </div>
        {marketingError ? (
          <p className="mt-2 text-sm text-red-300/90" role="alert">
            {marketingError}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="export-heading"
        className="border-et-border bg-et-card rounded-2xl border p-6"
      >
        <h2
          id="export-heading"
          className="font-display text-et-ink text-lg font-normal"
        >
          Esporta i tuoi dati
        </h2>
        <p className="text-et-ink/65 mt-2 max-w-xl text-sm">
          Ricevi un file JSON con le informazioni associate al tuo account
          (viaggi, versioni itinerario, referenze collegate), come previsto dal
          GDPR art. 20.
        </p>
        <a
          href="/api/user/data-export"
          download
          className="bg-et-accent text-et-accent-ink hover:bg-et-accent/90 mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors"
        >
          Scarica export JSON
        </a>
      </section>

      <section
        aria-labelledby="delete-heading"
        className="border-et-border bg-et-card rounded-2xl border p-6"
      >
        {deleteSuccess ? (
          <div
            role="status"
            className="border-et-accent/35 bg-et-accent/8 rounded-xl border p-5"
          >
            <h2
              id="delete-heading"
              className="font-display text-et-ink text-lg font-normal"
            >
              {tDelete("successTitle")}
            </h2>
            <p className="text-et-ink/80 mt-2 max-w-xl text-sm">
              {tDelete("successBody")}
            </p>
            <p className="text-et-accent/88 mt-3 text-sm font-medium">
              {tDelete("redirecting")}
            </p>
          </div>
        ) : (
          <>
            <h2
              id="delete-heading"
              className="font-display text-et-ink text-lg font-normal"
            >
              {tDelete("sectionTitle")}
            </h2>
            <p className="text-et-ink/65 mt-2 max-w-xl text-sm">
              {tDelete("sectionBody")}
            </p>
            <label
              htmlFor="delete-confirm"
              className="text-et-accent/88 mt-6 block text-xs font-semibold tracking-wider uppercase"
            >
              {tDelete("confirmFieldLabel")}
            </label>
            <input
              id="delete-confirm"
              type="text"
              autoComplete="off"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={tDelete("confirmPhrase")}
              className="border-et-border bg-et-deep text-et-ink placeholder:text-et-ink/40 focus:border-et-accent/50 mt-1.5 w-full max-w-md rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void onDeleteAccount()}
              disabled={busy}
              className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? tDelete("confirmBusy") : tDelete("confirmButton")}
            </button>
            {error ? (
              <p className="mt-3 text-sm text-red-300/90" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}
      </section>

      <p className="text-et-ink/45 text-sm">
        <Link href="/app" className="text-et-accent hover:underline">
          Torna alla dashboard
        </Link>
      </p>
    </div>
  );
}
