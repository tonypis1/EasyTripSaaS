"use client";

import posthog from "posthog-js";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TripType = "solo" | "coppia" | "gruppo";
type BudgetLevel = "economy" | "moderate" | "premium";

const BUDGET_OPTIONS: { value: BudgetLevel; label: string; hint: string }[] = [
  { value: "economy", label: "Economico", hint: "Street food, musei gratis, trasporti pubblici" },
  { value: "moderate", label: "Standard", hint: "Equilibrio qualit\u00e0/prezzo, mix esperienze" },
  { value: "premium", label: "Premium", hint: "Ristoranti top, tour privati, esperienze VIP" },
];

export function CreateTripForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>("moderate");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    const destination = String(fd.get("destination") ?? "").trim();
    const startDate = String(fd.get("startDate") ?? "");
    const endDate = String(fd.get("endDate") ?? "");
    const tripType = String(fd.get("tripType") ?? "solo") as TripType;
    const styleRaw = String(fd.get("style") ?? "").trim();

    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          tripType,
          budgetLevel,
          ...(styleRaw.length >= 2 ? { style: styleRaw } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "Impossibile creare il viaggio");
        return;
      }
      posthog.capture("trip_created", {
        destination,
        tripType,
        budgetLevel,
        startDate,
        endDate,
      });
      form.reset();
      router.push(`/app/trips/${json.data.id}`);
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-et-border bg-et-card p-6"
    >
      <div className="border-l-2 border-et-accent/40 pl-4">
        <h2 className="font-display text-xl font-normal tracking-tight text-et-ink">
          Nuovo viaggio
        </h2>
        <p className="mt-1 text-sm text-et-ink/55">
          Dopo la creazione potrai pagare e avviare la generazione AI dell&apos;itinerario.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="destination" className="block text-xs font-semibold uppercase tracking-wider text-et-accent/88">
            Destinazione
          </label>
          <input
            id="destination"
            name="destination"
            required
            minLength={2}
            maxLength={120}
            placeholder="es. Lisbona"
            className="mt-1.5 w-full rounded-xl border border-et-border bg-et-deep px-3 py-2.5 text-sm text-et-ink placeholder:text-et-ink/40 outline-none focus:border-et-accent/50"
          />
        </div>
        <div>
          <label htmlFor="startDate" className="block text-xs font-semibold uppercase tracking-wider text-et-accent/88">
            Inizio
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="mt-1.5 w-full rounded-xl border border-et-border bg-et-deep px-3 py-2.5 text-sm text-et-ink outline-none focus:border-et-accent/50"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-xs font-semibold uppercase tracking-wider text-et-accent/88">
            Fine
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            className="mt-1.5 w-full rounded-xl border border-et-border bg-et-deep px-3 py-2.5 text-sm text-et-ink outline-none focus:border-et-accent/50"
          />
        </div>
        <div>
          <label htmlFor="tripType" className="block text-xs font-semibold uppercase tracking-wider text-et-accent/88">
            Tipo
          </label>
          <select
            id="tripType"
            name="tripType"
            className="mt-1.5 w-full rounded-xl border border-et-border bg-et-deep px-3 py-2.5 text-sm text-et-ink outline-none focus:border-et-accent/50"
          >
            <option value="solo">Solo</option>
            <option value="coppia">Coppia</option>
            <option value="gruppo">Gruppo (3–5)</option>
          </select>
        </div>
        <div>
          <label htmlFor="style" className="block text-xs font-semibold uppercase tracking-wider text-et-accent/88">
            Stile (opz.)
          </label>
          <input
            id="style"
            name="style"
            maxLength={120}
            placeholder="foodie, cultura…"
            className="mt-1.5 w-full rounded-xl border border-et-border bg-et-deep px-3 py-2.5 text-sm text-et-ink placeholder:text-et-ink/40 outline-none focus:border-et-accent/50"
          />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="block text-xs font-semibold uppercase tracking-wider text-et-accent/88">
            Budget
          </legend>
          <div className="mt-1.5 flex gap-2">
            {BUDGET_OPTIONS.map((opt) => {
              const active = budgetLevel === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBudgetLevel(opt.value)}
                  title={opt.hint}
                  className={[
                    "min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer",
                    "focus:outline-none focus:ring-2 focus:ring-et-accent/50 focus:ring-offset-1 focus:ring-offset-et-deep",
                    active
                      ? "border-et-accent bg-et-accent/15 text-et-accent"
                      : "border-et-border bg-et-deep text-et-ink/60 hover:border-et-accent/30 hover:text-et-ink/80",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-et-ink/45">
            {BUDGET_OPTIONS.find((o) => o.value === budgetLevel)?.hint}
          </p>
        </fieldset>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-xl bg-et-accent px-4 py-3 text-sm font-semibold text-et-accent-ink transition hover:bg-et-accent/90 disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Creazione…" : "Crea viaggio"}
      </button>
    </form>
  );
}
