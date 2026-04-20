import { SectionContainer } from "./section-container";

export function FAQSection() {
  const faqs = [
    {
      q: "Come funziona lo sblocco giornaliero?",
      a: "Il giorno 1 si vede solo il giorno 1. Il giorno 2 si sblocca il giorno 2. L'accesso scade a fine viaggio + 1 giorno (end_date + 1g).",
    },
    {
      q: "Quanto ci vuole per ottenere il piano completo?",
      a: "L'itinerario viene creato in 30 secondi. Il sistema usa prompt diversi per momenti diversi: generazione, adattamento live e sostituzione slot.",
    },
    {
      q: "Quante volte posso rigenerare un itinerario?",
      a: "3 rigenerazioni gratis. Poi 4–7 a pagamento (€1,99). Dopo il massimo: carosello (torna alla versione 1, scegli il migliore itinerario e inizi a goderti il viaggio).",
    },
    {
      q: "Funziona anche senza connessione?",
      a: "Per generare l'itinerario e per le funzioni live serve connessione. Durante il viaggio puoi consultare il piano sbloccato, ma la generazione/adattamento richiede rete.",
    },
    {
      q: "Che differenza c'è tra LocalPass e altre piattaforme di viaggio?",
      a: "LocalPass porta contenuti autentici da insider locali: posti curati, gemme nascoste e consigli non-turistici. L'obiettivo è evitare i posti che la maggior parte dei turisti vede sulle altre piattaforme.",
    },
  ];

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
            FAQ
          </p>
          <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
            Risposte rapide, prima che tu ci ripensi.
          </h2>
          <p className={`text-et-ink/70 mt-3 text-base leading-relaxed`}>
            Cancellazione: credito da utilizzare in un anno. I contenuti sono pensati per
            essere vissuti nel tempo, non collezionati come file.
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
