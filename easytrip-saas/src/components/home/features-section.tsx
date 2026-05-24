import { useTranslations } from "next-intl";
import { IconMap, IconSparkles, IconUsers } from "./icons";
import { SectionContainer } from "./section-container";

export function FeaturesSection() {
  const t = useTranslations("home.features");

  return (
    <SectionContainer className="text-et-ink">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
            {t("title")}
          </h2>
          <p
            className={`text-et-ink/70 mt-4 max-w-xl text-base leading-relaxed`}
          >
            {t("body")}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="border-et-border bg-et-card rounded-2xl border p-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div className="font-semibold">{t("box1.title")}</div>
              </div>
              <p className="text-et-ink/65 mt-2 text-sm">{t("box1.body")}</p>
            </div>
            <div className="border-et-border bg-et-card rounded-2xl border p-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏳</span>
                <div className="font-semibold">{t("box2.title")}</div>
              </div>
              <p className="text-et-ink/65 mt-2 text-sm">{t("box2.body")}</p>
            </div>
          </div>
        </div>

        <div className="border-et-border bg-et-card rounded-3xl border p-6">
          <p className="text-et-ink/90 text-sm font-semibold">
            {t("rightTitle")}
          </p>
          <div className="mt-5 space-y-4">
            <div className="border-et-border flex gap-4 rounded-2xl border bg-black/10 p-4">
              <div className="text-et-accent mt-0.5" aria-hidden="true">
                <IconSparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">{t("item1.title")}</div>
                <div className="text-et-ink/65 mt-1 text-sm">
                  {t("item1.body")}
                </div>
              </div>
            </div>
            <div className="border-et-border flex gap-4 rounded-2xl border bg-black/10 p-4">
              <div className="text-et-accent mt-0.5" aria-hidden="true">
                <IconMap className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">{t("item2.title")}</div>
                <div className="text-et-ink/65 mt-1 text-sm">
                  {t("item2.body")}
                </div>
              </div>
            </div>
            <div className="border-et-border flex gap-4 rounded-2xl border bg-black/10 p-4">
              <div className="text-et-accent mt-0.5" aria-hidden="true">
                <IconUsers className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">{t("item3.title")}</div>
                <div className="text-et-ink/65 mt-1 text-sm">
                  {t("item3.body")}
                </div>
              </div>
            </div>
          </div>
          <div className="border-et-border text-et-ink/60 mt-5 rounded-2xl border bg-black/20 p-4 text-xs">
            {t("footer")}
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
