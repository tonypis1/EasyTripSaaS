"use client";

import posthog from "posthog-js";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TripType = "solo" | "coppia" | "gruppo";
type BudgetLevel = "economy" | "moderate" | "premium";

const BUDGET_OPTIONS: { value: BudgetLevel; label: string; hint: string }[] = [
  {
    value: "economy",
    label: "Economico",
    hint: "Street food, musei gratis, trasporti pubblici",
  },
  {
    value: "moderate",
    label: "Standard",
    hint: "Equilibrio qualit\u00e0/prezzo, mix esperienze",
  },
  {
    value: "premium",
    label: "Premium",
    hint: "Ristoranti top, tour privati, esperienze VIP",
  },
];

export function CreateTripForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>("moderate");
  const [localPassCities, setLocalPassCities] = useState(0);

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
          localPassCityCount: Math.min(30, Math.max(0, localPassCities)),
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
      id="create-trip-form"
      onSubmit={onSubmit}
      className="border-et-border bg-et-card space-y-4 rounded-2xl border p-6"
    >
      <div className="border-et-accent/40 border-l-2 pl-4">
        <h2 className="font-display text-et-ink text-xl font-normal tracking-tight">
          Nuovo viaggio
        </h2>
        <p className="text-et-ink/55 mt-1 text-sm">
          Dopo la creazione potrai pagare e avviare la generazione AI
          dell&apos;itinerario.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="destination"
            className="text-et-accent/88 block text-xs font-semibold tracking-wider uppercase"
          >
            Destinazione
          </label>
          <input
            id="destination"
            name="destination"
            required
            minLength={2}
            maxLength={120}
            placeholder="es. Lisbona"
            className="border-et-border bg-et-deep text-et-ink placeholder:text-et-ink/40 focus:border-et-accent/50 mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="startDate"
            className="text-et-accent/88 block text-xs font-semibold tracking-wider uppercase"
          >
            Inizio
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="border-et-border bg-et-deep text-et-ink focus:border-et-accent/50 mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="endDate"
            className="text-et-accent/88 block text-xs font-semibold tracking-wider uppercase"
          >
            Fine
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            className="border-et-border bg-et-deep text-et-ink focus:border-et-accent/50 mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="tripType"
            className="text-et-accent/88 block text-xs font-semibold tracking-wider uppercase"
          >
            Tipo
          </label>
          <select
            id="tripType"
            name="tripType"
            className="border-et-border bg-et-deep text-et-ink focus:border-et-accent/50 mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          >
            <option value="solo">Solo</option>
            <option value="coppia">Coppia</option>
            <option value="gruppo">Gruppo (3–5)</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="style"
            className="text-et-accent/88 block text-xs font-semibold tracking-wider uppercase"
          >
            Stile (opz.)
          </label>
          <input
            id="style"
            name="style"
            maxLength={120}
            placeholder="foodie, cultura…"
            className="border-et-border bg-et-deep text-et-ink placeholder:text-et-ink/40 focus:border-et-accent/50 mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="text-et-accent/88 block text-xs font-semibold tracking-wider uppercase">
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
                    "min-h-[44px] flex-1 cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-200",
                    "focus:ring-et-accent/50 focus:ring-offset-et-deep focus:ring-2 focus:ring-offset-1 focus:outline-none",
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
          <p className="text-et-ink/45 mt-1.5 text-xs">
            {BUDGET_OPTIONS.find((o) => o.value === budgetLevel)?.hint}
          </p>
        </fieldset>

        <div className="sm:col-span-2">
          <label
            htmlFor="localPassCityCount"
            className="text-et-accent/88 block text-xs font-semibold tracking-wider uppercase"
          >
            LocalPass (opzionale)
          </label>
          <p className="text-et-ink/50 mt-1 text-xs leading-relaxed">
            Aggiungi €3,99 per ogni città in cui vuoi consigli da insider, gemme nascoste e suggerimenti non turistici (LocalPass).
          </p>
          <input
            id="localPassCityCount"
            name="localPassCityCount"
            type="number"
            min={0}
            max={30}
            value={localPassCities}
            onChange={(e) =>
              setLocalPassCities(
                Math.min(30, Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0)),
              )
            }
            className="border-et-border bg-et-deep text-et-ink focus:border-et-accent/50 mt-1.5 w-full max-w-[120px] rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="bg-et-accent text-et-accent-ink hover:bg-et-accent/90 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Creazione…" : "Crea viaggio"}
      </button>
    </form>
  );
}
