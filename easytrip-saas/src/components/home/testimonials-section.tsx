import { useTranslations } from "next-intl";
import { SectionContainer } from "./section-container";

export function TestimonialsSection() {
  const t = useTranslations("home.testimonials");
  const keys = ["t1", "t2", "t3"] as const;

  const testimonials = keys.map((k) => ({
    label: t(`items.${k}.label`),
    quote: t(`items.${k}.quote`),
  }));

  return (
    <SectionContainer className="bg-et-raised/80">
      <div>
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

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {testimonials.map((item) => (
          <figure
            key={item.label}
            className="border-et-border bg-et-card rounded-3xl border p-6"
          >
            <div className="text-et-accent/88 text-xs font-semibold">
              {item.label}
            </div>
            <blockquote
              className={`text-et-ink/80 mt-3 text-sm leading-relaxed`}
            >
              &quot;{item.quote}&quot;
            </blockquote>
            <figcaption className="text-et-ink/55 mt-4 text-xs">
              {t("caption")}
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionContainer>
  );
}
