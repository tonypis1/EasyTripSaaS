import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function AppHomePage() {
  const t = await getTranslations("app.dashboard");

  return (
    <div className="space-y-10">
      <div className="border-et-accent/40 border-l-2 pl-6">
        <p className="text-et-accent/88 text-xs font-semibold tracking-[0.16em] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-et-ink mt-2 text-3xl font-normal tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
      </div>
      <p className="text-et-ink/70 max-w-xl text-base leading-relaxed">
        {t("description")}
      </p>
      <Link
        href="/app/trips"
        className="border-et-border bg-et-card text-et-ink hover:border-et-accent/35 hover:bg-et-accent/10 inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold transition-colors duration-200"
      >
        {t("ctaViewTrips")}
      </Link>
    </div>
  );
}
