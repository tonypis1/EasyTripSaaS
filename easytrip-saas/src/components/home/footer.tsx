import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function MarketingFooter() {
  const t = useTranslations("home.footer");
  const tCommon = useTranslations("common");
  const year = new Date().getFullYear();

  return (
    <footer className="border-et-border bg-et-deep border-t">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/"
              className="font-display text-et-accent inline-block text-lg font-normal tracking-tight"
            >
              {tCommon("appName")}
            </Link>
            <p className="text-et-ink/60 mt-2 text-sm">{t("tagline")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="/#come-funziona"
              scroll
            >
              {t("howItWorks")}
            </Link>
            <Link
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="/#prezzi"
              scroll
            >
              {t("pricing")}
            </Link>
            <Link
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="/#faq"
              scroll
            >
              {t("faq")}
            </Link>
            <Link
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="/app"
            >
              {t("reservedArea")}
            </Link>
          </div>
        </div>
        <div className="text-et-ink/45 mt-8 text-xs">
          {t("rights", { year })}
        </div>
      </div>
    </footer>
  );
}
