"use client";

import { useTranslations } from "next-intl";
import {
  SignInLocaleButton as SignInButton,
  SignUpLocaleButton as SignUpButton,
} from "@/components/i18n/clerk-locale-buttons";

type Props = {
  variant?: "compact" | "stacked";
};

export function MarketingAuthCta(props: Props) {
  const t = useTranslations("home.hero.signupCard");
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
        <SignUpButton mode="modal" appPath="/app">
          <button
            type="button"
            className="bg-et-accent text-et-accent-ink hover:bg-et-accent/88 w-full min-w-[140px] rounded-xl px-5 py-3 text-sm font-semibold transition sm:w-auto"
          >
            {t("ctaSignUp")}
          </button>
        </SignUpButton>
        <SignInButton mode="modal" appPath="/app">
          <button
            type="button"
            className="border-et-border text-et-ink hover:bg-et-ink/[0.06] w-full min-w-[140px] rounded-xl border bg-transparent px-5 py-3 text-sm font-semibold transition sm:w-auto"
          >
            {t("ctaSignIn")}
          </button>
        </SignInButton>
      </div>
      <p className="text-et-ink/55 text-xs">
        {t.rich("authFooter", {
          em: (chunks) => <span className="text-et-ink/75">{chunks}</span>,
        })}
      </p>
    </div>
  );
}
