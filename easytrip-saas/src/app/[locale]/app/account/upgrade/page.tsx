import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { container } from "@/server/di/container";
import { logger } from "@/lib/observability";

type SearchParams = Promise<{ plan?: string }>;

/**
 * Pagina ponte: dopo signup (o accesso diretto) reindirizza l'utente al
 * Checkout Stripe in modalità subscription, server-side.
 *
 * Flusso:
 *   1. La home non-loggata → SignUpLocaleButton con `redirectUrl=/{locale}/app/account/upgrade?plan=sub`.
 *   2. Clerk completa il signup → atterra qui.
 *   3. Questo server component crea la Checkout Session e fa redirect 307 a Stripe.
 *
 * La pagina renderizza qualcosa solo se il redirect fallisce (errore Stripe,
 * subscription non configurata, abbonamento già attivo, ecc.): in quel caso
 * mostriamo una UI di fallback con CTA per riprovare o tornare a casa.
 *
 * NOTE Next 15+: i `searchParams` sono Promise.
 */
export default async function AccountUpgradePage(props: {
  searchParams: SearchParams;
}) {
  const params = await props.searchParams;
  const t = await getTranslations("app.subscribeBridge");

  // Solo `?plan=sub` è supportato. Altri valori → fallback errore (no auto-redirect).
  if (params?.plan !== "sub") {
    return <UpgradeFallback t={t} message={t("errorBodyDefault")} />;
  }

  try {
    const { checkoutUrl } =
      await container.services.billingService.createSubscriptionCheckoutSession(
        {},
      );
    redirect(checkoutUrl);
  } catch (error: unknown) {
    // Next.js usa un'eccezione interna per implementare `redirect()`: rilanciala.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      ((error as { digest: string }).digest as string).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : t("errorBodyDefault");
    logger.error("AccountUpgradePage: createSubscriptionCheckoutSession failed", {
      error: message,
    });
    return <UpgradeFallback t={t} message={message} />;
  }
}

function UpgradeFallback({
  t,
  message,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"app.subscribeBridge">>>;
  message: string;
}) {
  return (
    <div className="space-y-6">
      <div className="border-et-accent/40 border-l-2 pl-6">
        <p className="text-et-accent/88 text-xs font-semibold tracking-[0.16em] uppercase">
          Account
        </p>
        <h1 className="font-display text-et-ink mt-2 text-3xl font-normal tracking-tight sm:text-4xl">
          {t("errorTitle")}
        </h1>
        <p className="text-et-ink/65 mt-2 max-w-xl text-sm">{message}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/app/account/upgrade?plan=sub"
          className="bg-et-accent text-et-accent-ink hover:bg-et-accent/90 inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors"
        >
          {t("retryCta")}
        </Link>
        <Link
          href="/"
          className="border-et-border text-et-ink hover:bg-et-ink/[0.06] inline-flex min-h-[44px] items-center justify-center rounded-xl border bg-transparent px-5 py-3 text-sm font-semibold transition-colors"
        >
          {t("backToHome")}
        </Link>
      </div>
    </div>
  );
}
