"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  CONSENT_REOPEN_EVENT,
  currentConsent,
  reopenConsentBanner,
  setAnalyticsConsent,
  subscribeConsent,
  type AnalyticsConsent,
} from "@/lib/analytics/consent";
import { POSTHOG_KEY } from "@/lib/analytics/posthog-options";

const BUTTON =
  "border-et-border text-et-ink hover:border-et-accent/50 focus:ring-et-accent/50 min-h-[40px] flex-1 cursor-pointer rounded-lg border bg-transparent px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:outline-none sm:flex-none";

/**
 * Banner dei cookie di analisi. Compare finché non c'è una scelta valida e
 * quando l'utente la riapre dal footer. "Rifiuta" e "Accetta" hanno la
 * stessa evidenza; chiudere il banner equivale a rifiutare. Senza PostHog
 * configurato non ci sono cookie di analisi da chiedere e il banner non
 * compare.
 */
export function CookieConsentBanner() {
  const t = useTranslations("legal.cookieBanner");
  // Sul server (e durante l'idratazione) la scelta non è nota: banner nascosto.
  const consent = useSyncExternalStore(
    subscribeConsent,
    currentConsent,
    () => undefined,
  );
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen);
  }, []);

  const visible = Boolean(POSTHOG_KEY) && (reopened || consent === null);
  if (!visible) return null;

  function choose(value: AnalyticsConsent) {
    setReopened(false);
    setAnalyticsConsent(value);
  }

  return (
    <section
      role="region"
      aria-label={t("title")}
      data-testid="cookie-banner"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div className="border-et-border bg-et-raised relative mx-auto max-w-3xl rounded-xl border p-4 shadow-2xl sm:p-5">
        <button
          type="button"
          onClick={() => choose("denied")}
          aria-label={t("close")}
          className="text-et-ink/50 hover:text-et-ink absolute top-2 right-2 cursor-pointer rounded p-1"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-et-ink pr-6 text-sm font-semibold">{t("title")}</p>
        <p className="text-et-ink/70 mt-1 text-sm leading-relaxed">
          {t.rich("body", {
            link: (chunks) => (
              <Link
                href="/privacy#cookie"
                className="text-et-accent underline underline-offset-2"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
        <div className="mt-4 flex gap-3 sm:justify-end">
          <button
            type="button"
            className={BUTTON}
            onClick={() => choose("denied")}
            data-testid="cookie-reject"
          >
            {t("reject")}
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() => choose("granted")}
            data-testid="cookie-accept"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Link per cambiare la scelta (footer). */
export function CookiePreferencesLink({ className }: { className?: string }) {
  const t = useTranslations("legal.cookieBanner");
  if (!POSTHOG_KEY) return null;
  return (
    <button
      type="button"
      onClick={reopenConsentBanner}
      className={className}
      data-testid="cookie-preferences"
    >
      {t("preferences")}
    </button>
  );
}
