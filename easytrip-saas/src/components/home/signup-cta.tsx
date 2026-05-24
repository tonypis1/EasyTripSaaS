"use client";

import { SignUpLocaleButton } from "@/components/i18n/clerk-locale-buttons";

type Props = {
  className: string;
  children: React.ReactNode;
};

/**
 * CTA stile bottone che apre il modal di registrazione Clerk.
 *
 * Usa `SignUpLocaleButton` per inoltrare l'utente a `/{locale}/app` dopo
 * la registrazione, preservando la lingua scelta sulla home.
 */
export function SignupCtaButton(props: Props) {
  return (
    <SignUpLocaleButton appPath="/app">
      <button type="button" className={props.className}>
        {props.children}
      </button>
    </SignUpLocaleButton>
  );
}
