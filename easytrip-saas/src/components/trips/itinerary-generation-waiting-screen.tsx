"use client";

import {
  estimateItineraryGenerationProgress,
  ITINERARY_GENERATION_STEP_KEYS,
  ITINERARY_GENERATION_STEP_MS,
} from "@/lib/itinerary-generation-steps";
import {
  Calendar,
  Compass,
  Gem,
  Route,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

const STEP_ICONS: LucideIcon[] = [
  Compass,
  Route,
  Gem,
  UtensilsCrossed,
  Calendar,
  Sparkles,
];

type Props = {
  variant: "first" | "regen";
  onRefresh: () => void;
};

export function ItineraryGenerationWaitingScreen({
  variant,
  onRefresh,
}: Props) {
  const td = useTranslations("app.trips.detail");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const startedAt = Date.now();
    const tick = window.setInterval(
      () => {
        setElapsedMs(Date.now() - startedAt);
      },
      reducedMotion ? 1000 : 250,
    );
    return () => window.clearInterval(tick);
  }, [reducedMotion]);

  useEffect(() => {
    const intervalMs = reducedMotion
      ? ITINERARY_GENERATION_STEP_MS * 2
      : ITINERARY_GENERATION_STEP_MS;
    const t = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % ITINERARY_GENERATION_STEP_KEYS.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [reducedMotion]);

  const progress = useMemo(
    () => estimateItineraryGenerationProgress(elapsedMs),
    [elapsedMs],
  );

  const stepKey = ITINERARY_GENERATION_STEP_KEYS[stepIndex];
  const stepMessage = td(`generating.steps.${stepKey}`);
  const StepIcon = STEP_ICONS[stepIndex] ?? Sparkles;

  const title =
    variant === "regen" ? td("generating.titleRegen") : td("generating.title");
  const description =
    variant === "regen"
      ? td("generating.descriptionRegen")
      : td("generating.description");

  return (
    <section
      className="border-et-accent/35 bg-et-accent/5 rounded-2xl border border-dashed p-8 text-center"
      aria-busy="true"
      aria-labelledby="itinerary-generation-title"
    >
      <div
        className="bg-et-accent/15 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
        aria-hidden
      >
        <StepIcon
          className={`text-et-accent h-7 w-7 ${reducedMotion ? "" : "animate-pulse"}`}
        />
      </div>

      <h2
        id="itinerary-generation-title"
        className="font-display text-et-ink mt-5 text-xl sm:text-2xl"
      >
        {title}
      </h2>

      <p className="text-et-ink/65 mx-auto mt-2 max-w-md text-sm leading-relaxed">
        {description}
      </p>

      <div className="mx-auto mt-8 max-w-md text-left">
        <div className="text-et-ink/55 mb-2 flex items-center justify-between text-xs">
          <span>{td("generating.progressLabel")}</span>
          <span aria-hidden="true">{progress}%</span>
        </div>
        <div
          className="bg-et-deep h-2.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={td("generating.progressLabel")}
        >
          <div
            className="bg-et-accent h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p
        className="text-et-accent mx-auto mt-6 min-h-[1.5rem] max-w-md text-sm font-medium"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {stepMessage}
      </p>

      <button
        type="button"
        onClick={onRefresh}
        className="text-et-accent mt-6 inline-flex min-h-[44px] cursor-pointer items-center justify-center px-4 text-sm underline-offset-4 transition-colors duration-200 hover:underline"
      >
        {td("generating.refreshNow")}
      </button>
    </section>
  );
}
