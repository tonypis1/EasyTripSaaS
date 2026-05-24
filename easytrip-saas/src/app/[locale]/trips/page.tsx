import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Molti utenti aprono /{locale}/trips per errore.
 * L’area autenticata è sotto /{locale}/app → elenco viaggi = /{locale}/app/trips.
 *
 * Usiamo `redirect` da `@/i18n/navigation` cosi' next-intl aggiunge
 * automaticamente il prefisso locale al path target.
 */
export default async function TripsAliasRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = (routing.locales as readonly string[]).includes(locale)
    ? (locale as (typeof routing.locales)[number])
    : routing.defaultLocale;
  redirect({ href: "/app/trips", locale: safeLocale });
}
