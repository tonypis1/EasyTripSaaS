import { SectionContainer } from "./section-container";

export function TestimonialsSection() {
  const testimonials = [
    {
      label: "Viaggiatore frequente",
      quote:
        "Perdo 8 ore a pianificare ogni viaggio. Voglio solo dire dove vado e avere un piano che funziona.",
    },
    {
      label: "Gruppo (3-5 amici)",
      quote:
        "Organizzare un viaggio in cinque e peggio che lavorare: votazioni, spese, chi prenota cosa.",
    },
    {
      label: "Stile LocalPass",
      quote:
        "Spesso finisco in trappole per turisti. Voglio sapere dove vanno davvero le persone del posto.",
    },
  ];

  return (
    <SectionContainer className="bg-et-raised/80">
      <div>
        <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
          Fiducia
        </p>
        <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
          Le frasi che senti prima di comprare.
        </h2>
        <p className={`text-et-ink/70 mt-3 text-base leading-relaxed`}>
          Quando capisci che il piano non è un PDF statico, ma un sistema che si adatta al viaggio,
          smetti di perdere tempo e inizi a esplorare.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {testimonials.map((t) => (
          <figure
            key={t.label}
            className="border-et-border bg-et-card rounded-3xl border p-6"
          >
            <div className="text-et-accent/88 text-xs font-semibold">
              {t.label}
            </div>
            <blockquote
              className={`text-et-ink/80 mt-3 text-sm leading-relaxed`}
            >
              &quot;{t.quote}&quot;
            </blockquote>
            <figcaption className="text-et-ink/55 mt-4 text-xs">
              Feedback da ricerca utenti e viaggiatori
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionContainer>
  );
}

