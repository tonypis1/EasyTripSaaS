import { useTranslations } from "next-intl";
import { IconSparkles } from "./icons";
import { MarketingAuthCta } from "./marketing-auth-cta";

export function HeroMarketing() {
  const t = useTranslations("home.hero");

  return (
    <section className="et-grain et-hero-mesh relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="border-et-accent/22 bg-et-accent/10 text-et-accent/88 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase">
          <IconSparkles className="text-et-accent h-4 w-4" />
          {t("badge")}
        </div>
        <div className="border-et-accent/35 mt-8 border-l-2 pl-6 sm:pl-8">
          <h1 className="font-display text-et-ink text-4xl leading-[1.06] font-normal tracking-[-0.02em] sm:text-5xl md:text-[2.75rem]">
            {t("titleLine1")}
            <br />
            <span className="text-et-accent italic">{t("titleLine2")}</span>
          </h1>
        </div>
        <p className="text-et-ink/70 mt-6 max-w-2xl text-base leading-relaxed">
          {t("subtitle")}
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(300px,400px)] lg:items-start lg:gap-10">
          <div className="border-et-border bg-et-card rounded-3xl border p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)]">
            <div className="text-et-ink/90 text-sm font-semibold">
              {t("signupCard.title")}
            </div>
            <p className="text-et-ink/65 mt-2 text-sm leading-relaxed">
              {t("signupCard.body")}
            </p>
            <div className="mt-5">
              <MarketingAuthCta />
            </div>
          </div>
          <div className="border-et-border bg-et-card rounded-3xl border p-6 lg:-translate-y-3 lg:shadow-[0_32px_90px_-40px_rgba(182,227,107,0.12)]">
            <div className="text-et-ink/90 text-sm font-semibold">
              {t("benefitsCard.title")}
            </div>
            <ul className="text-et-ink/70 mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="text-et-accent mt-0.5">✓</span>
                <span>{t("benefitsCard.item1")}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-et-accent mt-0.5">✓</span>
                <span>{t("benefitsCard.item2")}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-et-accent mt-0.5">✓</span>
                <span>{t("benefitsCard.item3")}</span>
              </li>
            </ul>
            <div className="border-et-border text-et-ink/60 mt-5 rounded-2xl border bg-black/20 p-4 text-xs">
              {t("benefitsCard.footer")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
