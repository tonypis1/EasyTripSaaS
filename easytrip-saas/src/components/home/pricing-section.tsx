import { SectionContainer } from "./section-container";
import { SignupCtaButton } from "./signup-cta";

type Plan = {
  name: string;
  badge: string;
  priceDisplay: string;
  desc: string;
  features: string[];
  cta: string;
};

const PLANS: Plan[] = [
  {
    name: "Trip Solo / Coppia",
    badge: "Core",
    priceDisplay: "€9,99/viaggio",
    desc: "TripGenius base, 1–2 persone.",
    features: [
      "Sblocco progressivo giornaliero",
      "Itinerario ottimizzato geograficamente",
      "Ristoranti locali + gemme nascoste",
      "Rigenera: 3 gratis → 7 max → carosello",
    ],
    cta: "Registrati e crea un viaggio →",
  },
  {
    name: "Trip Gruppo (3–5 persone)",
    badge: "PackedUp",
    priceDisplay: "€14,99/viaggio",
    desc: "TripGenius + PackedUp. Gruppo che già divide le spese.",
    features: [
      "Itinerario condiviso",
      "Split spese automatico",
      "Chat di viaggio integrata",
      "Ogni membro vede lo stesso sblocco",
    ],
    cta: "Crea account e organizza il gruppo →",
  },
  {
    name: "Viaggiatore frequente",
    badge: "Abbonamento",
    priceDisplay: "€14,99/mese",
    desc: "Trip illimitati solo/coppia per 1 mese.",
    features: [
      "Ideale se viaggi spesso",
      "Meno tempo a riprogettare",
      "Coerente con i prezzi mostrati in checkout",
      "Add-on LocalPass: +€3,99 per città (insider, gemme nascoste)",
    ],
    cta: "Registrati e scopri i piani →",
  },
];

export function PricingSection() {
  return (
    <SectionContainer className="border-et-border bg-et-raised border-y">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
            02 — Prezzi chiari
          </p>
          <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
            Prezzo semplice. Valore immediato.
          </h2>
          <p
            className={`text-et-ink/70 mt-3 max-w-xl text-base leading-relaxed`}
          >
            Paghi per viaggio o scegli abbonamento.
          </p>
        </div>
      </div>

      <div id="prezzi" className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan, idx) => {
          const highlighted = idx === 0;
          return (
            <div
              key={plan.name}
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
                <SignupCtaButton
                  className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                    highlighted
                      ? "bg-et-accent text-et-accent-ink hover:bg-et-accent/88"
                      : "border-et-ink/14 bg-et-card text-et-ink hover:bg-et-ink/[0.06] border"
                  }`}
                >
                  {plan.cta}
                </SignupCtaButton>
              </div>

              {highlighted ? (
                <div className="border-et-border text-et-ink/60 mt-4 rounded-2xl border bg-black/20 p-3 text-xs">
                  3 gratis → 7 max → carosello: rigenera senza ansia, con un
                  limite chiaro.
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-et-border bg-et-card mt-6 rounded-3xl border p-5">
        <p className="text-et-ink/90 text-sm font-semibold">In più (Premium)</p>
        <p className="text-et-ink/70 mt-2 text-sm">
          Qualsiasi piano +{" "}
          <span className="text-et-accent/88">€3,99 add-on per città</span> con
          LocalPass: luoghi curati da insider locali, gemme nascoste e consigli
          non turistici.
        </p>
      </div>
    </SectionContainer>
  );
}

