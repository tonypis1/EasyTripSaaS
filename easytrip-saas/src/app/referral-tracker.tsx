"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "et_ref";

/**
 * Componente da inserire nel layout della landing page.
 * Salva il codice referral ?ref=CODICE in localStorage.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && ref.length >= 4) {
      localStorage.setItem(STORAGE_KEY, ref);
    }
  }, [searchParams]);

  return null;
}

/**
 * Componente da inserire nel layout /app (area autenticata).
 * Se c'è un codice referral salvato, lo invia al backend e lo rimuove.
 */
export function ReferralTracker() {
  useEffect(() => {
    const ref = localStorage.getItem(STORAGE_KEY);
    if (!ref) return;

    localStorage.removeItem(STORAGE_KEY);

    fetch("/api/referral/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: ref }),
    }).catch(() => {
      localStorage.setItem(STORAGE_KEY, ref);
    });
  }, []);

  return null;
}
