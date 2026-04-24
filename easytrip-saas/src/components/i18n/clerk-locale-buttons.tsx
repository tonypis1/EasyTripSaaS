"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";

/**
 * Wrapper dei bottoni Clerk che calcola `forceRedirectUrl` dal locale corrente.
 *
 * Senza prefisso locale, Clerk rimanderebbe a `/app`: il middleware next-intl
 * poi farebbe redirect verso `/{locale}/app`, aggiungendo un hop in più e
 * rischi di flash. Qui passiamo direttamente `/{locale}{path}` come URL di
 * destinazione post-auth.
 */

type CommonProps = {
  /** Path applicativo SENZA prefisso locale, es. "/app" o `/join/${token}`. */
  appPath?: string;
  children: React.ReactNode;
};

function withLocale(path: string, locale: AppLocale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean === "/" ? "" : clean}`;
}

export function SignInLocaleButton(props: CommonProps & { mode?: "modal" | "redirect" }) {
  const locale = useLocale() as AppLocale;
  const target = withLocale(props.appPath ?? "/app", locale);
  return (
    <SignInButton mode={props.mode ?? "modal"} forceRedirectUrl={target}>
      {props.children}
    </SignInButton>
  );
}

export function SignUpLocaleButton(props: CommonProps & { mode?: "modal" | "redirect" }) {
  const locale = useLocale() as AppLocale;
  const target = withLocale(props.appPath ?? "/app", locale);
  return (
    <SignUpButton mode={props.mode ?? "modal"} forceRedirectUrl={target}>
      {props.children}
    </SignUpButton>
  );
}
