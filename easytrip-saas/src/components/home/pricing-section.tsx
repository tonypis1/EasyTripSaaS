import { useTranslations } from "next-intl";
import { SectionContainer } from "./section-container";
import { SignupCtaButton } from "./signup-cta";
import { SubscribeCtaButton } from "./subscribe-cta";

type PlanKey = "solo" | "group" | "frequent";

const PLAN_KEYS: PlanKey[] = ["solo", "group", "frequent"];

export function PricingSection() {
  const t = useTranslations("home.pricing");
  const subscribeError = t("plans.frequent.checkoutError");

  const plans = PLAN_KEYS.map((key) => ({
    key,
    name: t(`plans.${key}.name`),
    badge: t(`plans.${key}.badge`),
    priceDisplay: t(`plans.${key}.priceDisplay`),
    desc: t(`plans.${key}.desc`),
    features: [
      t(`plans.${key}.feature1`),
      t(`plans.${key}.feature2`),
      t(`plans.${key}.feature3`),
      t(`plans.${key}.feature4`),
    ],
    cta: t(`plans.${key}.cta`),
  }));

  return (
    <SectionContainer className="border-et-border bg-et-raised border-y">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
            {t("title")}
          </h2>
          <p
            className={`text-et-ink/70 mt-3 max-w-xl text-base leading-relaxed`}
          >
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div id="prezzi" className="mt-10 grid gap-6 lg:grid-cols-3">
        {plans.map((plan, idx) => {
          const highlighted = idx === 0;
          return (
            <div
              key={plan.key}
              className={`relative rounded-3xl border p-6 ${
                highlighted
                  ? "border-et-accent/30 bg-et-accent/10"
                  : "border-et-border bg-et-card"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="border-et-border text-et-ink/70 inline-flex items-center rounded-full border bg-black/20 px-3 py-1 text-xs font-semibold">
                  {plan.badge}
                </div>
              </div>

              <h3 className="text-et-ink mt-4 text-xl font-bold">
                {plan.name}
              </h3>
              <p className="text-et-ink/65 mt-1 text-sm">{plan.desc}</p>

              <div className="mt-5">
                <div className="text-et-ink text-3xl font-bold">
                  {plan.priceDisplay}
                </div>
              </div>

              <ul className="text-et-ink/70 mt-5 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <span className="text-et-accent mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {plan.key === "frequent" ? (
                  <SubscribeCtaButton
                    className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                      highlighted
                        ? "bg-et-accent text-et-accent-ink hover:bg-et-accent/88"
                        : "border-et-ink/14 bg-et-card text-et-ink hover:bg-et-ink/[0.06] border"
                    }`}
                    errorLabel={subscribeError}
                  >
                    {plan.cta}
                  </SubscribeCtaButton>
                ) : (
                  <SignupCtaButton
                    className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                      highlighted
                        ? "bg-et-accent text-et-accent-ink hover:bg-et-accent/88"
                        : "border-et-ink/14 bg-et-card text-et-ink hover:bg-et-ink/[0.06] border"
                    }`}
                  >
                    {plan.cta}
                  </SignupCtaButton>
                )}
              </div>

              {highlighted ? (
                <div className="border-et-border text-et-ink/60 mt-4 rounded-2xl border bg-black/20 p-3 text-xs">
                  {t("plans.solo.highlightFooter")}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-et-border bg-et-card mt-6 rounded-3xl border p-5">
        <p className="text-et-ink/90 text-sm font-semibold">
          {t("addon.title")}
        </p>
        <p className="text-et-ink/70 mt-2 text-sm">
          {t.rich("addon.body", {
            accent: (chunks) => (
              <span className="text-et-accent/88">{chunks}</span>
            ),
          })}
        </p>
      </div>
    </SectionContainer>
  );
}
