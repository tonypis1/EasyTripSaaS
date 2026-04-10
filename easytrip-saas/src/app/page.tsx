import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getWaitlistStats } from "@/lib/waitlist-store";
import { ReferralCapture } from "@/app/referral-tracker";

export const metadata: Metadata = {
  title:
    "EasyTrip — Itinerari AI per Weekend in Europa | Pianifica in 30 secondi",
  description:
    "Pianifica viaggi brevi di 2–5 o più giorni con l'AI. Itinerari ottimizzati per distanze, ristoranti locali e gemme nascoste. Prova gratis in beta.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "it_IT",
    title:
      "EasyTrip — Itinerari AI per Weekend in Europa | Pianifica in 30 secondi",
    description:
      "Pianifica viaggi brevi di 2–5 o più giorni con l'AI. Itinerari ottimizzati per distanze, ristoranti locali e gemme nascoste. Prova gratis in beta.",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "EasyTrip — Itinerari AI per viaggi brevi",
      },
    ],
  },
};

function IconGlobe(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconSparkles(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="M12 2l1.2 4.2L17 8l-3.8 1.8L12 14l-1.2-4.2L7 8l3.8-1.8L12 2z" />
      <path d="M20 13l.8 2.8L23 17l-2.2 1.2L20 21l-.8-2.8L17 17l2.2-1.2L20 13z" />
    </svg>
  );
}

function IconMap(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </svg>
  );
}

function IconUsers(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6" />
      <path d="M23 11h-6" />
    </svg>
  );
}

function Form() {
  return (
    <form action="/api/waitlist" method="post" className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="la-tua@email.com"
            className="border-et-ink/14 bg-et-card text-et-ink placeholder:text-et-ink/45 focus:border-et-accent/55 w-full rounded-xl border px-4 py-3 text-sm transition outline-none"
          />
        </div>
        <button
          type="submit"
          className="bg-et-accent text-et-accent-ink hover:bg-et-accent/88 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition active:scale-[0.99] sm:w-auto"
        >
          Voglio l'accesso →
        </button>
      </div>
      <p className="text-et-ink/60 mt-3 text-xs">
        Beta in arrivo — posti limitati. Solo email.
      </p>
    </form>
  );
}

function HeroMinimal(props: {
  waitlistCount: number;
  waitlistCapacity: number;
}) {
  return (
    <section className="et-grain et-hero-mesh relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="border-et-accent/22 bg-et-accent/10 text-et-accent/88 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase">
          <IconSparkles className="text-et-accent h-4 w-4" />
          Beta · posti limitati
        </div>
        <div className="border-et-accent/35 mt-8 border-l-2 pl-6 sm:pl-8">
          <h1 className="font-display text-et-ink text-4xl leading-[1.06] font-normal tracking-[-0.02em] sm:text-5xl md:text-[2.75rem]">
            Itinerari AI per viaggi brevi.
            <br />
            <span className="text-et-accent italic">
              Pianifica in 30 secondi.
            </span>
          </h1>
        </div>
        <p className="text-et-ink/70 mt-6 max-w-2xl text-base leading-relaxed">
          L&apos;AI crea un piano giorno per giorno, ottimizzato
          geograficamente, con ristoranti locali e gemme nascoste. Accesso
          temporaneo: il giorno 2 si sblocca il giorno 2.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(300px,400px)] lg:items-start lg:gap-10">
          <div className="border-et-border bg-et-card rounded-3xl border p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)]">
            <div className="text-et-ink/80 text-sm">
              🔥 <strong className="text-et-ink">{props.waitlistCount}</strong>{" "}
              persone già in lista
            </div>
            <div className="text-et-ink/60 mt-2 text-xs">
              Accesso scontato a €4,99 per i primi{" "}
              <strong className="text-et-ink">{props.waitlistCapacity}</strong>.
            </div>
            <div className="mt-4">
              <Form />
            </div>
          </div>
          <div className="border-et-border bg-et-card rounded-3xl border p-6 lg:-translate-y-3 lg:shadow-[0_32px_90px_-40px_rgba(182,227,107,0.12)]">
            <div className="text-et-ink/90 text-sm font-semibold">
              Cosa ottieni subito
            </div>
            <ul className="text-et-ink/70 mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="text-et-accent mt-0.5">✓</span>
                <span>Generazione itinerario AI per 2–5 o più giorni</span>
              </li>
              <li className="flex gap-3">
                <span className="text-et-accent mt-0.5">✓</span>
                <span>
                  Mappe e percorsi ottimizzati (minimizza spostamenti)
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-et-accent mt-0.5">✓</span>
                <span>Rigenera: 3 gratis → 7 max → carosello</span>
              </li>
            </ul>
            <div className="border-et-border text-et-ink/60 mt-5 rounded-2xl border bg-black/20 p-4 text-xs">
              Cancellazione: credito, mai rimborso.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Nav() {
  return (
    <header className="border-et-border bg-et-deep/80 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="font-display text-et-accent inline-flex items-center gap-2 text-xl font-normal tracking-tight"
        >
          <IconGlobe className="text-et-accent h-7 w-7 shrink-0" />
          EasyTrip
        </Link>
        <nav className="text-et-ink/70 hidden items-center gap-6 text-sm md:flex">
          <a href="#come-funziona" className="hover:text-et-ink">
            Come funziona
          </a>
          <a href="#prezzi" className="hover:text-et-ink">
            Prezzi
          </a>
          <a href="#faq" className="hover:text-et-ink">
            FAQ
          </a>
        </nav>
      </div>
    </header>
  );
}

function SectionContainer(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`mx-auto max-w-6xl px-4 py-14 sm:py-20 ${
        props.className ?? ""
      }`}
    >
      {props.children}
    </section>
  );
}

