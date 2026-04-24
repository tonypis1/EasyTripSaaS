import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function MarketingFooter() {
  const t = useTranslations("home.footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-et-border bg-et-deep border-t">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-display text-et-accent text-lg font-normal tracking-tight">
              EasyTrip
            </div>
            <p className="text-et-ink/60 mt-2 text-sm">{t("tagline")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="#come-funziona"
            >
              {t("howItWorks")}
            </a>
            <a
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="#prezzi"
            >
              {t("pricing")}
            </a>
            <a className="text-et-ink/70 hover:text-et-ink text-sm" href="#faq">
              {t("faq")}
            </a>
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
