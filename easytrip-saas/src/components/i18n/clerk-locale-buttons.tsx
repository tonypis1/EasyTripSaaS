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
 *
 * **Modalità default `redirect`:** con Account Portal su sottodominio dedicato
 * (es. `accounts.tuodominio.com` in Clerk Dashboard) la modalità `modal` apre
 * un iframe verso quell’origine; se non è consentita dalla CSP del sito principale,
 * il bottone sembra “morto”. Il redirect a pagina intera è allineato a “Sign-up
 * on Account Portal” e non dipende da `frame-src`.
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

export function SignInLocaleButton(
  props: CommonProps & { mode?: "modal" | "redirect" },
) {
  const locale = useLocale() as AppLocale;
  const target = withLocale(props.appPath ?? "/app", locale);
  return (
    <SignInButton mode={props.mode ?? "redirect"} forceRedirectUrl={target}>
      {props.children}
    </SignInButton>
  );
}

export function SignUpLocaleButton(
  props: CommonProps & { mode?: "modal" | "redirect" },
) {
  const locale = useLocale() as AppLocale;
  const target = withLocale(props.appPath ?? "/app", locale);
  return (
    <SignUpButton mode={props.mode ?? "redirect"} forceRedirectUrl={target}>
      {props.children}
    </SignUpButton>
  );
}
