"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { SignUpLocaleButton } from "@/components/i18n/clerk-locale-buttons";

type Props = {
  className: string;
  children: React.ReactNode;
  errorLabel?: string;
};

/**
 * CTA "Abbonati" intelligente per il piano Viaggiatore Frequente.
 *
 * - Se l'utente NON è loggato (o lo stato auth non è ancora pronto), apre il
 *   flusso Clerk SignUp con `redirectUrl=/{locale}/app/account/upgrade?plan=sub`:
 *   dopo la registrazione la pagina di upgrade chiama il service e reindirizza
 *   automaticamente al Checkout Stripe.
 * - Se è loggato, fa una `POST /api/billing/subscribe` e reindirizza all'URL
 *   Stripe ottenuto dalla risposta.
 */
export function SubscribeCtaButton({ className, children, errorLabel }: Props) {
  const { isSignedIn, isLoaded } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isLoaded || !isSignedIn) {
    return (
      <SignUpLocaleButton appPath="/app/account/upgrade?plan=sub">
        <button type="button" className={className}>
          {children}
        </button>
      </SignUpLocaleButton>
    );
  }

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { checkoutUrl?: string };
        error?: { message?: string };
      };
      const url = json.data?.checkoutUrl;
      if (res.ok && url) {
        window.location.href = url;
        return;
      }
      window.alert(
        json.error?.message ?? errorLabel ?? "Errore. Riprova più tardi.",
      );
    } catch {
      window.alert(errorLabel ?? "Errore di rete. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={loading}
    >
      {children}
    </button>
  );
}
