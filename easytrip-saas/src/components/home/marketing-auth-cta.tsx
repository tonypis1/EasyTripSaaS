"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

type Props = {
  variant?: "compact" | "stacked";
};

export function MarketingAuthCta(props: Props) {
  const stacked = props.variant === "stacked";

  return (
    <div className="flex flex-col gap-3">
      <div
        className={
          stacked
            ? "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
            : "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        }
      >
        <SignUpButton mode="modal" forceRedirectUrl="/app">
          <button
            type="button"
            className="bg-et-accent text-et-accent-ink hover:bg-et-accent/88 w-full min-w-[140px] rounded-xl px-5 py-3 text-sm font-semibold transition sm:w-auto"
          >
            Inizia ora
          </button>
        </SignUpButton>
        <SignInButton mode="modal" forceRedirectUrl="/app">
          <button
            type="button"
            className="border-et-border text-et-ink hover:bg-et-ink/[0.06] w-full min-w-[140px] rounded-xl border bg-transparent px-5 py-3 text-sm font-semibold transition sm:w-auto"
          >
            Accedi
          </button>
        </SignInButton>
      </div>
      <p className="text-et-ink/55 text-xs">
        Dopo il login accedi a{" "}
        <span className="text-et-ink/75">creazione viaggio e dashboard</span>.
      </p>
    </div>
  );
}

