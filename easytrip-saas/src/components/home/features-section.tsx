import { IconMap, IconSparkles, IconUsers } from "./icons";
import { SectionContainer } from "./section-container";

export function FeaturesSection() {
  return (
    <SectionContainer className="text-et-ink">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
            01 — Struttura & valore
          </p>
          <h2 className="font-display mt-3 text-3xl leading-tight font-normal tracking-[-0.02em] sm:text-4xl">
            Non acquisti un prodotto. Acquisti un&apos;esperienza nel tempo.
          </h2>
          <p
            className={`text-et-ink/70 mt-4 max-w-xl text-base leading-relaxed`}
          >
            La scadenza è il prodotto stesso: il fatto che il giorno 2 si
            sblocchi solo il giorno 2 significa che l&apos;utente apre
            l&apos;app ogni mattina del viaggio. Questo crea un engagement
            altissimo che nessun PDF può replicare.
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
                Non acquisti un PDF. Acquisti l&apos;accesso a un sistema
                dinamico che sa dove sei e cosa succede oggi.
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
                  per aprire su Google Maps.
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
            continuamente, scegli il migliore itinerario e inizi a goderti il viaggio.
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
