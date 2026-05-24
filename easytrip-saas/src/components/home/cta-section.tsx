import { useTranslations } from "next-intl";
import { SectionContainer } from "./section-container";
import { MarketingAuthCta } from "./marketing-auth-cta";

export function CTASection() {
  const t = useTranslations("home.cta");

  return (
    <SectionContainer className="py-10 sm:py-14">
      <div
        id="inizia"
        className="border-et-border from-et-ink/[0.05] rounded-3xl border bg-gradient-to-b to-black/10 p-6 sm:p-10"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
              {t("eyebrow")}
            </p>
            <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
              {t("titleLine1")}
              <br />
              <span className="text-et-accent italic">{t("titleLine2")}</span>
            </h2>
            <p className={`text-et-ink/70 mt-3 text-base leading-relaxed`}>
              {t("subtitle")}
            </p>
          </div>

          <div className="border-et-border rounded-2xl border bg-black/20 p-5">
            <MarketingAuthCta variant="stacked" />
            <div className="border-et-border bg-et-card text-et-ink/60 mt-4 rounded-2xl border p-4 text-xs">
              {t.rich("bonus", {
                strong: (chunks) => (
                  <strong className="text-et-ink">{chunks}</strong>
                ),
              })}
            </div>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
