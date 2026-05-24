import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { IconSparkles } from "./icons";

export function HeroAuthenticated(props: {
  displayName: string;
  planLabel: "Pro" | "Free";
  subExpiresLabel: string | null;
}) {
  const t = useTranslations("home.heroAuth");

  return (
    <section className="et-grain et-hero-mesh relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="flex flex-wrap items-center gap-3">
          <div className="border-et-accent/22 bg-et-accent/10 text-et-accent/88 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase">
            <IconSparkles className="text-et-accent h-4 w-4" />
            {t("welcomeBack")}
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              props.planLabel === "Pro"
                ? "border-et-accent/40 bg-et-accent/15 text-et-accent"
                : "border-et-border bg-et-card text-et-ink/70"
            }`}
          >
            {props.planLabel}
            {props.subExpiresLabel ? ` · ${props.subExpiresLabel}` : null}
          </span>
        </div>
        <div className="border-et-accent/35 mt-8 border-l-2 pl-6 sm:pl-8">
          <h1 className="font-display text-et-ink text-4xl leading-[1.06] font-normal tracking-[-0.02em] sm:text-5xl md:text-[2.75rem]">
            {t("greetingPrefix")} {props.displayName}.
            <br />
            <span className="text-et-accent italic">{t("titleLine2")}</span>
          </h1>
        </div>
        <p className="text-et-ink/70 mt-6 max-w-2xl text-base leading-relaxed">
          {t("subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="#crea-itinerario"
            className="bg-et-accent text-et-accent-ink hover:bg-et-accent/88 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition active:scale-[0.99]"
          >
            {t("createNewCta")}
          </a>
          <Link
            href="/app/trips"
            className="border-et-border bg-et-card text-et-ink hover:border-et-accent/35 hover:bg-et-accent/10 inline-flex items-center justify-center rounded-xl border px-6 py-3 text-sm font-semibold transition"
          >
            {t("viewAllCta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
