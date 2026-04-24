import { useTranslations } from "next-intl";
import { SectionContainer } from "./section-container";

export function FAQSection() {
  const t = useTranslations("home.faq");
  const faqKeys = ["q1", "q2", "q3", "q4", "q5"] as const;

  const faqs = faqKeys.map((k) => ({
    q: t(`items.${k}.q`),
    a: t(`items.${k}.a`),
  }));

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };

  return (
    <SectionContainer>
      <div id="faq" className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="max-w-xl">
          <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
            {t("title")}
          </h2>
          <p className={`text-et-ink/70 mt-3 text-base leading-relaxed`}>
            {t("subtitle")}
          </p>
        </div>

        <div className="flex-1">
          <div className="space-y-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group border-et-border bg-et-card rounded-2xl border p-4"
              >
                <summary className="text-et-ink/90 cursor-pointer list-none text-sm font-semibold">
                  {f.q}
                  <span className="text-et-accent float-right transition group-open:rotate-180">
                    ▼
                  </span>
                </summary>
                <p className={`text-et-ink/70 mt-3 text-sm leading-relaxed`}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        </div>
      </div>
    </SectionContainer>
  );
}
