"use client";

import { useLayoutEffect } from "react";

/**
 * Il root layout non può leggere [locale] dai params, ma il tag <html lang>
 * conviene allinearlo alla lingua attiva. Aggiorniamo documentElement.lang
 * lato client per le rotte sotto [locale] (it, en, …).
 */
export function SetDocumentLang({ locale }: { locale: string }) {
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
