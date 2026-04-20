import { SectionContainer } from "./section-container";
import { MarketingAuthCta } from "./marketing-auth-cta";

export function CTASection() {
  return (
    <SectionContainer className="py-10 sm:py-14">
      <div
        id="inizia"
        className="border-et-border from-et-ink/[0.05] rounded-3xl border bg-gradient-to-b to-black/10 p-6 sm:p-10"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
              Pronto a partire
            </p>
            <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
              Registrati gratis.
              <br />
              <span className="text-et-accent italic">
                Il tuo itinerario in pochi minuti.
              </span>
            </h2>
            <p className={`text-et-ink/70 mt-3 text-base leading-relaxed`}>
              L&apos;intera esperienza di viaggio è pensata per essere vissuta
              giorno dopo giorno.
            </p>
          </div>

          <div className="border-et-border rounded-2xl border bg-black/20 p-5">
            <MarketingAuthCta variant="stacked" />
            <div className="border-et-border bg-et-card text-et-ink/60 mt-4 rounded-2xl border p-4 text-xs">
              Bonus: Invita un amico →{" "}
              <strong className="text-et-ink">1 trip gratis</strong>.
            </div>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