function FeaturesSection() {
  return (
    <SectionContainer className="text-et-ink">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
            01 — Struttura & valore
          </p>
          <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
            Non acquisti un prodotto. Acquisti un'esperienza nel tempo.
          </h2>
          <p
            className={`text-et-ink/70 mt-4 max-w-xl text-base leading-relaxed`}
          >
            La scadenza è il prodotto stesso: il fatto che il giorno 2 si
            sblocchi solo il giorno 2 significa che l'utente apre l'app ogni
            mattina del viaggio. Questo crea un engagement altissimo che nessun
            PDF può replicare.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="border-et-border bg-et-card rounded-2xl border p-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div className="font-semibold">Sblocco progressivo</div>
              </div>
              <p className="text-et-ink/65 mt-2 text-sm">
                Il giorno 1 si vede solo il giorno 1. Il giorno 2 si sblocca il
                giorno 2.
              </p>
            </div>
            <div className="border-et-border bg-et-card rounded-2xl border p-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏳</span>
                <div className="font-semibold">Accesso ≠ File</div>
              </div>
              <p className="text-et-ink/65 mt-2 text-sm">
                Non acquisti un PDF. Acquisti l'accesso a un sistema dinamico
                che sa dove sei e cosa succede oggi.
              </p>
            </div>
          </div>
        </div>

        <div className="border-et-border bg-et-card rounded-3xl border p-6">
          <p className="text-et-ink/90 text-sm font-semibold">
            I 3 punti che contano
          </p>
          <div className="mt-5 space-y-4">
            <div className="border-et-border flex gap-4 rounded-2xl border bg-black/10 p-4">
              <div className="text-et-accent mt-0.5" aria-hidden="true">
                <IconSparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">Generazione itinerario AI</div>
                <div className="text-et-ink/65 mt-1 text-sm">
                  Input: destinazione + date + stile. Output: piano giorno per
                  giorno sbloccato progressivamente.
                </div>
              </div>
            </div>
            <div className="border-et-border flex gap-4 rounded-2xl border bg-black/10 p-4">
              <div className="text-et-accent mt-0.5" aria-hidden="true">
                <IconMap className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">Mappe Live</div>
                <div className="text-et-ink/65 mt-1 text-sm">
                  Percorsi ottimizzati per minimizzare gli spostamenti. Un click
                  per aprire su Google Maps o Waze.
                </div>
              </div>
            </div>
            <div className="border-et-border flex gap-4 rounded-2xl border bg-black/10 p-4">
              <div className="text-et-accent mt-0.5" aria-hidden="true">
                <IconUsers className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">PackedUp (gruppo)</div>
                <div className="text-et-ink/65 mt-1 text-sm">
                  Itinerario condiviso, votazioni in-app e split spese
                  integrato.
                </div>
              </div>
            </div>
          </div>
          <div className="border-et-border text-et-ink/60 mt-5 rounded-2xl border bg-black/20 p-4 text-xs">
            Rigenera: 3 gratis → 7 max → carosello. Così smetti di cambiare
            continuamente e inizi a goderti il viaggio.
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}

function PricingSection(props: { waitlistCapacity: number }) {
  type Plan = {
    name: string;
    badge: string;
    priceMain: string;
    priceBeta?: string;
    priceBetaLabel?: string;
    desc: string;
    features: string[];
    cta: string;
    href: string;
  };

  const plans: Plan[] = [
    {
      name: "Trip Solo / Coppia",
      badge: "Core",
      priceMain: "€9,99/viaggio",
      priceBeta: "€4,99",
      priceBetaLabel: "Prezzo beta",
      desc: "TripGenius base, 1–2 persone.",
      features: [
        "Sblocco progressivo giornaliero",
        "Itinerario ottimizzato geograficamente",
        "Ristoranti locali + gemme nascoste",
        "Rigenera: 3 gratis → 7 max → carosello",
      ],
      cta: "Voglio l'accesso →",
      href: "#waitlist",
    },
    {
      name: "Trip Gruppo (3–5 persone)",
      badge: "PackedUp",
      priceMain: "€14,99/viaggio",
      desc: "TripGenius + PackedUp. Gruppo che già divide le spese.",
      features: [
        "Itinerario condiviso",
        "Split spese automatico",
        "Chat di viaggio integrata",
        "Ogni membro vede lo stesso sblocco",
      ],
      cta: "Unisciti alla beta →",
      href: "#waitlist",
    },
    {
      name: "Viaggiatore frequente",
      badge: "Abbonamento",
      priceMain: "€4,99/mese",
      desc: "Trip illimitati solo/coppia per 1 mese.",
      features: [
        "MRR stabile",
        "Ottimo per chi viaggia 6+ volte/anno",
        "Più viaggi, meno riprogettazione",
        "Upgrade disponibili (LocalPass)",
      ],
      cta: "Attiva la beta →",
      href: "#waitlist",
    },
  ];

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
            Beta in arrivo — posti limitati. Accesso scontato a €4,99 per i
            primi {props.waitlistCapacity}.
          </p>
        </div>
        <div className="border-et-border bg-et-card text-et-ink/65 rounded-2xl border px-4 py-3 text-sm">
          Beta: <span className="text-et-accent">€4,99</span> invece di{" "}
          <span className="text-et-ink/80">€9,99</span>
        </div>
      </div>

      <div id="prezzi" className="mt-10 grid gap-6 lg:grid-cols-3">
        {plans.map((plan, idx) => {
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
                {plan.priceBeta ? (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <div className="text-et-accent/88 text-3xl font-bold">
                      {plan.priceBeta}
                    </div>
                    <div className="text-et-ink/60 text-xs font-semibold">
                      {plan.priceBetaLabel}
                    </div>
                    <div className="text-et-ink/60 ml-auto text-sm line-through">
                      {plan.priceMain}
                    </div>
                  </div>
                ) : (
                  <div className="text-et-ink text-3xl font-bold">
                    {plan.priceMain}
                  </div>
                )}
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
                <a
                  href={plan.href}
                  className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                    highlighted
                      ? "bg-et-accent text-et-accent-ink hover:bg-et-accent/88"
                      : "border-et-ink/14 bg-et-card text-et-ink hover:bg-et-ink/[0.06] border"
                  }`}
                >
                  {plan.cta}
                </a>
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
          LocalPass: posti curati da insider locali, gemme nascoste e consigli
          non-turistici.
        </p>
      </div>
    </SectionContainer>
  );
}

function FAQSection() {
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
      a: "3 rigenerazioni gratis. Poi 4–7 a pagamento (€1,99). Dopo il massimo: carosello (torna alla versione 1).",
    },
    {
      q: "Funziona anche senza connessione?",
      a: "Per generare l'itinerario e per le funzioni live serve connessione. Durante il viaggio puoi consultare il piano sbloccato, ma la generazione/adattamento richiede rete.",
    },
    {
      q: "Che differenza c'è tra TripAdvisor e LocalPass?",
      a: "LocalPass porta contenuti autentici da insider locali: posti curati, gemme nascoste e consigli non-turistici. L'obiettivo è evitare i posti che vedresti su TripAdvisor o Google Maps.",
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
            Cancellazione: credito, mai rimborso. I contenuti sono pensati per
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

function TestimonialsSection() {
  const testimonials = [
    {
      label: "Viaggiatore frequente",
      quote:
        "Perdo 8 ore a pianificare ogni viaggio. Voglio solo dirle dove vado e avere un piano perfetto.",
    },
    {
      label: "Gruppo (2–5 amici)",
      quote:
        "Organizzare un viaggio con 5 amici è peggio che lavorare. Votazioni, spese, chi prenota cosa...",
    },
    {
      label: "LocalPass desiderio",
      quote:
        "Capito spesso in trappole per turisti. Voglio sapere dove vanno i locali.",
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
          Quando capisci che il piano non è un PDF, ma un sistema dinamico,
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
              “{t.quote}”
            </blockquote>
            <figcaption className="text-et-ink/55 mt-4 text-xs">
              Beta tester &amp; viaggiatori frequenti
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionContainer>
  );
}

function CTASection(props: {
  waitlistCount: number;
  waitlistCapacity: number;
}) {
  return (
    <SectionContainer className="py-10 sm:py-14">
      <div
        id="waitlist"
        className="border-et-border from-et-ink/[0.05] rounded-3xl border bg-gradient-to-b to-black/10 p-6 sm:p-10"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
              Beta in arrivo — posti limitati
            </p>
            <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
              Voglio l&apos;accesso.
              <br />
              <span className="text-et-accent italic">
                Scontato a €4,99 in beta.
              </span>
            </h2>
            <p className={`text-et-ink/70 mt-3 text-base leading-relaxed`}>
              L'intera esperienza di viaggio è pensata per essere vissuta giorno
              dopo giorno.
            </p>
            <div className="text-et-ink/60 mt-4 text-sm">
              🔥 <strong className="text-et-ink">{props.waitlistCount}</strong>{" "}
              persone già in lista • Accesso scontato a €4,99 per i primi{" "}
              <strong className="text-et-ink">{props.waitlistCapacity}</strong>
            </div>
          </div>

          <div className="border-et-border rounded-2xl border bg-black/20 p-5">
            <Form />
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

function Footer() {
  return (
    <footer className="border-et-border bg-et-deep border-t">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-display text-et-accent text-lg font-normal tracking-tight">
              EasyTrip
            </div>
            <p className="text-et-ink/60 mt-2 text-sm">
              Itinerari AI per viaggi brevi in Europa. Pianifica in 30 secondi.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="#come-funziona"
            >
              Come funziona
            </a>
            <a
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="#prezzi"
            >
              Prezzi
            </a>
            <a className="text-et-ink/70 hover:text-et-ink text-sm" href="#faq">
              FAQ
            </a>
            <Link
              className="text-et-ink/70 hover:text-et-ink text-sm"
              href="/app"
            >
              Area riservata
            </Link>
          </div>
        </div>
        <div className="text-et-ink/45 mt-8 text-xs">
          © {new Date().getFullYear()} EasyTrip. Tutti i diritti riservati.
        </div>
      </div>
    </footer>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ waitlist?: string }>;
}) {
  const stats = await getWaitlistStats();
  const sp = (await searchParams) ?? {};
  const success = sp.waitlist === "ok";
  const waitlistCount = stats.count;
  const waitlistCapacity = stats.capacity;

  return (
    <div className={`bg-et-deep text-et-ink min-h-screen`}>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <Nav />
      {success ? (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="border-et-accent/30 bg-et-accent/10 text-et-accent/88 rounded-2xl border px-4 py-3 text-sm">
            Grazie! Sei dentro la lista beta. Ti contatteremo via email.
          </div>
        </div>
      ) : null}

      <HeroMinimal
        waitlistCount={waitlistCount}
        waitlistCapacity={waitlistCapacity}
      />

      <div id="come-funziona">
        <FeaturesSection />
      </div>
      <PricingSection waitlistCapacity={waitlistCapacity} />
      <TestimonialsSection />
      <FAQSection />
      <CTASection
        waitlistCount={waitlistCount}
        waitlistCapacity={waitlistCapacity}
      />
      <Footer />
    </div>
  );
}
